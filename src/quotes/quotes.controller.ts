import { Controller, Post, Patch, Get, Param, Body, Req, UseGuards, Delete, Query, Res } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/roles.enum';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { IdValidationPipe } from 'src/common/pipes/id-validation/id-validation.pipe';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { Response } from 'express';
import { PdfService } from 'src/pdf/pdf.service';
import { GeneratePdfDto } from './dto/generate-pdf.dto';
import { BatchUpdateItemDto } from './dto/batch-update-item.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly pdf: PdfService
  ) { }

  /* ▶ 1. Todas las enviadas (ADMIN) */
  @Get('sent')
  @Roles(Role.Admin)
  listSent() {
    return this.quotes.listSent();
  }

  /* ▶ 2. Borradores del usuario */
  @Get('drafts')
  @Roles(Role.Admin, Role.Cotizador)
  listDrafts(@Req() req) {
    return this.quotes.listUserDrafts(req.user.sub);
  }

  /* ▶ 3. Reabrir cotización para editar */
  @Patch(':id/reopen')
  @Roles(Role.Admin, Role.Cotizador)
  reopen(
    @Param('id', IdValidationPipe) id: string,
    @Req() req,
  ) {
    return this.quotes.reopenQuote(id, req.user);
  }

  /* 1️⃣  Crear borrador */
  @Post()
  @Roles(Role.Admin, Role.Cotizador)
  createDraft(@Req() req, @Body() dto: CreateQuoteDto) {
    return this.quotes.createDraft(req.user.sub, dto.tipo, dto.titulo, dto.descripcion);
  }

  /* 2️⃣  Agregar ítems */
  @Post(':id/items')
  @Roles(Role.Admin, Role.Cotizador)
  addItems(
    @Param('id', IdValidationPipe) id: string,
    @Body() dto: AddItemsDto,
  ) {
    console.log({ dto });
    return this.quotes.addItems(id, dto);
  }

  /* 4️⃣ Actualizar ítems en lote (Batch) */
  @Patch(':quoteId/items')
  @Roles(Role.Admin, Role.Cotizador)
  updateQuoteItems(
    @Param('quoteId', IdValidationPipe) quoteId: string,
    @Body() dtos: BatchUpdateItemDto[],
  ) {
    return this.quotes.updateQuoteItems(quoteId, dtos);
  }

  /* 3️⃣  Actualizar ítem */
  @Patch('items/:itemId')
  @Roles(Role.Admin, Role.Cotizador)
  updateItem(
    @Param('itemId', IdValidationPipe) itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.quotes.updateItem(itemId, dto);
  }

  @Delete('items/:itemId')
  @Roles(Role.Admin, Role.Cotizador)
  removeItem(@Param('itemId', IdValidationPipe) itemId: string) {
    return this.quotes.removeItem(itemId);
  }

  /* 4️⃣  Enviar (genera PDFs) */
  @Post(':id/send')
  @Roles(Role.Admin, Role.Cotizador)
  send(@Param('id', IdValidationPipe) id: string) {
    return this.quotes.sendQuote(id);
  }

  /* Descargar UN PDF (empresa=1..7) */
  @Post(':id/pdf')
  @Roles(Role.Admin, Role.Cotizador)
  async buildOne(
    @Param('id', IdValidationPipe) id: string,
    @Body() dto: GeneratePdfDto,
    @Res() res: Response,
  ) {
    const quote = await this.quotes.loadForPdf(id);
    const buffer = await this.pdf.generateOneBuffer(quote, dto.empresa, {
      destinatario: dto.destinatario,
      descripcion: dto.descripcion,
      fecha: dto.fecha,
      folio: dto.folio,
      lugar: dto.lugar,
      presente: dto.presente,
      condiciones: dto.condiciones,
      incluirFirma: dto.incluirFirma,
      firmanteNombre: dto.firmanteNombre,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="quote_${id}_m${dto.empresa}.pdf"`,
    );
    res.send(buffer);
  }

  /* 5️⃣  Obtener una cotización */
  @Get(':id')
  @Roles(Role.Admin, Role.Cotizador)
  findOne(@Param('id', IdValidationPipe) id: string) {
    return this.quotes.getOne(id);
  }

  @Get('sent/mine')
  @Roles(Role.Admin, Role.Cotizador)
  listMySent(@Req() req) {
    return this.quotes.listUserSent(req.user.sub);
  }

  @Delete(':id')
  @Roles(Role.Admin)                          // ← solo administradores
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.quotes.deleteQuote(id);
  }
}

