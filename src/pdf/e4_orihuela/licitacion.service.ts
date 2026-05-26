import { Injectable } from '@nestjs/common';
import { HtmlLicitacionService4 } from './html-licitacion.service';
import { Quote } from 'src/quotes/entities/quote.entity';
import { GenerateLicitacionPdfDto } from 'src/quotes/dto/generate-licitacion-pdf.dto';

type Emp = 4;

const PREFIJO_LICITACION  = 'EA-913003989-';
const PRESENTE            = 'Presente';
const FIRMANTE_EMPRESA_4  = 'Adrián Orihuela Rodriguez';
const COND_PAGO           = '"Según convocatoria a la Licitación Pública y Junta de Aclaraciones"';
const COND_VIGENCIA       = '"Según convocatoria a la Licitación Pública y Junta de Aclaraciones"';
const COND_PLAZO          = '"Según convocatoria a la Licitación Pública y Junta de Aclaraciones"';
const COND_LUGAR          = '"Según convocatoria a la Licitación Pública y Junta de Aclaraciones"';

@Injectable()
export class LicitacionService4 {
  constructor(private readonly html: HtmlLicitacionService4) {}

  async generateBuffer(quote: Quote, dto: GenerateLicitacionPdfDto): Promise<Buffer> {
    const esServicios = quote.tipo === 'servicios';
    const empresa = 4 as Emp;

    const itemMap = new Map(quote.items.map((it) => [String(it.id), it]));
    const rows    = this.buildRows(quote, dto, itemMap, empresa);

    const lugar            = dto.lugar?.trim() || 'Pachuca de Soto, Hidalgo';
    const documentoVI      = dto.documentoVI?.trim() || 'Documento I';
    const numeroLicitacion = `${PREFIJO_LICITACION}${dto.sufijoLicitacion}`;
    const anexo            = dto.tipo === 'tecnica' ? 'Anexo 1' : 'Anexo 2';

    const baseData = {
      brand:            this.brandByEmpresa(empresa),
      numeroLicitacion,
      tituloLicitacion: dto.tituloLicitacion,
      documentoVI,
      anexo,
      fecha:            dto.fecha,
      lugar,
      destinatario:     dto.destinatario,
      presente:         PRESENTE,
      nombreLicitante:  dto.nombreLicitante,
      rows,
      condicionPago:    COND_PAGO,
      vigencia:         COND_VIGENCIA,
      plazoCondiciones: COND_PLAZO,
      lugarEntrega:     COND_LUGAR,
      firmanteNombre:   dto.firmanteNombre || '',
      firmanteCargo:    dto.firmanteCargo  || '',
      firmanteEmpresa:  FIRMANTE_EMPRESA_4,
    };

    if (dto.tipo === 'tecnica') {
      const data = { ...baseData, tipoDocumento: 'Propuesta Técnica' };
      const template = esServicios
        ? 'empresa-4-licitacion-tecnica-servicios'
        : 'empresa-4-licitacion-tecnica';
      return this.html.renderToPdf(template, data);
    }

    const { subtotal, iva, total, totalEnLetra } = this.computeEconomicaTotals(
      quote, dto, itemMap, empresa,
    );
    const conceptoResumen = this.buildConceptoResumen(dto);

    const data = {
      ...baseData,
      tipoDocumento:  'Propuesta Económica',
      anexoNumero:    '2',
      conceptoResumen,
      montoTotal:     total,
      subtotal,
      iva,
      total,
      ivaPct:         Number(quote.ivaPct ?? 16),
      totalEnLetra,
    };

    const template = esServicios
      ? 'empresa-4-licitacion-economica-servicios'
      : 'empresa-4-licitacion-economica';
    return this.html.renderToPdf(template, data);
  }

