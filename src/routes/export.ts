import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { fields, shareLinks } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export default async function exportRoutes(fastify: FastifyInstance) {
    const auth = { preHandler: [fastify.authenticate] };

    // GET /api/export/:id?format=pdf|kml|geojson
    fastify.get('/:id', auth, async (request, reply) => {
        const { id: userId } = request.user as any;
        const { id } = request.params as { id: string };
        const { format = 'geojson' } = request.query as { format: string };

        const [field] = await db
            .select()
            .from(fields)
            .where(and(eq(fields.id, parseInt(id)), eq(fields.userId, userId)))
            .limit(1);

        if (!field) return reply.status(404).send({ error: 'Field not found.' });

        const points = (() => {
            try { return JSON.parse(field.pointsJson); }
            catch { return []; }
        })();

        if (format === 'geojson') {
            const geojson = {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    properties: {
                        name: field.name,
                        method: field.method,
                        areaAcres: field.areaAcres,
                        perimeterMeters: field.perimeterMeters,
                        locationLabel: field.locationLabel,
                        createdAt: field.createdAt,
                    },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            ...points.map((p: any) => [p.x, p.y]),
                            points[0] ? [points[0].x, points[0].y] : [],
                        ]],
                    },
                }],
            };
            reply.header('Content-Disposition', `attachment; filename="${field.name}.geojson"`);
            reply.header('Content-Type', 'application/geo+json');
            return reply.send(JSON.stringify(geojson, null, 2));
        }

        if (format === 'kml') {
            const coords = points.map((p: any) => `${p.x},${p.y},0`).join('\n');
            const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${field.name}</name>
    <Placemark>
      <name>${field.name}</name>
      <description>Area: ${field.areaAcres.toFixed(2)} acres | Perimeter: ${Math.round(field.perimeterMeters)} m</description>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
            reply.header('Content-Disposition', `attachment; filename="${field.name}.kml"`);
            reply.header('Content-Type', 'application/vnd.google-earth.kml+xml');
            return reply.send(kml);
        }

        if (format === 'pdf') {
            // Simple text-based PDF response for now
            // Can integrate puppeteer or pdfkit later for a real PDF
            const content = `
FIELD MEASUREMENT REPORT
========================
Name:        ${field.name}
Method:      ${field.method}
Area:        ${field.areaAcres.toFixed(2)} Acres
Perimeter:   ${Math.round(field.perimeterMeters)} m
Location:    ${field.locationLabel}
Measured on: ${new Date(field.createdAt).toLocaleDateString()}
Points:      ${points.length}
      `.trim();

            reply.header('Content-Disposition', `attachment; filename="${field.name}.txt"`);
            reply.header('Content-Type', 'text/plain');
            return reply.send(content);
        }

        return reply.status(400).send({ error: 'Invalid format. Use pdf, kml, or geojson.' });
    });

    // POST /api/export/:id/share — create share link
    fastify.post('/:id/share', auth, async (request, reply) => {
        const { id: userId, plan } = request.user as any;
        const { id } = request.params as { id: string };

        const [field] = await db
            .select()
            .from(fields)
            .where(and(eq(fields.id, parseInt(id)), eq(fields.userId, userId)))
            .limit(1);

        if (!field) return reply.status(404).send({ error: 'Field not found.' });

        const token = crypto.randomBytes(4).toString('hex'); // e.g. "a3f9b2c1"
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (plan === 'pro' ? 365 : 30));

        await db.insert(shareLinks).values({
            fieldId: field.id,
            token,
            expiresAt,
        });

        return reply.send({
            token,
            url: `fieldmeasure.app/s/${token}`,
            expiresAt,
        });
    });

    // GET /api/export/share/:token — public, no auth
    fastify.get('/share/:token', async (request, reply) => {
        const { token } = request.params as { token: string };

        const [link] = await db
            .select()
            .from(shareLinks)
            .where(eq(shareLinks.token, token))
            .limit(1);

        if (!link) return reply.status(404).send({ error: 'Share link not found or expired.' });
        if (new Date() > link.expiresAt)
            return reply.status(410).send({ error: 'Share link has expired.' });

        const [field] = await db
            .select()
            .from(fields)
            .where(eq(fields.id, link.fieldId))
            .limit(1);

        if (!field) return reply.status(404).send({ error: 'Field not found.' });

        return reply.send(field);
    });
}