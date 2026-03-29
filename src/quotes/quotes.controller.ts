import { Controller, Post, Patch, Query, Get, Param, Body, Req, UseGuards, Delete, Res, Put, NotFoundException } from '@nestjs/common';
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
import { PdfService1 } from 'src/pdf/e1_goltech/pdf.service';
import { PdfService2 } from 'src/pdf/e2_juan_angel/pdf.service';
import { PdfService3 } from 'src/pdf/e3_giselle/pdf.service';
import { PdfService4 } from 'src/pdf/e4_orihuela/pdf.service';
import { PdfService5 } from 'src/pdf/e5_mariana/pdf.service';
import { PdfService6 } from 'src/pdf/e6_michelle/pdf.service';
import { PdfService7 } from 'src/pdf/e7_chalor/pdf.service';
import { PdfService8 } from 'src/pdf/e8_leyses/pdf.service';
import { PdfService9 } from 'src/pdf/e9_es/pdf.service';
import { PdfService10 } from 'src/pdf/e10_jessica/pdf.service';
import { PdfService11 } from 'src/pdf/e11_alamo/pdf.service';
import { PdfService12 } from 'src/pdf/e12_hugo/pdf.service';
import { GeneratePdfDto } from './dto/generate-pdf.dto';
import { BatchUpdateItemDto } from './dto/batch-update-item.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
    private readonly pdf1: PdfService1,
    private readonly pdf2: PdfService2,
    private readonly pdf3: PdfService3,
    private readonly pdf4: PdfService4,
    private readonly pdf5: PdfService5,
    private readonly pdf6: PdfService6,
    private readonly pdf7: PdfService7,
    private readonly pdf8: PdfService8,
    private readonly pdf9: PdfService9,
    private readonly pdf10: PdfService10,
    private readonly pdf11: PdfService11,
    private readonly pdf12: PdfService12,
  ) { }

  private async getDefaultPdfData(empresa: number) {
    const template = await this.templateRepo.findOne({ where: { id: empresa } });
    
    if (!template) {
      return {
        destinatario: '',
        presente: 'PRESENTE',
        descripcion: '',
        folio: '',
        lugar: 'Pachuca de Soto, Hidalgo',
        incluirFirma: false,
        firmanteNombre: '',
        firmanteCargo: '',
        condicionesItems: [],
        condicionesText: '',
        condicionesMode: 'list',
      };
    }

    // Construir firmanteNombre con cargo
    let firmanteCompleto = template.firmanteNombre || '';
    if (template.firmanteCargo) {
      firmanteCompleto = firmanteCompleto ? `${firmanteCompleto}<br>${template.firmanteCargo}` : template.firmanteCargo;
    }

    return {
      destinatario: template.destinatario || '',
      presente: template.presente || 'PRESENTE',
      descripcion: template.descripcion || '',
      folio: template.folio || '', // Usar el folio guardado directamente, sin generar
      lugar: template.lugar || 'Pachuca de Soto, Hidalgo',
      incluirFirma: template.incluirFirma ?? false,
      firmanteNombre: firmanteCompleto,
      firmanteCargo: template.firmanteCargo || '',
      condicionesItems: template.condicionesItems || [],
      condicionesText: template.condicionesText || '',
      condicionesMode: template.condicionesMode || 'list',
    };
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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

  /* Descargar UN PDF (empresa=1..12) */
  @Post(':id/pdf')
  @Roles(Role.Admin, Role.Cotizador)
  async buildOne(
    @Param('id', IdValidationPipe) id: string,
    @Body() dto: GeneratePdfDto,
    @Res() res: Response,
  ) {
    const quote = await this.quotes.loadForPdf(id);
    
    // Obtener datos por defecto de la plantilla
    const defaultData = await this.getDefaultPdfData(dto.empresa);
    
    // Construir condiciones HTML a partir de los datos por defecto
    let defaultCondicionesHtml = '';
    if (defaultData.condicionesItems && defaultData.condicionesItems.length > 0) {
      defaultCondicionesHtml = `<ul>${defaultData.condicionesItems.map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}</ul>`;
    } else if (defaultData.condicionesText) {
      defaultCondicionesHtml = defaultData.condicionesText;
    }
    
    // Combinar datos: lo que viene en el DTO tiene prioridad sobre los defaults
    const metaData = {
      destinatario: dto.destinatario || defaultData.destinatario,
      descripcion: dto.descripcion || defaultData.descripcion,
      fecha: dto.fecha || new Date().toISOString().split('T')[0],
      folio: dto.folio || defaultData.folio,
      lugar: dto.lugar || defaultData.lugar,
      presente: dto.presente || defaultData.presente,
      condiciones: dto.condiciones || defaultCondicionesHtml,
      incluirFirma: dto.incluirFirma ?? defaultData.incluirFirma,
      firmanteNombre: dto.firmanteNombre || defaultData.firmanteNombre,
    };

    // Seleccionar el servicio de PDF según la empresa
    let pdfBuffer: Buffer;
    
    switch (dto.empresa) {
      case 1:
        pdfBuffer = await this.pdf1.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 2:
        pdfBuffer = await this.pdf2.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 3:
        pdfBuffer = await this.pdf3.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 4:
        pdfBuffer = await this.pdf4.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 5:
        pdfBuffer = await this.pdf5.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 6:
        pdfBuffer = await this.pdf6.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 7:
        pdfBuffer = await this.pdf7.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 8:
        pdfBuffer = await this.pdf8.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 9:
        pdfBuffer = await this.pdf9.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 10:
        pdfBuffer = await this.pdf10.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 11:
        pdfBuffer = await this.pdf11.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 12:
        pdfBuffer = await this.pdf12.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      default:
        throw new Error(`Empresa ${dto.empresa} no válida`);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="quote_${id}_empresa${dto.empresa}.pdf"`,
    );
    res.send(pdfBuffer);
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
  @Roles(Role.Admin)
  remove(@Param('id', IdValidationPipe) id: string) {
    return this.quotes.deleteQuote(id);
  }

  @Get('templates/default-data')
  @Roles(Role.Admin, Role.Cotizador)
  async getTemplateDefaultData(@Query('empresa') empresa: string) {
    const empresaNum = parseInt(empresa, 10);
    if (isNaN(empresaNum) || empresaNum < 1 || empresaNum > 12) {
      throw new Error('Empresa no válida');
    }
    return this.getDefaultPdfData(empresaNum);
  }

  @Put('templates/update')
  @Roles(Role.Admin, Role.Cotizador)
  async updateTemplateData(
    @Body() data: {
      empresa: number;
      destinatario?: string;
      presente?: string;
      descripcion?: string;
      folio?: string; // Cambiar de folioPrefix a folio
      lugar?: string;
      incluirFirma?: boolean;
      firmanteNombre?: string;
      firmanteCargo?: string;
      condicionesItems?: string[] | null;
      condicionesText?: string;
      condicionesMode?: 'list' | 'text';
    }
  ) {
    const { empresa, ...updateData } = data;
    
    const template = await this.templateRepo.findOne({ where: { id: empresa } });
    if (!template) {
      throw new NotFoundException(`Plantilla con ID ${empresa} no encontrada`);
    }

    // Actualizar solo los campos que vienen en la petición
    Object.keys(updateData).forEach(key => {
      const value = updateData[key as keyof typeof updateData];
      if (value !== undefined && value !== null) {
        (template as any)[key] = value;
      }
    });

    const updated = await this.templateRepo.save(template);
    
    return { 
      success: true, 
      message: 'Plantilla actualizada correctamente',
      data: updated 
    };
  }
}