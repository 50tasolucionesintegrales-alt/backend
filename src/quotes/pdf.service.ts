import { Injectable } from '@nestjs/common';
import { Quote } from './entities/quote.entity';
import { readFile } from 'fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { join } from 'path';
import { Readable } from 'stream';
import { format } from 'date-fns';

@Injectable()
export class PdfService {
    async generateOneBuffer(quote: Quote, m: 1 | 2 | 3 | 4 | 5 | 6 | 7): Promise<Buffer> {
        return this.buildPdf(quote, m);
    }

    async generateManyBuffers(quote: Quote, empresas: number[]) {
        const valid = [...new Set(empresas)]
            .filter(n => Number.isInteger(n) && n >= 1 && n <= 7) as (1 | 2 | 3 | 4 | 5 | 6 | 7)[];
        const bufs = await Promise.all(valid.map(m => this.buildPdf(quote, m)));
        return valid.map((m, i) => ({
            name: `quote_${quote.id}_m${m}.pdf`,
            buffer: bufs[i],
        }));
    }

    /** Construye PDF para empresa/margen 1..7 */
    private async buildPdf(quote: Quote, m: 1 | 2 | 3 | 4 | 5 | 6 | 7): Promise<Buffer> {
        const tpl = await readFile(join(process.cwd(), 'src', 'assets', 'pdf', `quote_m${m}.pdf`));

        const pdfDoc = await PDFDocument.load(tpl);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const page = pdfDoc.getPage(0);

        // Header
        page.drawText(`Cotización: ${quote.titulo}`, { x: 50, y: 760, size: 14, font });
        if (quote.descripcion) page.drawText(quote.descripcion, { x: 50, y: 740, size: 10, font });
        const fecha = quote.sentAt ?? quote.createdAt;
        page.drawText(`Fecha: ${format(fecha, 'dd/MM/yyyy')}`, { x: 400, y: 760, size: 10, font });

        // Tabla
        const X_NOMBRE = 50, X_UNIDAD = 270, X_CANT = 340, X_UNIT = 400, X_SUB = 480;
        page.drawText('Descripción', { x: X_NOMBRE, y: 720, size: 10, font });
        page.drawText('Unidad', { x: X_UNIDAD, y: 720, size: 10, font });
        page.drawText('Cant.', { x: X_CANT, y: 720, size: 10, font });
        page.drawText('P. Unit.', { x: X_UNIT, y: 720, size: 10, font });
        page.drawText('Subtotal', { x: X_SUB, y: 720, size: 10, font });

        let y = 700;
        let subtotalAcum = 0;

        quote.items.forEach((it, idx) => {
            const nombre = it.product?.nombre ?? it.service?.nombre ?? '—';
            const unidad = (it as any).unidad ?? 'pieza';

            const precio = Number(
                (it as any)[`precioFinal${m}`] ??
                (
                    Number(it.costo_unitario) *
                    (1 + Number((it as any)[`margenPct${m}`] ?? 0) / 100)
                ).toFixed(2)
            );
            const subtotal = Number(
                (it as any)[`subtotal${m}`] ?? (precio * Number(it.cantidad)).toFixed(2)
            );
            subtotalAcum += subtotal;

            page.drawText(`${idx + 1}. ${nombre}`, { x: X_NOMBRE, y, size: 10, font });
            page.drawText(String(unidad), { x: X_UNIDAD, y, size: 10, font });
            page.drawText(String(it.cantidad), { x: X_CANT, y, size: 10, font });
            page.drawText(`$${precio.toFixed(2)}`, { x: X_UNIT, y, size: 10, font });
            page.drawText(`$${subtotal.toFixed(2)}`, { x: X_SUB, y, size: 10, font });
            y -= 16;
        });

        const ivaPct = Number(quote.ivaPct ?? 16);
        const iva = +(subtotalAcum * (ivaPct / 100)).toFixed(2);
        const totalFinal = +(subtotalAcum + iva).toFixed(2);

        y -= 10;
        page.drawText(`SUBTOTAL: $${subtotalAcum.toFixed(2)}`, { x: X_SUB - 40, y, size: 11, font });
        y -= 16;
        page.drawText(`IVA (${ivaPct.toFixed(2)}%): $${iva.toFixed(2)}`, { x: X_SUB - 60, y, size: 11, font });
        y -= 16;
        page.drawText(`TOTAL: $${totalFinal.toFixed(2)}`, { x: X_SUB - 20, y, size: 12, font });

        return Buffer.from(await pdfDoc.save());
    }
}