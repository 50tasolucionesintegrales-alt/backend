import { Injectable } from '@nestjs/common';
import { HtmlPdfService3 } from './html-pdf.service';
import { Quote } from 'src/quotes/entities/quote.entity';

type Emp = 3;

type MetaIn = {
  destinatario: string;
  descripcion: string;
  fecha: string;
  folio: string;
  lugar?: string;
  presente?: string;
  condiciones?: string;
  incluirFirma?: boolean;
  firmanteNombre?: string;
};

const FIRMA_BY_EMPRESA: Record<Emp, string> = {
  3: 'assets/firma_emp3.png',
};

const FIRMA_FALLBACK = 'assets/firma.png';

@Injectable()
export class PdfService3 {
  constructor(private readonly html: HtmlPdfService3) { }

  async generateOneBuffer(
    quote: Quote,
    empresa: Emp,
    meta: MetaIn
  ): Promise<Buffer> {
    const { items, ivaPct, subtotales } = this.computeTotals(quote, empresa);

    const lugar = meta.lugar?.trim() || 'Pachuca de Soto, Hidalgo';
    const presente = (meta.presente?.trim() || 'PRESENTE.');
    const condiciones = meta.condiciones ?? '';
    const incluirFirma = meta.incluirFirma ?? false;
    const firmanteNombre = meta.firmanteNombre?.trim() || '';

    const totalEnLetra = this.numeroEnLetrasMXN(subtotales.total);

    const firmaUrl = incluirFirma
    ? (FIRMA_BY_EMPRESA[empresa] || FIRMA_FALLBACK)
    : '';

    const data = {
      brand: this.brandByEmpresa(empresa),
      titulo: quote.titulo,
      destinatario: meta.destinatario,
      descripcion: meta.descripcion,
      fecha: meta.fecha,
      folio: meta.folio,
      lugar,
      presente,
      condiciones,
      incluirFirma,
      firmaUrl,
      firmanteNombre,
      items,
      ivaPct,
      totales: {
        subtotal: subtotales.subtotal,
        iva: subtotales.iva,
        total: subtotales.total,
      },
      totalEnLetra
    };

    const template = `empresa-${empresa}`;
    return this.html.renderToPdf(template, data);
  }

  private brandByEmpresa(empresa: Emp) {
    const map: Record<Emp, { color: string; logo: string }> = {
      3: { color: '#0E927A', logo: '../assets/emp3.png' },
    };
    return map[empresa];
  }

  private computeTotals(quote: Quote, m: Emp) {
    const items = quote.items.map((it) => {
      const descripcion = it.product?.descripcion ?? it.service?.descripcion ?? 
                         it.product?.nombre ?? it.service?.nombre ?? '—';
      
      const unidad = (it as any).unidad ?? 'Pieza';
      const cantidad = Number(it.cantidad);

      const unitario = Number(
        (it as any)[`precioFinal${m}`] ??
        (
          Number(it.costo_unitario) *
          (1 + Number((it as any)[`margenPct${m}`] ?? 0) / 100)
        ).toFixed(2)
      );

      const parcial = +(
        unitario * cantidad
      ).toFixed(2);

      return { 
        nombre: descripcion,
        unidad, 
        cantidad, 
        unitario, 
        parcial 
      };
    });

    const subtotal = +items
      .reduce((a, i) => a + i.parcial, 0)
      .toFixed(2);

    const ivaPct = Number(quote.ivaPct ?? 16);
    const iva = +(subtotal * (ivaPct / 100)).toFixed(2);
    const total = +(subtotal + iva).toFixed(2);

    return { items, ivaPct, subtotales: { subtotal, iva, total } };
  }

  private numeroEnLetrasMXN(n: number) {
    const entero = Math.floor(n);
    const cent = Math.round((n - entero) * 100);
    const letras =
      (entero === 0 ? 'CERO' : this.millonesALetras(entero)).trim();
    const centavos = cent.toString().padStart(2, '0');
    return `${letras} PESOS ${centavos}/100 M.N.`;
  }

  private unidades(n: number) {
    return [
      '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS',
      'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE',
      'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
      'DIECIOCHO', 'DIECINUEVE', 'VEINTE'
    ][n] ?? '';
  }

  private decenas(n: number) {
    if (n <= 20) return this.unidades(n);
    const d = Math.floor(n / 10);
    const u = n % 10;
    const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'][d];
    if (d === 2) return u ? `VEINTI${this.unidades(u).toLowerCase()}`.toUpperCase() : 'VEINTE';
    return u ? `${tens} Y ${this.unidades(u)}` : tens;
  }

  private centenas(n: number) {
    if (n < 100) return this.decenas(n);
    const c = Math.floor(n / 100);
    const r = n % 100;
    const hundreds = [
      '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
      'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'
    ][c];
    if (n === 100) return 'CIEN';
    return r ? `${hundreds} ${this.decenas(r)}` : hundreds;
  }

  private miles(n: number) {
    if (n < 1000) return this.centenas(n);
    const m = Math.floor(n / 1000);
    const r = n % 1000;
    const mtxt = m === 1 ? 'MIL' : `${this.centenas(m)} MIL`;
    return r ? `${mtxt} ${this.centenas(r)}` : mtxt;
  }

  private millonesALetras(n: number): string {
    if (n < 1_000_000) return this.miles(n);
    const mill = Math.floor(n / 1_000_000);
    const r = n % 1_000_000;
    const mtxt = mill === 1 ? 'UN MILLÓN' : `${this.miles(mill)} MILLONES`;
    return r ? `${mtxt} ${this.miles(r)}` : mtxt;
  }
}