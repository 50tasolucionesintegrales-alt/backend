import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { PurchaseOrder } from "./entities/purchase-order.entity";
import { PurchaseOrderItem } from "./entities/purchase-order-item.entity";
import { Product } from "src/products/entities/product.entity";
import { CreateOrderDto } from "./dto/create-order.dto";
import { AddOrderItemsDto } from "./dto/add-items.dto";
import { In, Not, Repository } from "typeorm";
import { ApproveItemDto } from "./dto/approve-item.dto";

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(PurchaseOrder) private ordersRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem) private itemsRepo: Repository<PurchaseOrderItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
  ) { }

  private calcProgress(items: PurchaseOrderItem[]) {
    const total = items.length;
    const approved = items.filter(i => i.status === 'approved').length;
    return +(approved / total * 100).toFixed(1);
  }

  async listPending() {
    const orders = await this.ordersRepo.find({
      where: { status: In(['sent', 'partially_approved']) },
      relations: ['user','items', 'items.product'],
      order: { sentAt: 'DESC' },
    });
    return orders;
  }

  /** 5‑C. Resueltas (Admin) */
  async listResolved() {
    const orders = await this.ordersRepo.find({
      where: { status: In(['approved', 'rejected']) },
      relations: ['user','items', 'items.product'],
      order: { resolvedAt: 'DESC' },
    });
    return orders;
  }

  /* 1. Crear borrador */
  async createDraft(userId: string, dto: CreateOrderDto) {
    const o = this.ordersRepo.create({
      user: { id: userId } as any,
      titulo: dto.titulo,
      descripcion: dto.descripcion ?? null,
    });
    const saved = await this.ordersRepo.save(o);
    return { message: 'Borrador de orden creado', order: saved };
  }

  /* 2. Agregar ítems */
  async addItems(orderId: string, dto: AddOrderItemsDto) {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product'],
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.status !== 'draft')
      throw new ForbiddenException('Orden ya enviada');

    for (const i of dto.items) {
      const prod = await this.productRepo.findOne({
        where: { id: String(i.productId) },
      });
      if (!prod) throw new NotFoundException(`Producto ${i.productId} inexistente`);

      /* ¿Ya existe un renglón para ese producto? */
      let item = order.items.find((it) => it.product.id === prod.id);
      const costo = +Number(i.costoUnitario).toFixed(2);

      if (item) {
        /* ── ACTUALIZAR ── */
        item.cantidad += i.cantidad;
        item.costo_unitario = costo;
        item.subtotal = +(item.cantidad * costo).toFixed(2);
        await this.itemsRepo.save(item);
      } else {
        /* ── CREAR ── */
        const subtotal = +(costo * i.cantidad).toFixed(2);
        item = this.itemsRepo.create({
          order,
          product: prod,
          cantidad: i.cantidad,
          costo_unitario: costo,
          subtotal,
        });
        await this.itemsRepo.save(item);
        order.items.push(item); // mantener array in‑memory
      }
    }

    /* 🔄  Consultamos la orden ya completa */
    const updated = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product'],
    });

    return { message: 'Ítems agregados/actualizados', order: updated };
  }

  /* 3. Subir evidencia (comprador) */
  async uploadEvidence(itemId: string, file: Express.Multer.File) {
    const item = await this.itemsRepo.findOne({ where: { id: itemId }, relations: ['order'] });
    if (!item) throw new NotFoundException('Item no encontrado');

    if (!['draft', 'sent', 'partially_approved'].includes(item.order.status))
      throw new ForbiddenException('Orden no editable');

    if (item.status === 'approved')
      throw new ForbiddenException('Ítem aprobado; no se puede modificar');

    if (!file?.buffer) throw new BadRequestException('Archivo inválido');

    item.evidenceData = file.buffer;
    item.evidenceMime = file.mimetype;
    item.evidenceName = file.originalname?.slice(0, 255) || null;
    item.evidenceSize = file.size ?? null;

    item.status = 'pending';
    item.rejectReason = null;
    item.approvedAt = null;

    await this.itemsRepo.save(item);
    return { message: 'Evidencia subida', itemId: item.id, size: item.evidenceSize };
  }

  /* 3.b Obtener evidencia (para descargar/ver) */
  async getEvidence(itemId: string) {
    const item = await this.itemsRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item no encontrado');
    if (!item.evidenceData) throw new NotFoundException('Sin evidencia para este ítem');

    return {
      buffer: item.evidenceData,
      mime: item.evidenceMime,
      name: item.evidenceName,
      size: item.evidenceSize,
    };
  }

  /* 4. Enviar orden (cuando TODOS los ítems tienen evidencia) */
  async sendOrder(orderId: string) {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (!['draft', 'partially_approved', 'sent'].includes(order.status))
      throw new ForbiddenException('Orden no editable/enviable');

    const lacking = order.items.filter((i) => !i.evidenceData);
    if (lacking.length)
      throw new ForbiddenException('Todos los ítems requieren evidencia');

    order.status = 'sent';
    order.sentAt = new Date();
    order.progressPct = this.calcProgress(order.items);
    order.total = order.items.reduce((a, it) => a + it.subtotal, 0);
    await this.ordersRepo.save(order);
    return { message: 'Orden enviada'};
  }

  /* 5. Listados */
  listUserDrafts(userId: string) {
    return this.ordersRepo.find({
      where: { status: 'draft', user: { id: userId } as any },
      relations: ['items', 'items.product'],
    });
  }

  /* 6. Aprobar / rechazar ítem (ADMIN) */
  async approveItem(itemId: string, dto: ApproveItemDto) {
    const item = await this.itemsRepo.findOne({
      where: { id: itemId },
      relations: ['order'],
    });
    if (!item) throw new NotFoundException('Item no encontrado');
    if (item.order.status !== 'sent' && item.order.status !== 'partially_approved')
      throw new ForbiddenException('Orden no pendiente de aprobación');

    if (dto.status === 'rejected' && !dto.reason)
      throw new BadRequestException('Motivo requerido al rechazar');

    item.status = dto.status;
    item.rejectReason = dto.status === 'rejected' ? dto.reason ?? 'Sin motivo' : null;
    item.approvedAt = dto.status === 'approved' ? new Date() : null;
    await this.itemsRepo.save(item);

    /* Actualizar progreso / estado global */
    await this.refreshOrderStatus(item.order.id);

    const msg = dto.status === 'approved' ? 'Ítem aprobado' : 'Ítem rechazado';
    return { message: msg, item };
  }

  private async refreshOrderStatus(orderId: string) {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) return;

    const total = order.items.length;
    const approved = order.items.filter((i) => i.status === 'approved').length;
    const rejected = order.items.filter((i) => i.status === 'rejected').length;

    order.progressPct = +(approved / total * 100).toFixed(1);

    if (approved === total) {
      order.status = 'approved';
      order.resolvedAt = new Date();
    } else if (rejected === total) {
      order.status = 'rejected';
      order.resolvedAt = new Date();
    } else {
      order.status = 'partially_approved';
      order.resolvedAt = null;
    }
    await this.ordersRepo.save(order);
  }

  /* 7. Obtener una orden */
  async getOne(id: string) {
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: ['items', 'items.product'],
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }

  async listUserSent(userId: string) {
    const orders = await this.ordersRepo.find({
      where: {
        user: { id: userId } as any,
        status: Not('draft'),               // todas excepto borrador
      },
      relations: ['items', 'items.product'],
      order: { sentAt: 'DESC' },
    });
    return { message: 'Órdenes enviadas del usuario', orders };
  }

  async updateItem(itemId: string, qty: number, unitCost: number) {
    const item = await this.itemsRepo.findOne({
      where: { id: itemId },
      relations: ['order'],
    });
    if (!item) throw new NotFoundException('Ítem no encontrado');
    if (item.status === 'approved')
      throw new ForbiddenException('Ítem aprobado; no se puede modificar');

    if (!['draft', 'sent', 'partially_approved'].includes(item.order.status))
      throw new ForbiddenException('Orden no editable');

    item.cantidad = qty;
    item.costo_unitario = +unitCost.toFixed(2);
    item.subtotal = +(item.cantidad * item.costo_unitario).toFixed(2);

    /* si estaba rejected lo volvemos pending */
    item.status = 'pending';
    item.rejectReason = null;
    item.approvedAt = null;

    const saved = await this.itemsRepo.save(item);
    return { message: 'Ítem actualizado', item: saved };
  }

  async removeItem(itemId: string) {
    const item = await this.itemsRepo.findOne({
      where: { id: itemId },
      relations: ['order'],
    });
    if (!item) throw new NotFoundException('Ítem no encontrado');
    if (item.order.status !== 'draft')
      throw new ForbiddenException('Orden no editable');

    await this.itemsRepo.delete(itemId);
    return { message: 'Ítem eliminado' };
  }

  async reopenOrder(id: string, user: { sub: string | number; roles?: any[] }) {
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: ['user', 'items'],
    });
    if (!order) throw new NotFoundException('Orden no encontrada');

    /* permisos */
    const isOwner = order.user && String(order.user.id) === String(user.sub);
    const roles: string[] = Array.isArray(user.roles) ? user.roles.map(String) : [];
    const isAdmin = roles.some(r => r.toLowerCase() === 'admin');
    if (!isOwner && !isAdmin)
      throw new ForbiddenException('Sin permisos para editar esta orden');

    /* veto si hay aprobados */
    if (order.items.some(i => i.status === 'approved'))
      throw new ForbiddenException('La orden tiene ítems aprobados; no se puede reabrir');

    order.status = 'draft';
    order.sentAt = null;
    order.resolvedAt = null;
    order.progressPct = 0;
    order.items.forEach(i => {
      if (i.status === 'rejected') {
        i.status = 'pending';
        i.rejectReason = null;
        i.approvedAt = null;
      }
    });

    await this.itemsRepo.save(order.items);
    const saved = await this.ordersRepo.save(order);
    return { message: 'Orden vuelta a borrador', order: saved };
  }

  async deleteOrder(id: string) {
    const order = await this.ordersRepo.findOne({ where: { id }, relations: ['items'] });
    if (!order) throw new NotFoundException('Orden no encontrada');

    await this.ordersRepo.delete(id);          // FK items → onDelete: CASCADE
    return { message: 'Orden de compra eliminada' };
  }
}
