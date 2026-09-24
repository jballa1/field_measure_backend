import PDFDocument from 'pdfkit';

interface FieldData {
    name: string;
    method: string;
    areaAcres: number;
    perimeterMeters: number;
    locationLabel: string;
    pointsJson: string;
    createdAt: Date | string;
}

export function generateFieldPdf(field: FieldData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const isPoint = field.method === 'Point';
        const isDistance = field.method === 'Distance';
        const isArea = !isPoint && !isDistance;

        let points: Array<{ x: number; y: number }> = [];
        try { points = JSON.parse(field.pointsJson); } catch { }

        // ── Header ──────────────────────────────────────────────────────────────────
        doc.rect(0, 0, doc.page.width, 80).fill('#256b5a');
        doc.fillColor('#ffffff')
            .fontSize(22).font('Helvetica-Bold')
            .text('FieldMeasure Pro', 50, 25);
        doc.fontSize(11).font('Helvetica')
            .text('Field Measurement Report', 50, 52);

        // ── Title ────────────────────────────────────────────────────────────────────
        doc.fillColor('#1a1f12')
            .fontSize(18).font('Helvetica-Bold')
            .text(field.name, 50, 100);

        const methodLabel = isPoint ? 'Point measurement'
            : isDistance ? 'Distance measurement'
                : field.method === 'GPS trace' ? 'GPS trace'
                    : 'Drawn boundary';

        doc.fontSize(11).font('Helvetica').fillColor('#6b7355')
            .text(
                `${methodLabel} · ${new Date(field.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric',
                })}`,
                50, 124
            );

        // ── Stats boxes ──────────────────────────────────────────────────────────────
        const boxY = 155;

        if (isPoint && points[0]) {
            // Single coordinate box
            doc.roundedRect(50, boxY, 495, 80, 8).fill('#e8f5ee');
            doc.fillColor('#256b5a').fontSize(10).font('Helvetica-Bold')
                .text('GPS COORDINATES', 65, boxY + 14, { characterSpacing: 1 });
            const lat = points[0].y;
            const lon = points[0].x;
            const coordStr = `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(6)}° ${lon >= 0 ? 'E' : 'W'}`;
            doc.fillColor('#1a5c3a').fontSize(20).font('Helvetica-Bold')
                .text(coordStr, 65, boxY + 30);
            doc.fillColor('#256b5a').fontSize(11).font('Helvetica')
                .text('Location coordinates', 65, boxY + 57);
        } else if (isDistance && points.length === 2) {
            // Distance box
            doc.roundedRect(50, boxY, 235, 80, 8).fill('#e8f5ee');
            doc.fillColor('#256b5a').fontSize(10).font('Helvetica-Bold')
                .text('DISTANCE', 65, boxY + 14, { characterSpacing: 1 });
            doc.fillColor('#1a5c3a').fontSize(26).font('Helvetica-Bold')
                .text(`${Math.round(field.perimeterMeters)}`, 65, boxY + 28);
            doc.fillColor('#256b5a').fontSize(11).font('Helvetica')
                .text('Metres', 65, boxY + 57);

            doc.roundedRect(305, boxY, 240, 80, 8).fill('#f5f6e4');
            doc.fillColor('#7c7d24').fontSize(10).font('Helvetica-Bold')
                .text('IN KILOMETRES', 320, boxY + 14, { characterSpacing: 1 });
            doc.fillColor('#5a5c1a').fontSize(26).font('Helvetica-Bold')
                .text(`${(field.perimeterMeters / 1000).toFixed(3)}`, 320, boxY + 28);
            doc.fillColor('#7c7d24').fontSize(11).font('Helvetica')
                .text('km', 320, boxY + 57);
        } else {
            // Area + Perimeter boxes
            doc.roundedRect(50, boxY, 235, 80, 8).fill('#e8f5ee');
            doc.fillColor('#256b5a').fontSize(10).font('Helvetica-Bold')
                .text('AREA', 65, boxY + 14, { characterSpacing: 1 });
            doc.fillColor('#1a5c3a').fontSize(26).font('Helvetica-Bold')
                .text(`${field.areaAcres.toFixed(4)}`, 65, boxY + 28);
            doc.fillColor('#256b5a').fontSize(11).font('Helvetica')
                .text('Acres', 65, boxY + 57);

            doc.roundedRect(305, boxY, 240, 80, 8).fill('#f5f6e4');
            doc.fillColor('#7c7d24').fontSize(10).font('Helvetica-Bold')
                .text('PERIMETER', 320, boxY + 14, { characterSpacing: 1 });
            doc.fillColor('#5a5c1a').fontSize(26).font('Helvetica-Bold')
                .text(`${Math.round(field.perimeterMeters)}`, 320, boxY + 28);
            doc.fillColor('#7c7d24').fontSize(11).font('Helvetica')
                .text('Metres', 320, boxY + 57);
        }

        // ── Details table ─────────────────────────────────────────────────────────
        const tableY = 260;
        doc.fillColor('#1a1f12').fontSize(12).font('Helvetica-Bold')
            .text('Measurement Details', 50, tableY);

        const rows: [string, string][] = [
            ['Method', methodLabel],
            ['Location', field.locationLabel || 'Not recorded'],
            ['Measured on', new Date(field.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric',
            })],
        ];

        if (isArea) {
            rows.push(['Area (Acres)', field.areaAcres.toFixed(6)]);
            rows.push(['Area (Hectares)', (field.areaAcres * 0.404686).toFixed(6)]);
            rows.push(['Area (Sq. Metres)', Math.round(field.areaAcres * 4046.86).toString()]);
            rows.push(['Perimeter (Metres)', Math.round(field.perimeterMeters).toString()]);
            rows.push(['Perimeter (km)', (field.perimeterMeters / 1000).toFixed(3)]);
        } else if (isDistance) {
            rows.push(['Distance (Metres)', Math.round(field.perimeterMeters).toString()]);
            rows.push(['Distance (km)', (field.perimeterMeters / 1000).toFixed(3)]);
            if (points.length === 2) {
                rows.push(['Start point', `${Math.abs(points[0].y).toFixed(6)}° ${points[0].y >= 0 ? 'N' : 'S'}, ${Math.abs(points[0].x).toFixed(6)}° ${points[0].x >= 0 ? 'E' : 'W'}`]);
                rows.push(['End point', `${Math.abs(points[1].y).toFixed(6)}° ${points[1].y >= 0 ? 'N' : 'S'}, ${Math.abs(points[1].x).toFixed(6)}° ${points[1].x >= 0 ? 'E' : 'W'}`]);
            }
        } else if (isPoint && points[0]) {
            rows.push(['Latitude', `${Math.abs(points[0].y).toFixed(6)}° ${points[0].y >= 0 ? 'N' : 'S'}`]);
            rows.push(['Longitude', `${Math.abs(points[0].x).toFixed(6)}° ${points[0].x >= 0 ? 'E' : 'W'}`]);
        }

        let rowY = tableY + 22;
        rows.forEach(([label, value], i) => {
            const bg = i % 2 === 0 ? '#f8f9f4' : '#ffffff';
            doc.rect(50, rowY, 495, 24).fill(bg);
            doc.fillColor('#6b7355').fontSize(10).font('Helvetica')
                .text(label, 60, rowY + 7);
            doc.fillColor('#1a1f12').fontSize(10).font('Helvetica-Bold')
                .text(value, 300, rowY + 7);
            rowY += 24;
        });

        // ── Boundary Coordinates (area only) ─────────────────────────────────────
        if (isArea && points.length > 0) {
            rowY += 16;
            if (rowY > 680) { doc.addPage(); rowY = 50; }

            doc.fillColor('#1a1f12').fontSize(12).font('Helvetica-Bold')
                .text('Boundary Coordinates', 50, rowY);
            rowY += 20;

            doc.rect(50, rowY, 495, 22).fill('#256b5a');
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
                .text('Point', 60, rowY + 6)
                .text('Latitude', 160, rowY + 6)
                .text('Longitude', 310, rowY + 6);
            rowY += 22;

            points.slice(0, 25).forEach((p, i) => {
                if (rowY > 740) { doc.addPage(); rowY = 50; }
                const bg = i % 2 === 0 ? '#f8f9f4' : '#ffffff';
                doc.rect(50, rowY, 495, 20).fill(bg);
                doc.fillColor('#1a1f12').fontSize(9).font('Helvetica')
                    .text(`Point ${i + 1}`, 60, rowY + 5)
                    .text(`${Math.abs(p.y).toFixed(6)}° ${p.y >= 0 ? 'N' : 'S'}`, 160, rowY + 5)
                    .text(`${Math.abs(p.x).toFixed(6)}° ${p.x >= 0 ? 'E' : 'W'}`, 310, rowY + 5);
                rowY += 20;
            });

            if (points.length > 25) {
                doc.fillColor('#6b7355').fontSize(9).font('Helvetica')
                    .text(`... and ${points.length - 25} more points`, 60, rowY + 6);
            }
        }

        // ── Footer ────────────────────────────────────────────────────────────────
        doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill('#f4f7ee');
        doc.fillColor('#6b7355').fontSize(9).font('Helvetica')
            .text(
                `Generated by FieldMeasure Pro · ${new Date().toLocaleString('en-IN')}`,
                50, doc.page.height - 25
            );

        doc.end();
    });
}