import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { Product } from 'src/products/entities/product.entity';
import { Service } from 'src/services/entities/service.entity';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { BatchUpdateItemDto } from './dto/batch-update-item.dto';
import { Role } from 'src/common/enums/roles.enum';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote) private quotesRepo: Repository<Quote>,
    @InjectRepository(QuoteItem) private itemsRepo: Repository<QuoteItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
  ) { }

  async loadForPdf(id: string) {
    const quote = await this.quotesRepo.findOne({
      where: { id },
      relations: ['items', 'items.product', 'items.service'],
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    return quote;
  }

  private sumSubtotals(quote: Quote, field: `subtotal${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`) {
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

  /* ───────── Agregar ítems OPTIMIZADO ───────── */
  async addItems(quoteId: string, dto: AddItemsDto) {
    const quote = await this.quotesRepo.findOne({ where: { id: quoteId }, relations: ['items'] });
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    // Separar productos y servicios para hacer queries batch
    const productIds = dto.items.filter(i => i.tipo === 'producto').map(i => String(i.productId));
    const serviceIds = dto.items.filter(i => i.tipo === 'servicio').map(i => String(i.serviceId));
    
    // Cargar todos los productos y servicios en UNA sola query cada uno
    const [products, services] = await Promise.all([
      productIds.length ? this.productRepo.findBy({ id: In(productIds) }) : Promise.resolve([]),
      serviceIds.length ? this.serviceRepo.findBy({ id: In(serviceIds) }) : Promise.resolve([]),
    ]);
    
    const productMap = new Map(products.map(p => [p.id, p]));
    const serviceMap = new Map(services.map(s => [s.id, s]));

    const itemsToSave: QuoteItem[] = [];

    for (const i of dto.items) {
      if ((quote.tipo === 'productos' && i.tipo !== 'producto') ||
          (quote.tipo === 'servicios' && i.tipo !== 'servicio')) {
        throw new ForbiddenException(`Esta cotización es de ${quote.tipo}; no puedes añadir un ${i.tipo}.`);
      }

      let product: Product | null = null;
      let service: Service | null = null;
      
      if (i.tipo === 'producto') {
        product = productMap.get(String(i.productId)) || null;
        if (!product) throw new NotFoundException(`Producto ${i.productId} inexistente`);
      } else {
        service = serviceMap.get(String(i.serviceId)) || null;
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

      // precálculo de sub/precios
      const apply = (m: number | null | undefined, idx: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12) => {
        if (m === null || m === undefined) return;
        const price = +(costo * (1 + m / 100)).toFixed(2);
        (item as any)[`precioFinal${idx}`] = price;
        (item as any)[`subtotal${idx}`] = +(price * cantidad).toFixed(2);
      };
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach((k) => apply((item as any)[`margenPct${k}`], k as any));

      itemsToSave.push(item);
    }

    // Guardar todos los items en UNA sola query
    if (itemsToSave.length) {
      await this.itemsRepo.save(itemsToSave);
    }

    const updated = await this.quotesRepo.findOne({
      where: { id: quoteId },
      relations: ['items', 'items.product', 'items.service'],
    });
    return { message: 'Ítems agregados/actualizados', quote: updated };
  }

  private recalculateItem(item: QuoteItem) {
    const cost = Number(item.costo_unitario ?? 0);
    const qty = Number(item.cantidad ?? 0);
    const subtotalBase = cost * qty;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    for (let i = 1; i <= 12; i++) {
      const marginKey = `margenPct${i}` as keyof QuoteItem;
      const precioKey = `precioFinal${i}` as keyof QuoteItem;
      const subtotalKey = `subtotal${i}` as keyof QuoteItem;
      const gananciaKey = `ganancia${i}` as keyof any;
      const marginRaw = item[marginKey];
      
      if (marginRaw === null || marginRaw === undefined || marginRaw === 0) {
        (item as any)[precioKey] = round2(cost);
        (item as any)[subtotalKey] = round2(subtotalBase);
        (item as any)[gananciaKey] = 0;
        continue;
      }

      const margin = Number(marginRaw);
      const precioFinal = round2(cost * (1 + margin / 100));
      const subtotalConMargen = round2(precioFinal * qty);
      const ganancia = round2(subtotalConMargen - subtotalBase);
      
      (item as any)[precioKey] = precioFinal;
      (item as any)[subtotalKey] = subtotalConMargen;
      (item as any)[gananciaKey] = ganancia;
    }
  }

  private recalculateQuoteTotals(quote: Quote, items: QuoteItem[]) {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const ivaPct = Number(quote.ivaPct ?? 0);

    for (let i = 1; i <= 12; i++) {
      const lineTotals = items
        .map(it => {
          const price = Number((it as any)[`precioFinal${i}`]);
          const qty = Number((it as any).cantidad);
          if (!Number.isFinite(price) || !Number.isFinite(qty)) return NaN;
          return round2(price * qty);
        })
        .filter(n => Number.isFinite(n));

      if (lineTotals.length === 0) {
        (quote as any)[`totalMargen${i}`] = 0;
        (quote as any)[`totalIva${i}`] = 0;
        (quote as any)[`totalFinal${i}`] = 0;
        continue;
      }

      const subtotalFinal = round2(lineTotals.reduce((a, b) => a + b, 0));
      const totalIva = round2(subtotalFinal * ivaPct / 100);
      const totalFinal = round2(subtotalFinal + totalIva);
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
  }

  async updateQuoteItems(quoteId: string, dtos: BatchUpdateItemDto[]) {
    const quote = await this.quotesRepo.findOne({ where: { id: quoteId } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    if (quote.status !== 'draft') throw new ForbiddenException('La cotización ya fue enviada');

    const items = await this.itemsRepo.find({ 
      where: { quote: { id: quoteId } },
      relations: ['product', 'service']
    });
    const itemsMap = new Map(items.map(item => [item.id, item]));

    for (const dto of dtos) {
      const item = itemsMap.get(dto.id);
      if (!item) continue;

      if (dto.cantidad !== undefined) item.cantidad = dto.cantidad;
      if (dto.costo_unitario !== undefined) item.costo_unitario = dto.costo_unitario;
      
      const validateMargin = (margin: number | null | undefined): number | null => {
        if (margin === null || margin === undefined) return null;
        if (margin < 0) throw new ForbiddenException('Los márgenes no pueden ser negativos');
        return margin;
      };

      if (dto.margenPct1 !== undefined) item.margenPct1 = validateMargin(dto.margenPct1);
      if (dto.margenPct2 !== undefined) item.margenPct2 = validateMargin(dto.margenPct2);
      if (dto.margenPct3 !== undefined) item.margenPct3 = validateMargin(dto.margenPct3);
      if (dto.margenPct4 !== undefined) item.margenPct4 = validateMargin(dto.margenPct4);
      if (dto.margenPct5 !== undefined) item.margenPct5 = validateMargin(dto.margenPct5);
      if (dto.margenPct6 !== undefined) item.margenPct6 = validateMargin(dto.margenPct6);
      if (dto.margenPct7 !== undefined) item.margenPct7 = validateMargin(dto.margenPct7);
      if (dto.margenPct8 !== undefined) item.margenPct8 = validateMargin(dto.margenPct8);
      if (dto.margenPct9 !== undefined) item.margenPct9 = validateMargin(dto.margenPct9);
      if (dto.margenPct10 !== undefined) item.margenPct10 = validateMargin(dto.margenPct10);
      if (dto.margenPct11 !== undefined) item.margenPct11 = validateMargin(dto.margenPct11);
      if (dto.margenPct12 !== undefined) item.margenPct12 = validateMargin(dto.margenPct12);

      this.recalculateItem(item);
    }

    await this.itemsRepo.save(items);
    this.recalculateQuoteTotals(quote, items);
    await this.quotesRepo.save(quote);

    for (const item of items) {
      this.recalculateItem(item);
    }

    const updatedQuote = await this.quotesRepo.findOne({
      where: { id: quoteId },
      relations: ['items', 'items.product', 'items.service'],
    });

    return { 
      message: 'Ítems actualizados correctamente', 
      items: updatedQuote?.items || [] 
    };
  }

  async updateItem(itemId: string, dto: UpdateItemDto) {
    const item = await this.itemsRepo.findOne({
      where: { id: itemId },
      relations: ['quote'],
    });
    if (!item) throw new NotFoundException('Item no encontrado');

    const dtoForBatch: BatchUpdateItemDto = {
      ...dto,
      id: itemId,
    };

    await this.updateQuoteItems(item.quote.id, [dtoForBatch]);

    const fresh = await this.itemsRepo.findOne({
      where: { id: itemId },
      relations: ['quote'],
    });

    return { message: 'Ítem actualizado', item: fresh };
  }

  /* ───────── Enviar cotización OPTIMIZADO ───────── */
  async sendQuote(id: string) {
    // 1. Obtener solo lo necesario
    const quote = await this.quotesRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    if (quote.status !== 'draft') throw new ForbiddenException('La cotización ya fue enviada');

    // 2. Calcular subtotales usando los valores ya almacenados
    const subtotales: Record<number, number> = {};
    ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const).forEach(k => {
      const sub = +quote.items.reduce((a, it) => a + Number((it as any)[`subtotal${k}`] ?? 0), 0).toFixed(2);
      subtotales[k] = sub;
    });

    const ivaPct = Number(quote.ivaPct ?? 16);
    const totals: any = {};

    ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const).forEach(k => {
      const iva = +(subtotales[k] * (ivaPct / 100)).toFixed(2);
      const total = +(subtotales[k] + iva).toFixed(2);
      totals[`totalMargen${k}`] = subtotales[k];
      totals[`totalIva${k}`] = iva;
      totals[`totalFinal${k}`] = total;
    });

    // 3. Actualizar en UNA sola query usando QueryBuilder
    await this.quotesRepo
      .createQueryBuilder()
      .update()
      .set({
        status: 'sent',
        sentAt: new Date(),
        ...totals
      })
      .where("id = :id", { id })
      .execute();

    // 4. Obtener el resultado actualizado
    const saved = await this.quotesRepo.findOne({ where: { id } });

    return {
      message: 'Cotización enviada.',
      ivaPct,
      totales: {
        1: { subtotal: subtotales[1], iva: totals.totalIva1, total: totals.totalFinal1 },
        2: { subtotal: subtotales[2], iva: totals.totalIva2, total: totals.totalFinal2 },
        3: { subtotal: subtotales[3], iva: totals.totalIva3, total: totals.totalFinal3 },
        4: { subtotal: subtotales[4], iva: totals.totalIva4, total: totals.totalFinal4 },
        5: { subtotal: subtotales[5], iva: totals.totalIva5, total: totals.totalFinal5 },
        6: { subtotal: subtotales[6], iva: totals.totalIva6, total: totals.totalFinal6 },
        7: { subtotal: subtotales[7], iva: totals.totalIva7, total: totals.totalFinal7 },
        8: { subtotal: subtotales[8], iva: totals.totalIva8, total: totals.totalFinal8 },
        9: { subtotal: subtotales[9], iva: totals.totalIva9, total: totals.totalFinal9 },
        10: { subtotal: subtotales[10], iva: totals.totalIva10, total: totals.totalFinal10 },
        11: { subtotal: subtotales[11], iva: totals.totalIva11, total: totals.totalFinal11 },
        12: { subtotal: subtotales[12], iva: totals.totalIva12, total: totals.totalFinal12 }
      },
    };
  }

  /* ───────── Obtener una cotización OPTIMIZADO (carga solo lo necesario) ───────── */
  async getOne(id: string) {
    const q = await this.quotesRepo.findOne({
      where: { id },
      relations: {
        items: {
          product: true,
          service: true,
        },
      },
      select: {
        id: true, status: true, createdAt: true, sentAt: true,
        tipo: true, titulo: true, descripcion: true, ivaPct: true,
        totalMargen1: true, totalMargen2: true, totalMargen3: true, totalMargen4: true,
        totalMargen5: true, totalMargen6: true, totalMargen7: true, totalMargen8: true,
        totalMargen9: true, totalMargen10: true, totalMargen11: true, totalMargen12: true,
        totalIva1: true, totalIva2: true, totalIva3: true, totalIva4: true,
        totalIva5: true, totalIva6: true, totalIva7: true, totalIva8: true,
        totalIva9: true, totalIva10: true, totalIva11: true, totalIva12: true,
        totalFinal1: true, totalFinal2: true, totalFinal3: true, totalFinal4: true,
        totalFinal5: true, totalFinal6: true, totalFinal7: true, totalFinal8: true,
        totalFinal9: true, totalFinal10: true, totalFinal11: true, totalFinal12: true,
        items: {
          id: true, cantidad: true, unidad: true, costo_unitario: true,
          margenPct1: true, margenPct2: true, margenPct3: true, margenPct4: true,
          margenPct5: true, margenPct6: true, margenPct7: true, margenPct8: true,
          margenPct9: true, margenPct10: true, margenPct11: true, margenPct12: true,
          precioFinal1: true, precioFinal2: true, precioFinal3: true, precioFinal4: true,
          precioFinal5: true, precioFinal6: true, precioFinal7: true, precioFinal8: true,
          precioFinal9: true, precioFinal10: true, precioFinal11: true, precioFinal12: true,
          subtotal1: true, subtotal2: true, subtotal3: true, subtotal4: true,
          subtotal5: true, subtotal6: true, subtotal7: true, subtotal8: true,
          subtotal9: true, subtotal10: true, subtotal11: true, subtotal12: true,
          product: {
            id: true, nombre: true, descripcion: true,
          },
          service: {
            id: true, nombre: true, descripcion: true, precioBase: true,
          },
        },
      },
    });

    if (!q) throw new NotFoundException('Cotización no encontrada');
    return q;
  }

  /* 1 ── listar todas las enviadas OPTIMIZADO ── */
  async listSent() {
    return this.quotesRepo.find({
      where: { status: 'sent' },
      relations: ['items', 'items.product', 'items.service'],
      order: { sentAt: 'DESC' },
      select: {
        id: true, status: true, createdAt: true, sentAt: true, tipo: true,
        titulo: true, descripcion: true, ivaPct: true,
        totalFinal1: true, totalFinal2: true, totalFinal3: true, totalFinal4: true,
        totalFinal5: true, totalFinal6: true, totalFinal7: true, totalFinal8: true,
        totalFinal9: true, totalFinal10: true, totalFinal11: true, totalFinal12: true,
        items: {
          id: true, cantidad: true, unidad: true, costo_unitario: true,
          product: { id: true, nombre: true, descripcion: true, precio: true },
          service: { id: true, nombre: true, descripcion: true, precioBase: true },
        },
      },
    });
  }

  /* 2 ── borradores de un usuario OPTIMIZADO ── */
  async listUserDrafts(userId: string) {
    return this.quotesRepo.find({
      where: { status: 'draft', user: { id: userId } as any },
      relations: ['items', 'items.product', 'items.service'],
      order: { createdAt: 'DESC' },
      select: {
        id: true, status: true, createdAt: true, sentAt: true, tipo: true,
        titulo: true, descripcion: true, ivaPct: true,
        items: {
          id: true, cantidad: true, unidad: true, costo_unitario: true,
          product: { id: true, nombre: true, descripcion: true, precio: true },
          service: { id: true, nombre: true, descripcion: true, precioBase: true },
        },
      },
    });
  }

  /* 5‑B. Mis cotizaciones enviadas OPTIMIZADO ── */
  async listUserSent(userId: string) {
    return this.quotesRepo.find({
      where: { status: 'sent', user: { id: userId } as any },
      relations: ['items', 'items.product', 'items.service'],
      order: { sentAt: 'DESC' },
      select: {
        id: true, status: true, createdAt: true, sentAt: true, tipo: true,
        titulo: true, descripcion: true, ivaPct: true,
        totalFinal1: true, totalFinal2: true, totalFinal3: true, totalFinal4: true,
        totalFinal5: true, totalFinal6: true, totalFinal7: true, totalFinal8: true,
        totalFinal9: true, totalFinal10: true, totalFinal11: true, totalFinal12: true,
        items: {
          id: true, cantidad: true, unidad: true, costo_unitario: true,
          product: { id: true, nombre: true, descripcion: true, precio: true },
          service: { id: true, nombre: true, descripcion: true, precioBase: true },
        },
      },
    });
  }

  /* 3 ── reabrir para edición OPTIMIZADO ── */
  async reopenQuote(id: string, user: { sub: string | number; roles?: any[] }) {
    // Solo cargar la cotización con el usuario para permisos
    const quote = await this.quotesRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    const isOwner = quote.user && String(quote.user.id) === String(user.sub);
    const roles: string[] = Array.isArray(user.roles) ? user.roles.map(String) : [];
    const isAdmin = roles.some(r => r === Role.Admin || r.toLowerCase() === 'admin');

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Sin permisos para editar esta cotización');
    }

    if (quote.status === 'draft') return quote;

    // Actualizar en UNA sola query
    await this.quotesRepo
      .createQueryBuilder()
      .update()
      .set({ status: 'draft', sentAt: null })
      .where("id = :id", { id })
      .execute();

    const reopened = await this.quotesRepo.findOne({ where: { id } });
    
    return { message: 'Cotización vuelta a borrador', quote: reopened };
  }

  async deleteQuote(id: string) {
    const quote = await this.quotesRepo.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
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