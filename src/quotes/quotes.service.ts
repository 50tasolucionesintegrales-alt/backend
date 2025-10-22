import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { Product } from 'src/products/entities/product.entity';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PdfService } from 'src/pdf/pdf.service';
import { Service } from 'src/services/entities/service.entity';
import { Role } from 'src/common/enums/roles.enum';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote) private quotesRepo: Repository<Quote>,
    @InjectRepository(QuoteItem) private itemsRepo: Repository<QuoteItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
    private readonly pdf: PdfService,
  ) { }

  async loadForPdf(id: string) {
    const quote = await this.quotesRepo.findOne({
      where: { id },
      relations: ['items', 'items.product', 'items.service'],
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    return quote;
  }

  private sumSubtotals(quote: Quote, field: `subtotal${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`) {
    return quote.items.reduce((a, it) => a + Number((it as any)[field] ?? 0), 0);
  }

  /* ───────── Crear borrador ───────── */
  async createDraft(userId: string, tipo: 'productos' | 'servicios', title: string, description?: string,) {
    const q = this.quotesRepo.create({
      user: { id: userId } as any,
      titulo: title,
      descripcion: description ?? null,
      tipo
    });
    const saved = await this.quotesRepo.save(q);
    return { message: 'Borrador creado', quote: saved };
  }

  /* ───────── Agregar ítems ───────── */
  async addItems(quoteId: string, dto: AddItemsDto) {
    const quote = await this.quotesRepo.findOne({ where: { id: quoteId }, relations: ['items'] });
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    for (const i of dto.items) {
      // validación de tipo
      if ((quote.tipo === 'productos' && i.tipo !== 'producto') ||
        (quote.tipo === 'servicios' && i.tipo !== 'servicio')) {
        throw new ForbiddenException(`Esta cotización es de ${quote.tipo}; no puedes añadir un ${i.tipo}.`);
      }

      let product: Product | null = null;
      let service: Service | null = null;
      if (i.tipo === 'producto') {
        product = await this.productRepo.findOne({ where: { id: String(i.productId) } });
        if (!product) throw new NotFoundException(`Producto ${i.productId} inexistente`);
      } else {
        service = await this.serviceRepo.findOne({ where: { id: String(i.serviceId) } });
        if (!service) throw new NotFoundException(`Servicio ${i.serviceId} inexistente`);
      }

      const costo = +Number(i.costoUnitario).toFixed(2);
      const cantidad = Number(i.cantidad);
      const unidad = i.unidad?.trim() || 'pieza';

      const item = this.itemsRepo.create({
        quote,
        product,
        service,
        cantidad,
        costo_unitario: costo,
        unidad
      });

      // precálculo de sub/precios cuando haya margen definido
      const apply = (m: number | null | undefined, idx: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10) => {
        if (m === null || m === undefined) return;
        const price = +(costo * (1 + m / 100)).toFixed(2);
        (item as any)[`precioFinal${idx}`] = price;
        (item as any)[`subtotal${idx}`] = +(price * cantidad).toFixed(2);
      };
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((k) => apply((item as any)[`margenPct${k}`], k as any));

      await this.itemsRepo.save(item);
    }

    const updated = await this.quotesRepo.findOne({
      where: { id: quoteId },
      relations: ['items', 'items.product', 'items.service'],
    });
    return { message: 'Ítems agregados/actualizados', quote: updated };
  }

  /* ───────── Actualizar ítem ───────── */
  async updateItem(itemId: string, dto: UpdateItemDto) {
    const item = await this.itemsRepo.findOne({
      where: { id: itemId },
      relations: ['quote'], // puedes añadir product/category/service si lo usas en la respuesta
    });
    if (!item) throw new NotFoundException('Item no encontrado');
    if (item.quote.status !== 'draft') throw new ForbiddenException('La cotización ya fue enviada');

    // 1) Aplicar cambios del DTO al ítem
    Object.entries(dto).forEach(([k, v]) => {
      if (v !== undefined) (item as any)[k] = v;
    });

    // 2) Recalcular PU y subtotal del ítem para 1..10
    const cost = Number(item.costo_unitario) || 0;
    const qty = Number(item.cantidad) || 0;

    const recalc = (m: number | null | undefined, idx: number) => {
      if (m === null || m === undefined) return;
      const price = +(cost * (1 + (Number(m) || 0) / 100)).toFixed(2);
      (item as any)[`precioFinal${idx}`] = price;
      (item as any)[`subtotal${idx}`] = +(price * qty).toFixed(2);
    };

    for (let i = 1; i <= 10; i++) {
      recalc((item as any)[`margenPct${i}`], i);
    }

    const saved = await this.itemsRepo.save(item);

    // 3) Recalcular totales del QUOTE (1..10)
    //    - carga todos los ítems de la cotización
    // Cargar quote + todos los items de la cotización
    const quoteId = saved.quote.id;
    const [quote, items] = await Promise.all([
      this.quotesRepo.findOne({ where: { id: quoteId } }),
      this.itemsRepo.find({ where: { quote: { id: quoteId } } }),
    ]);

    if (!quote) throw new NotFoundException('Quote no encontrada');

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const ivaPct = Number(quote.ivaPct ?? 0);

    for (let i = 1; i <= 10; i++) {
      // Subtotales válidos para el formato i (sólo números finitos)
      const subtotals = items
        .map(it => Number((it as any)[`subtotal${i}`]))
        .filter(n => Number.isFinite(n));

      // Si NADIE usa el formato i → todo a 0 y continúa
      if (subtotals.length === 0) {
        (quote as any)[`totalMargen${i}`] = 0;
        (quote as any)[`totalIva${i}`] = 0;
        (quote as any)[`totalFinal${i}`] = 0;
        continue;
      }

      // Suma de subtotales y totales con IVA
      const subtotal = round2(subtotals.reduce((a, b) => a + b, 0));
      const totalIva = round2(subtotal * ivaPct / 100);
      const totalFinal = round2(subtotal + totalIva);

      // Margen total: SOLO cuando el item tiene precioFinal{i} válido
      const totalMargen = round2(
        items.reduce((acc, it) => {
          const price = Number((it as any)[`precioFinal${i}`]);
          const cost = Number((it as any).costo_unitario);
          const qty = Number((it as any).cantidad);
          if (!Number.isFinite(price) || !Number.isFinite(cost) || !Number.isFinite(qty)) return acc;
          return acc + (price - cost) * qty;
        }, 0)
      );

      (quote as any)[`totalMargen${i}`] = totalMargen;
      (quote as any)[`totalIva${i}`] = totalIva;
      (quote as any)[`totalFinal${i}`] = totalFinal;
    }

    // Guardar el quote con los totales recalculados
    await this.quotesRepo.save(quote);

    // (Opcional pero recomendado) Recargar el ítem con relaciones frescas para responder
    const fresh = await this.itemsRepo.findOne({
      where: { id: saved.id },
      relations: ['quote'], // añade product/service si los necesitas en la respuesta
    });

    return { message: 'Ítem actualizado', item: fresh };
  }


  /* ───────── Enviar cotización (genera PDFs) ───────── */
  async sendQuote(id: string) {
    const quote = await this.quotesRepo.findOne({
      where: { id },
      relations: ['items', 'items.product', 'items.service'],
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    if (quote.status !== 'draft') throw new ForbiddenException('La cotización ya fue enviada');

    const subtotales: Record<number, number> = {};
    ( [1,2,3,4,5,6,7,8,9,10] as const ).forEach(k => {
      const sub = +this.sumSubtotals(quote, `subtotal${k}`).toFixed(2);
      subtotales[k] = sub;
      (quote as any)[`totalMargen${k}`] = sub; // mantenemos "totalMargen*" como subtotal pre-IVA
    });

    const ivaPct = Number(quote.ivaPct ?? 16);
    ( [1,2,3,4,5,6,7,8,9,10] as const ).forEach(k => {
      const iva = +(subtotales[k] * (ivaPct / 100)).toFixed(2);
      const total = +(subtotales[k] + iva).toFixed(2);
      (quote as any)[`totalIva${k}`] = iva;
      (quote as any)[`totalFinal${k}`] = total;
    });

    quote.sentAt = new Date();
    quote.status = 'sent';
    const saved = await this.quotesRepo.save(quote);

    return {
      message: 'Cotización enviada.',
      ivaPct,
      totales: {
        1: { subtotal: subtotales[1], iva: (saved as any).totalIva1, total: (saved as any).totalFinal1 },
        2: { subtotal: subtotales[2], iva: (saved as any).totalIva2, total: (saved as any).totalFinal2 },
        3: { subtotal: subtotales[3], iva: (saved as any).totalIva3, total: (saved as any).totalFinal3 },
        4: { subtotal: subtotales[4], iva: (saved as any).totalIva4, total: (saved as any).totalFinal4 },
        5: { subtotal: subtotales[5], iva: (saved as any).totalIva5, total: (saved as any).totalFinal5 },
        6: { subtotal: subtotales[6], iva: (saved as any).totalIva6, total: (saved as any).totalFinal6 },
        7: { subtotal: subtotales[7], iva: (saved as any).totalIva7, total: (saved as any).totalFinal7 },
        8: { subtotal: subtotales[8], iva: (saved as any).totalIva8, total: (saved as any).totalFinal8 },
        9: { subtotal: subtotales[9], iva: (saved as any).totalIva9, total: (saved as any).totalFinal9 },
        10: { subtotal: subtotales[10], iva: (saved as any).totalIva10, total: (saved as any).totalFinal10 },
      },
    };
  }

  /* ───────── Obtener una cotización ───────── */
  async getOne(id: string) {
    const q = await this.quotesRepo.findOne({
      where: { id },
      relations: ['items', 'items.product'],
    });
    if (!q) throw new NotFoundException('Cotización no encontrada');
    return q;
  }

  /* 1 ── listar todas las enviadas */
  async listSent() {
    const quotes = await this.quotesRepo.find({
      where: { status: 'sent' },
      relations: ['items', 'items.product', 'items.service'],
      order: { sentAt: 'DESC' },
    });

    return quotes;                        // o { message:'Enviadas', quotes }
  }

  /* 2 ── borradores de un usuario */
  async listUserDrafts(userId: string) {
    return this.quotesRepo.find({
      where: {
        status: 'draft',
        user: { id: userId } as any,
      },
      relations: ['items', 'items.product', 'items.service'],
      order: { createdAt: 'DESC' },
    });
  }

  /* 5‑B. Mis cotizaciones enviadas (nuevo) */
  async listUserSent(userId: string) {
    const quotes = await this.quotesRepo.find({
      where: { status: 'sent', user: { id: userId } as any },
      relations: ['items', 'items.product', 'items.service'],
      order: { sentAt: 'DESC' },
    });
    return quotes;
  }

  /* 3 ── reabrir para edición */
  async reopenQuote(id: string, user: { sub: string | number; roles?: any[] }) {
    const quote = await this.quotesRepo.findOne({
      where: { id },
      relations: ['user', 'items', 'items.product', 'items.service'],
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    /* ---------- Permisos ---------- */
    const isOwner =
      quote.user && String(quote.user.id) === String(user.sub);

    const roles: string[] = Array.isArray(user.roles) ? user.roles.map(String) : [];
    const isAdmin = roles.some(
      (r) =>
        r === Role.Admin ||               // enum →
        r.toLowerCase() === 'admin',       // string "Admin"
    );

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Sin permisos para editar esta cotización');
    }

    /* ---------- Ya es borrador ---------- */
    if (quote.status === 'draft') return quote;

    /* ---------- Volver a draft ---------- */
    quote.status = 'draft';
    quote.sentAt = null;

    const reopened = await this.quotesRepo.save(quote);
    return { message: 'Cotización vuelta a borrador', quote: reopened };
  }

  async deleteQuote(id: string) {
    const quote = await this.quotesRepo.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    /* ── borrar cotización (items → cascade) ── */
    await this.quotesRepo.delete(id);
    return { message: 'Cotización eliminada' };
  }

  async removeItem(itemId: string) {
    const item = await this.itemsRepo.findOne({
      where: { id: itemId },
      relations: ['quote'],
    });
    if (!item) throw new NotFoundException('Ítem no encontrado');

    if (item.quote.status !== 'draft')
      throw new ForbiddenException('Solo puede eliminarse en borrador');

    await this.itemsRepo.delete(itemId);
    return { message: 'Ítem eliminado' };
  }
}
