import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { fields, users } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { saveFieldSchema, renameFieldSchema } from '../schemas/field.schema.js';

export default async function fieldRoutes(fastify: FastifyInstance) {
    const auth = { preHandler: [fastify.authenticate] };

    // GET /api/fields
    fastify.get('/', auth, async (request, reply) => {
        const { id: userId } = request.user as any;
        const result = await db
            .select()
            .from(fields)
            .where(eq(fields.userId, userId))
            .orderBy(desc(fields.createdAt));
        return reply.send(result);
    });

    // GET /api/fields/:id
    fastify.get('/:id', auth, async (request, reply) => {
        const { id: userId } = request.user as any;
        const { id } = request.params as { id: string };

        const [field] = await db
            .select()
            .from(fields)
            .where(and(eq(fields.id, parseInt(id)), eq(fields.userId, userId)))
            .limit(1);

        if (!field) return reply.status(404).send({ error: 'Field not found.' });
        return reply.send(field);
    });

    // POST /api/fields
    fastify.post('/', auth, async (request, reply) => {
        const { id: userId } = request.user as any;

        // if (plan === 'free') {
        //     const [{ value }] = await db
        //         .select({ value: count() })
        //         .from(fields)
        //         .where(eq(fields.userId, userId));

        //     if (Number(value) >= 5) {
        //         return reply.status(403).send({
        //             error: 'Field limit reached. Upgrade to Pro.',
        //         });
        //     }
        // }

        const result = saveFieldSchema.safeParse(request.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.flatten() });
        }

        const [field] = await db
            .insert(fields)
            .values({ userId, ...result.data })
            .returning();

        return reply.send(field);
    });

    // PATCH /api/fields/:id/name
    fastify.patch('/:id/name', auth, async (request, reply) => {
        const { id: userId } = request.user as any;
        const { id } = request.params as { id: string };

        const result = renameFieldSchema.safeParse(request.body);
        if (!result.success) {
            return reply.status(400).send({ error: result.error.flatten() });
        }

        const [field] = await db
            .update(fields)
            .set({ name: result.data.name })
            .where(and(eq(fields.id, parseInt(id)), eq(fields.userId, userId)))
            .returning();

        if (!field) return reply.status(404).send({ error: 'Field not found.' });
        return reply.send({ message: 'Renamed successfully.' });
    });

    // PATCH /api/fields/:id/boundary — update boundary points, area, perimeter
    fastify.patch('/:id/boundary', auth, async (request, reply) => {
        const { id: userId } = request.user as any;
        const { id } = request.params as { id: string };
        const { pointsJson, areaAcres, perimeterMeters } = request.body as {
            pointsJson: string;
            areaAcres: number;
            perimeterMeters: number;
        };

        if (!pointsJson) return reply.status(400).send({ error: 'pointsJson is required.' });

        const [field] = await db
            .update(fields)
            .set({ pointsJson, areaAcres, perimeterMeters })
            .where(and(eq(fields.id, parseInt(id)), eq(fields.userId, userId)))
            .returning();

        if (!field) return reply.status(404).send({ error: 'Field not found.' });
        return reply.send(field);
    });

    // DELETE /api/fields/:id
    fastify.delete('/:id', auth, async (request, reply) => {
        const { id: userId } = request.user as any;
        const { id } = request.params as { id: string };

        const [field] = await db
            .delete(fields)
            .where(and(eq(fields.id, parseInt(id)), eq(fields.userId, userId)))
            .returning();

        if (!field) return reply.status(404).send({ error: 'Field not found.' });
        return reply.send({ message: 'Deleted successfully.' });
    });
}