  private buildRows(
    quote:   Quote,
    dto:     GenerateLicitacionPdfDto,
    itemMap: Map<string, any>,
    empresa: number,
  ) {
    const rows: any[] = [];
    for (const grupo of dto.grupos) {
      const rowspan = grupo.subconceptos.length;
      grupo.subconceptos.forEach((sub, subIdx) => {
        const item = itemMap.get(String(sub.itemId));
        if (!item) return;
        const descripcion =
          item.product?.descripcion ?? item.service?.descripcion ??
          item.product?.nombre      ?? item.service?.nombre      ?? '—';
        const unidad   = item.unidad ?? (quote.tipo === 'servicios' ? 'Servicio' : 'Pieza');
        const cantidad = Number(item.cantidad);
        const precioUnitario = Number(
          (item as any)[`precioFinal${empresa}`] ??
            (Number(item.costo_unitario) *
             (1 + Number((item as any)[`margenPct${empresa}`] ?? 0) / 100)).toFixed(2),
        );
        const subtotal = +(precioUnitario * cantidad).toFixed(2);
        rows.push({
          isFirstInConcepto: subIdx === 0,
          concepto:          grupo.concepto,
          rowspan,
          subconcepto:       subIdx + 1,
          descripcion,
          unidad,
          cantidad,
          precioUnitario:    +precioUnitario.toFixed(2),
          subtotal,
          marca:             sub.marca || '',
        });
      });
    }
    return rows;
  }

  private buildConceptoResumen(dto: GenerateLicitacionPdfDto): string {
    if (dto.grupos.length === 1) {
      const total = dto.grupos[0].subconceptos.length;
      return `1 con ${total} subconcepto${total !== 1 ? 's' : ''}`;
    }
    return dto.grupos
      .map((g) => `${g.concepto} con ${g.subconceptos.length} subconceptos`)
      .join(', ');
  }

  private computeEconomicaTotals(
    quote:   Quote,
    dto:     GenerateLicitacionPdfDto,
    itemMap: Map<string, any>,
    empresa: number,
  ) {
    let subtotalSum = 0;
    for (const grupo of dto.grupos) {
      for (const sub of grupo.subconceptos) {
        const item = itemMap.get(String(sub.itemId));
        if (!item) continue;
        const precioUnitario = Number(
          (item as any)[`precioFinal${empresa}`] ??
            (Number(item.costo_unitario) *
             (1 + Number((item as any)[`margenPct${empresa}`] ?? 0) / 100)).toFixed(2),
        );
        subtotalSum += +(precioUnitario * Number(item.cantidad)).toFixed(2);
      }
    }
    const subtotal     = +subtotalSum.toFixed(2);
    const ivaPct       = Number(quote.ivaPct ?? 16);
    const iva          = +(subtotal * (ivaPct / 100)).toFixed(2);
    const total        = +(subtotal + iva).toFixed(2);
    const totalEnLetra = this.numeroEnLetrasMXN(total);
    return { subtotal, iva, total, totalEnLetra };
  }

  private brandByEmpresa(empresa: Emp) {
    return { color: '#245fa7', logo: '../assets/emp4.png' };
  }

  private numeroEnLetrasMXN(n: number) {
    const entero   = Math.floor(n);
    const cent     = Math.round((n - entero) * 100);
    const letras   = (entero === 0 ? 'CERO' : this.millonesALetras(entero)).trim();
    const centavos = cent.toString().padStart(2, '0');
    return `${letras} PESOS ${centavos}/100 M.N.`;
  }

  private unidades(n: number) {
    return ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE',
      'DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE',
      'DIECIOCHO','DIECINUEVE','VEINTE'][n] ?? '';
  }
  private decenas(n: number) {
    if (n <= 20) return this.unidades(n);
    const d = Math.floor(n / 10), u = n % 10;
    const tens = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA',
      'SESENTA','SETENTA','OCHENTA','NOVENTA'][d];
    if (d === 2) return u ? `VEINTI${this.unidades(u).toLowerCase()}`.toUpperCase() : 'VEINTE';
    return u ? `${tens} Y ${this.unidades(u)}` : tens;
  }
  private centenas(n: number) {
    if (n < 100) return this.decenas(n);
    const c = Math.floor(n / 100), r = n % 100;
    const h = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS',
      'QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'][c];
    if (n === 100) return 'CIEN';
    return r ? `${h} ${this.decenas(r)}` : h;
  }
  private miles(n: number) {
    if (n < 1000) return this.centenas(n);
    const m = Math.floor(n / 1000), r = n % 1000;
    const t = m === 1 ? 'MIL' : `${this.centenas(m)} MIL`;
    return r ? `${t} ${this.centenas(r)}` : t;
  }
  private millonesALetras(n: number): string {
    if (n < 1_000_000) return this.miles(n);
    const mill = Math.floor(n / 1_000_000), r = n % 1_000_000;
    const t = mill === 1 ? 'UN MILLÓN' : `${this.miles(mill)} MILLONES`;
    return r ? `${t} ${this.miles(r)}` : t;
  }
}