import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { Role } from "src/common/enums/roles.enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersService } from "./orders.service";
import { IdValidationPipe } from "src/common/pipes/id-validation/id-validation.pipe";
import { AddOrderItemsDto } from "./dto/add-items.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApproveItemDto } from "./dto/approve-item.dto";
import { UpdateItemsDto } from "./dto/update-items.dto";
import { Response } from "express";
import { memoryStorage } from "multer";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) { }

  /* Crear borrador */
  @Post()
  @Roles(Role.Admin, Role.Cotizador)
  create(@Req() req, @Body() dto: CreateOrderDto) {
    return this.orders.createDraft(req.user.sub, dto);
  }

  /* Agregar ítems */
  @Post(':id/items')
  @Roles(Role.Admin, Role.Cotizador)
  addItems(
    @Param('id', IdValidationPipe) id: string,
    @Body() dto: AddOrderItemsDto,
  ) {
    return this.orders.addItems(id, dto);
  }

  /* Subir evidencia (multipart/form‑data) */
  @Post('items/:itemId/evidence')
  @Roles(Role.Admin, Role.Cotizador)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  }))
  upload(
    @Param('itemId', IdValidationPipe) itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Validaciones simples de MIME
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!file || !allowed.includes(file.mimetype)) {
      throw new Error('Formato no permitido. Usa JPG, PNG, WEBP, HEIC/HEIF');
    }
    return this.orders.uploadEvidence(itemId, file);
  }

  /* Descargar/Ver evidencia (inline/attachment) */
  @Get('items/:itemId/evidence')
  @Roles(Role.Admin, Role.Cotizador)
  async getEvidence(
    @Param('itemId', IdValidationPipe) itemId: string,
    @Query('disposition') disposition: 'inline' | 'attachment' = 'inline',
    @Res() res: Response,
  ) {
    const ev = await this.orders.getEvidence(itemId);
    res.setHeader('Content-Type', ev.mime || 'application/octet-stream');
    res.setHeader('Content-Length', String(ev.size || ev.buffer.length));
    const filename = ev.name || `evidence_${itemId}`;
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.send(ev.buffer);
  }

  /* Enviar orden */
  @Post(':id/send')
  @Roles(Role.Admin, Role.Cotizador)
  send(@Param('id', IdValidationPipe) id: string) {
    return this.orders.sendOrder(id);
  }

  /* Listados */
  @Get('drafts')
  @Roles(Role.Admin, Role.Cotizador)
  listDrafts(@Req() req) {
    return this.orders.listUserDrafts(req.user.sub);
  }

  /* Pendientes (Admin) */
  @Get('pending')
  @Roles(Role.Admin)
  listPending() {
    return this.orders.listPending();
  }

  /* Resueltas (Admin) */
  @Get('resolved')
  @Roles(Role.Admin)
  listResolved() {
    return this.orders.listResolved();
  }

  /* ▶ Mis órdenes enviadas */
  @Get('sent/mine')
  @Roles(Role.Admin, Role.Cotizador)
  listMySent(@Req() req) {
    return this.orders.listUserSent(req.user.sub);
  }

  /* Aprobación de ítem (Admin) */
  @Patch('items/:itemId/approve')
  @Roles(Role.Admin)
  approve(
    @Param('itemId', IdValidationPipe) itemId: string,
    @Body() dto: ApproveItemDto,
  ) {
    return this.orders.approveItem(itemId, dto);
  }

  /* Obtener una orden */
  @Get(':id')
  @Roles(Role.Admin, Role.Cotizador)
  findOne(@Param('id', IdValidationPipe) id: string) {
    return this.orders.getOne(id);
  }

  /* actualizar un ítem */
  @Patch('items/:itemId')
  @Roles(Role.Admin, Role.Cotizador)
  updateItem(
    @Param('itemId', IdValidationPipe) itemId: string,
    @Body() dto: UpdateItemsDto,
  ) {
    return this.orders.updateItem(itemId, dto.cantidad, dto.costoUnitario);
  }

  /* eliminar un ítem (opcional) */
  @Delete('items/:itemId')
  @Roles(Role.Admin, Role.Cotizador)
  removeItem(@Param('itemId', IdValidationPipe) itemId: string) {
    return this.orders.removeItem(itemId);
  }

  /* reabrir orden */
  @Patch(':id/reopen')
  @Roles(Role.Admin, Role.Cotizador)
  reopen(
    @Param('id', IdValidationPipe) id: string,
    @Req() req,
  ) {
    return this.orders.reopenOrder(id, req.user);
  }

  @Delete(':id')
  @Roles(Role.Admin)                       // ← solo administradores
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.orders.deleteOrder(id);
  }
}
