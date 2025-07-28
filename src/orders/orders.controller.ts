import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) { }

  /* 1. Crear borrador */
  @Post()
  @Roles(Role.Admin, Role.Cotizador)
  create(@Req() req, @Body() dto: CreateOrderDto) {
    return this.orders.createDraft(req.user.sub, dto);
  }

  /* 2. Agregar ítems */
  @Post(':id/items')
  @Roles(Role.Admin, Role.Cotizador)
  addItems(
    @Param('id', IdValidationPipe) id: string,
    @Body() dto: AddOrderItemsDto,
  ) {
    return this.orders.addItems(id, dto);
  }

  /* 3. Subir evidencia (multipart/form‑data) */
  @Post('items/:itemId/evidence')
  @Roles(Role.Admin, Role.Cotizador)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('itemId', IdValidationPipe) itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.orders.uploadEvidence(itemId, file);
  }

  /* 4. Enviar orden */
  @Post(':id/send')
  @Roles(Role.Admin, Role.Cotizador)
  send(@Param('id', IdValidationPipe) id: string) {
    return this.orders.sendOrder(id);
  }

  /* 5. Listados */
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

  /* 6. Aprobación de ítem (Admin) */
  @Patch('items/:itemId/approve')
  @Roles(Role.Admin)
  approve(
    @Param('itemId', IdValidationPipe) itemId: string,
    @Body() dto: ApproveItemDto,
  ) {
    return this.orders.approveItem(itemId, dto);
  }

  /* 7. Obtener una orden */
  @Get(':id')
  @Roles(Role.Admin, Role.Cotizador)
  findOne(@Param('id', IdValidationPipe) id: string) {
    return this.orders.getOne(id);
  }

  /* ▶ Mis órdenes enviadas */
  @Get('sent/mine')
  @Roles(Role.Admin, Role.Cotizador)
  listMySent(@Req() req) {
    return this.orders.listUserSent(req.user.sub);
  }

  /* actualizar un ítem */
  @Patch('items/:itemId')
  @Roles(Role.Admin, Role.Cotizador)
  updateItem(
    @Param('itemId', IdValidationPipe) itemId: string,
    @Body() dto: { cantidad: number; costoUnitario: number },
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
