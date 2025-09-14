import { Injectable } from '@nestjs/common';
import { HtmlPdfService } from './html-pdf.service';
import { Quote } from 'src/quotes/entities/quote.entity';

type Emp = 1 | 2 | 3 | 4 | 5 | 6 | 7;

@Injectable()
export class PdfService {
  constructor(private readonly html: HtmlPdfService) { }

  async generateOneBuffer(
    quote: Quote,
    empresa: 1 | 2 | 3 | 4 | 5 | 6 | 7,
    meta: { destinatario: string; descripcion: string; fecha: string }
  ): Promise<Buffer> {
    const { items, ivaPct, subtotales } = this.computeTotals(quote, empresa);

    const data = {
      brand: this.brandByEmpresa(empresa),
      titulo: quote.titulo,
      destinatario: meta.destinatario,
      descripcion: meta.descripcion,
      fecha: meta.fecha,   // 👈 usar la que viene del DTO
      items,
      ivaPct,
      totales: {
        subtotal: subtotales.subtotal,
        iva: subtotales.iva,
        total: subtotales.total,
      },
    };

    const template = `empresa-${empresa}`;
    return this.html.renderToPdf(template, data);
  }

  private brandByEmpresa(empresa: Emp) {
    const map: Record<Emp, { color: string; logo: string; }> = {
      1: { color: '#C51B1B', logo: 'assets/emp1.png' },
      2: { color: '#0A59BF', logo: 'assets/emp2.png' },
      3: { color: '#0E927A', logo: 'assets/emp3.png' },
      4: { color: '#7C3AED', logo: 'assets/emp4.png' },
      5: { color: '#DB2777', logo: 'assets/emp5.png' },
      6: { color: '#CA8A04', logo: 'assets/emp6.png' },
      7: { color: '#1F2937', logo: 'assets/emp7.png' },
    };
    return map[empresa];
  }

  private computeTotals(quote: Quote, m: Emp) {
    const items = quote.items.map((it) => {
      const nombre = it.product?.nombre ?? it.service?.nombre ?? '—';
      const unidad = (it as any).unidad ?? 'Pieza';
      const unitario = Number(
        (it as any)[`precioFinal${m}`] ??
        (Number(it.costo_unitario) * (1 + Number((it as any)[`margenPct${m}`] ?? 0) / 100)).toFixed(2)
      );
      const parcial = Number(
        (it as any)[`subtotal${m}`] ?? (unitario * Number(it.cantidad)).toFixed(2)
      );
      return { nombre, unidad, cantidad: Number(it.cantidad), unitario, parcial };
    });

    const subtotal = +items.reduce((a, i) => a + i.parcial, 0).toFixed(2);
    const ivaPct = Number(quote.ivaPct ?? 16);
    const iva = +(subtotal * (ivaPct / 100)).toFixed(2);
    const total = +(subtotal + iva).toFixed(2);
    return { items, ivaPct, subtotales: { subtotal, iva, total } };
  }
}
