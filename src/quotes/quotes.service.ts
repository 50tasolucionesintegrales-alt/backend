import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { Product } from 'src/products/entities/product.entity';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PdfService } from './pdf.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
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
    private readonly cloudinary: CloudinaryService
  ) { }

  private addSignedLinks(q: Quote, ttlSeconds = 3600) {
    // Si no hay ni siquiera el primero, salimos
    if (!q.pdfMargen1Id) return;

    // Usamos "any" solo para añadir los campos al JSON de salida
    const out = q as any;

    out.pdf1 = this.cloudinary.generateSignedPdfUrl(q.pdfMargen1Id, ttlSeconds);

    // Genera pdf2 solo si hay id2
    if (q.pdfMargen2Id) {
      out.pdf2 = this.cloudinary.generateSignedPdfUrl(q.pdfMargen2Id, ttlSeconds);
    }

    // Genera pdf3 solo si hay id3
    if (q.pdfMargen3Id) {
      out.pdf3 = this.cloudinary.generateSignedPdfUrl(q.pdfMargen3Id, ttlSeconds);
    }
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
    const quote = await this.quotesRepo.findOne({
      where: { id: quoteId },
      relations: ['items'],
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    for (const i of dto.items) {
      /* 4.1 — Asegura que el ítem coincide con el tipo de la cotización */
      if (
        (quote.tipo === 'productos' && i.tipo !== 'producto') ||
        (quote.tipo === 'servicios' && i.tipo !== 'servicio')
      ) {
        throw new ForbiddenException(
          `Esta cotización es de ${quote.tipo}; no puedes añadir un ${i.tipo}.`,
        );
      }

      /* 4.2 — Cargar entidad correcta */
      let producto: Product | null = null;
      let servicio: Service | null = null;

      if (i.tipo === 'producto') {
        producto = await this.productRepo.findOne({ where: { id: String(i.productId) } });
        if (!producto) throw new NotFoundException(`Producto ${i.productId} inexistente`);
      } else {
        servicio = await this.serviceRepo.findOne({ where: { id: String(i.serviceId) } });
        if (!servicio) throw new NotFoundException(`Servicio ${i.serviceId} inexistente`);
      }

      /* 4.3 — Cálculos iniciales */
      const costo = +i.costoUnitario.toFixed(2);
      const subtotalInicial = +(costo * i.cantidad).toFixed(2);

      const item = this.itemsRepo.create({
        quote,
        product: producto,
        service: servicio,
        cantidad: i.cantidad,
        costo_unitario: costo,
        subtotal1: subtotalInicial,
      });

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
      relations: ['quote'],
    });
    if (!item) throw new NotFoundException('Item no encontrado');
    if (item.quote.status !== 'draft')
      throw new ForbiddenException('La cotización ya fue enviada');

    /* Mezclamos solo las claves realmente presentes */
    Object.entries(dto).forEach(([key, value]) => {
      if (value !== undefined) (item as any)[key] = value;
    });

    /* ---------- helpers ---------- */
    const toNumber = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const calc = (cost: number, qty: number, margin: number) => {
      const price = +(cost * (1 + margin / 100)).toFixed(2);
      const subtotal = +(price * qty).toFixed(2);
      return { price, subtotal };
    };

    /* Datos base: ahora qty ya NO es undefined */
    const cost = toNumber(item.costo_unitario);
    const qty = toNumber(item.cantidad);
    if (cost === null || qty === null) return this.itemsRepo.save(item); // parche incompleto

    /* Márgenes */
    const m1 = toNumber(item.margenPct1);
    const m2 = toNumber(item.margenPct2);
    const m3 = toNumber(item.margenPct3);

    if (m1 !== null) {
      const { price, subtotal } = calc(cost, qty, m1);
      item.precioFinal1 = price;
      item.subtotal1 = subtotal;
    }
    if (m2 !== null) {
      const { price, subtotal } = calc(cost, qty, m2);
      item.precioFinal2 = price;
      item.subtotal2 = subtotal;
    }
    if (m3 !== null) {
      const { price, subtotal } = calc(cost, qty, m3);
      item.precioFinal3 = price;
      item.subtotal3 = subtotal;
    }

    const saved = await this.itemsRepo.save(item);
    return { message: 'Ítem actualizado', item: saved };
  }

  /* ───────── Enviar cotización (genera PDFs) ───────── */
  async sendQuote(id: string) {
    const quote = await this.quotesRepo.findOne({
      where: { id },
      relations: ['items', 'items.product'],
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    if (quote.status !== 'draft')
      throw new ForbiddenException('La cotización ya fue enviada');

    /* Totales */
    type Sub = 'subtotal1' | 'subtotal2' | 'subtotal3';
    const sum = (f: Sub) =>
      quote.items.reduce((a, it) => a + (it[f] ?? 0), 0);

    quote.totalMargen1 = +sum('subtotal1').toFixed(2);
    quote.totalMargen2 = +sum('subtotal2').toFixed(2);
    quote.totalMargen3 = +sum('subtotal3').toFixed(2);

    /* Fecha de envío */
    quote.sentAt = new Date();

    /* PDFs */
    const { id1, id2, id3, url1, url2, url3 } = await this.pdf.generateAndUpload(quote);
    quote.pdfMargen1Id = id1;
    quote.pdfMargen2Id = id2;
    quote.pdfMargen3Id = id3;
    quote.status = 'sent';
    quote.sentAt = new Date();

    await this.quotesRepo.save(quote);
    return { message: 'Cotización enviada', pdf1: url1, pdf2: url2, pdf3: url3 };
  }

  /* ───────── Obtener una cotización ───────── */
  async getOne(id: string) {
    const q = await this.quotesRepo.findOne({
      where: { id },
      relations: ['items', 'items.product'],
    });
    if (!q) throw new NotFoundException('Cotización no encontrada');
    this.addSignedLinks(q);

    return q;
  }

  /* 1 ── listar todas las enviadas */
  async listSent() {
    const quotes = await this.quotesRepo.find({
      where: { status: 'sent' },
      relations: ['items', 'items.product', 'items.service'],
      order: { sentAt: 'DESC' },
    });

    // 👉 genera enlaces firmados válidos 1 h
    quotes.forEach((q) => this.addSignedLinks(q));

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
    quotes.forEach((q) => this.addSignedLinks(q));
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
    quote.pdfMargen1Id = null;
    quote.pdfMargen2Id = null;
    quote.pdfMargen3Id = null;

    const reopened = await this.quotesRepo.save(quote);
    return { message: 'Cotización vuelta a borrador', quote: reopened };
  }

  async deleteQuote(id: string) {
    const quote = await this.quotesRepo.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    /* ── eliminar PDFs en Cloudinary ── */
    const pdfIds = [quote.pdfMargen1Id, quote.pdfMargen2Id, quote.pdfMargen3Id]
      .filter(Boolean) as string[];

    for (const pid of pdfIds) {
      try { await this.cloudinary.deleteRawByPublicId(pid); } catch { }
    }

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
