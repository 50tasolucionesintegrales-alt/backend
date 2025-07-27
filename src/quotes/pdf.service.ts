// src/quotes/pdf.service.ts
import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { Quote } from './entities/quote.entity';
import { readFile } from 'fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { join } from 'path';
import { Readable } from 'stream';
import { format } from 'date-fns';

@Injectable()
export class PdfService {
    constructor(private readonly cloudinary: CloudinaryService) { }

    /* Genera los 3 PDF y los sube */
    async generateAndUpload(quote: Quote) {
        const [buf1, buf2, buf3] = await Promise.all([
            this.buildPdf(quote, 1),
            this.buildPdf(quote, 2),
            this.buildPdf(quote, 3),
        ]);

        const [up1, up2, up3] = await Promise.all([
            this.upload(buf1, `quote_${quote.id}_m1`),
            this.upload(buf2, `quote_${quote.id}_m2`),
            this.upload(buf3, `quote_${quote.id}_m3`),
        ]);

        const publicId1 = up1.public_id;          // quotes/quote_1_m1
        const publicId2 = up2.public_id;
        const publicId3 = up3.public_id;

        const id1 = up1.public_id;          // «quotes/quote_1_m1»
        const id2 = up2.public_id;
        const id3 = up3.public_id;
        return {
            id1, id2, id3,
            url1: this.cloudinary.generateSignedPdfUrl(publicId1),
            url2: this.cloudinary.generateSignedPdfUrl(publicId2),
            url3: this.cloudinary.generateSignedPdfUrl(publicId3),
        };
    }

    /* ---------- helpers ---------- */

    private upload(buffer: Buffer, filename: string) {
        const stream = Readable.from(buffer);
        return this.cloudinary.uploadBuffer(stream, 'quotes', filename); // raw
    }

    /** Construye PDF para margen 1, 2 o 3 */
    private async buildPdf(quote: Quote, m: 1 | 2 | 3): Promise<Buffer> {
        const tpl = await readFile(
            join(process.cwd(), 'src', 'assets', 'pdf', `quote_m${m}.pdf`),
        );

        const pdfDoc = await PDFDocument.load(tpl);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const page = pdfDoc.getPage(0);

        /* Título */
        page.drawText(`Cotización: ${quote.titulo}`, { x: 50, y: 760, size: 14, font });

        // Si quieres, muestra también la descripción en la cabecera
        if (quote.descripcion) {
            page.drawText(quote.descripcion, { x: 50, y: 740, size: 10, font });
        }
        /* Fecha de envío (o creación si aún draft) */
        const fecha = quote.sentAt ?? quote.createdAt;
        page.drawText(`Fecha: ${format(fecha, 'dd/MM/yyyy')}`, { x: 400, y: 760, size: 10, font });

        /* Columnas */
        const X_NOMBRE = 50;
        const X_CANT = 270;
        const X_UNIT = 330;
        const X_SUB = 400;

        /* Tabla */
        let y = 720;
        let total = 0;

        quote.items.forEach((it, idx) => {
            /* Nombre del ítem: producto o servicio */
            const nombre = it.product?.nombre ?? it.service?.nombre ?? '—';

            /* Precio unitario */
            const precio = Number(
                it[`precioFinal${m}` as const] ??
                (
                    Number(it.costo_unitario) *
                    (1 + Number(it[`margenPct${m}`]) / 100)
                ).toFixed(2),
            );

            /* Subtotal */
            const subtotal = Number(
                it[`subtotal${m}` as const] ??
                (precio * it.cantidad).toFixed(2),
            );

            total += subtotal;

            /* Dibujar fila */
            page.drawText(`${idx + 1}. ${nombre}`, { x: X_NOMBRE, y, font });
            page.drawText(String(it.cantidad), { x: X_CANT, y, font });
            page.drawText(`$${precio.toFixed(2)}`, { x: X_UNIT, y, font });
            page.drawText(`$${subtotal.toFixed(2)}`, { x: X_SUB, y, font });
            y -= 18;
        });

        /* Total */
        page.drawText(`TOTAL: $${total.toFixed(2)}`, {
            x: X_SUB,
            y: y - 20,
            size: 12,
            font,
        });

        return Buffer.from(await pdfDoc.save());
    }
}
