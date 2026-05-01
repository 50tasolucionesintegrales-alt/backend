import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
  Delete,
  Query,
  Res,
  Put,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
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
import { PdfServiciosService1 } from 'src/pdf/e1_goltech/pdf-servicios.service';
import { PdfServiciosService2 } from 'src/pdf/e2_juan_angel/pdf-servicios.service';
import { PdfServiciosService3 } from 'src/pdf/e3_giselle/pdf-servicios.service';
import { PdfServiciosService4 } from 'src/pdf/e4_orihuela/pdf-servicios.service'; 
import { PdfServiciosService5 } from 'src/pdf/e5_mariana/pdf-servicios.service';
import { PdfServiciosService6 } from 'src/pdf/e6_michelle/pdf-servicios.service';
import { PdfServiciosService7 } from 'src/pdf/e7_chalor/pdf-servicios.service';
import { PdfServiciosService8 } from 'src/pdf/e8_leyses/pdf-servicios.service';
import { PdfServiciosService9 } from 'src/pdf/e9_es/pdf-servicios.service';
import { PdfServiciosService10 } from 'src/pdf/e10_jessica/pdf-servicios.service';
import { PdfServiciosService11 } from 'src/pdf/e11_alamo/pdf-servicios.service';
import { PdfServiciosService12 } from 'src/pdf/e12_hugo/pdf-servicios.service';
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
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FileValidationPipe } from 'src/common/pipes/file-validation/file-validation.pipe';
import { ImportExcelDto } from './dto/import-excel.dto';
import { ExcelTemplateService } from './excel/excel-template.service';
import { ExcelImportService } from './excel/excel-import.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
    private readonly pdf1: PdfService1,
    private readonly pdfServicios1: PdfServiciosService1, 
    private readonly pdfServicios2: PdfServiciosService2,
    private readonly pdfServicios3: PdfServiciosService3,
    private readonly pdfServicios4: PdfServiciosService4,
    private readonly pdfServicios5: PdfServiciosService5,
    private readonly pdfServicios6: PdfServiciosService6,
    private readonly pdfServicios7: PdfServiciosService7,
    private readonly pdfServicios8: PdfServiciosService8,
    private readonly pdfServicios9: PdfServiciosService9,
    private readonly pdfServicios10: PdfServiciosService10,
    private readonly pdfServicios11: PdfServiciosService11,
    private readonly pdfServicios12: PdfServiciosService12,
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
    private readonly excelTemplate: ExcelTemplateService,
    private readonly excelImport: ExcelImportService,
  ) {}

  @Get('excel/template')
  async downloadTemplate(
    @Query('empresas') empresas: string,
    @Query('numProductos') numProductos: string,
    @Query('tipo') tipo: string,
    @Res() res: Response,
  ) {
    const empresaIds = empresas.split(',').map(Number);
    const n = parseInt(numProductos ?? '10');
    const tipoValido = tipo === 'servicios' ? 'servicios' : 'productos';
    const buffer = await this.excelTemplate.generateTemplate(
      empresaIds,
      isNaN(n) || n < 1 ? 10 : Math.min(n, 1000),
      tipoValido,
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=cotizacion_plantilla.xlsx',
    });
    res.send(buffer);
  }

  @Post('import-excel')
  @Roles(Role.Admin, Role.Cotizador)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async importFromExcel(
    @UploadedFile(
      new FileValidationPipe({
        required: true,
        maxSizeBytes: 10 * 1024 * 1024,
        allowedMimes: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/octet-stream',
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: ImportExcelDto,
    @Req() req,
    @Res() res: Response,
  ) {
    try {
      const result = await this.excelImport.importFromExcel(
        file.buffer,
        dto.empresas,
        req.user.sub,
        dto.tipo,
      );

      if (!result.ok) {
        return res.status(400).json({
          ok: false,
          message: 'El archivo contiene errores de validación. No se insertó ningún dato.',
          errors: result.errors ?? [],
        });
      }

      return res.status(200).json({
        message: 'Cotización creada exitosamente desde Excel',
        quoteId: result.quoteId,
        empresas: dto.empresas,
        productosCreados: result.productosCreados,
        productosReutilizados: result.productosReutilizados,
        advertencias: result.advertencias ?? [],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error al procesar el archivo';
      return res.status(400).json({
        ok: false,
        message,
        errors: [],
      });
    }
  }

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

    let firmanteCompleto = template.firmanteNombre || '';
    if (template.firmanteCargo) {
      firmanteCompleto = firmanteCompleto
        ? `${firmanteCompleto}<br>${template.firmanteCargo}`
        : template.firmanteCargo;
    }

    return {
      destinatario: template.destinatario || '',
      presente: template.presente || 'PRESENTE',
      descripcion: template.descripcion || '',
      folio: template.folio || '',
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
  reopen(@Param('id', IdValidationPipe) id: string, @Req() req) {
    return this.quotes.reopenQuote(id, req.user);
  }

  /* 1️⃣  Crear borrador */
  @Post()
  @Roles(Role.Admin, Role.Cotizador)
  createDraft(@Req() req, @Body() dto: CreateQuoteDto) {
    return this.quotes.createDraft(
      req.user.sub,
      dto.tipo,
      dto.titulo,
      dto.descripcion,
    );
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

    const defaultData = await this.getDefaultPdfData(dto.empresa);

    let defaultCondicionesHtml = '';
    if (defaultData.condicionesItems && defaultData.condicionesItems.length > 0) {
      defaultCondicionesHtml = `<ul>${defaultData.condicionesItems.map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}</ul>`;
    } else if (defaultData.condicionesText) {
      defaultCondicionesHtml = defaultData.condicionesText;
    }

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

    let pdfBuffer: Buffer;
    
    const esServicios = quote.tipo === 'servicios';

    switch (dto.empresa) {
      case 1:
        pdfBuffer = esServicios
          ? await this.pdfServicios1.generateOneBuffer(
              quote,
              dto.empresa,
              metaData,
            )
          : await this.pdf1.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 2:
        pdfBuffer = esServicios
          ? await this.pdfServicios2.generateOneBuffer(quote, dto.empresa, metaData)
          : await this.pdf2.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 3:
        pdfBuffer = esServicios
          ? await this.pdfServicios3.generateOneBuffer(quote, dto.empresa, metaData)
          : await this.pdf3.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 4:
        pdfBuffer = esServicios
          ? await this.pdfServicios4.generateOneBuffer(quote, dto.empresa, metaData)
          : await this.pdf4.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 5:
        pdfBuffer = esServicios
          ? await this.pdfServicios5.generateOneBuffer(quote, dto.empresa, metaData)
          : await this.pdf5.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 6:
        pdfBuffer = esServicios
          ? await this.pdfServicios6.generateOneBuffer(quote, dto.empresa, metaData)
          : await this.pdf6.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 7:
        pdfBuffer = esServicios
          ? await this.pdfServicios7.generateOneBuffer(quote, dto.empresa, metaData)
          : await this.pdf7.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 8:
        pdfBuffer = esServicios
          ? await this.pdfServicios8.generateOneBuffer(quote, dto.empresa, metaData)
          : await this.pdf8.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 9:
        pdfBuffer = esServicios
          ? await this.pdfServicios9.generateOneBuffer(quote, dto.empresa, metaData)
          : await this.pdf9.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 10:
        pdfBuffer = esServicios
          ? await this.pdfServicios10.generateOneBuffer(quote, dto.empresa, metaData)
          : await this.pdf10.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 11:
        pdfBuffer = esServicios
          ? await this.pdfServicios11.generateOneBuffer(quote, dto.empresa, metaData)
          : await this.pdf11.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      case 12:
        pdfBuffer = esServicios
          ? await this.pdfServicios12.generateOneBuffer(quote, dto.empresa, metaData)
          : await this.pdf12.generateOneBuffer(quote, dto.empresa, metaData);
        break;
      default: throw new Error(`Empresa ${dto.empresa} no válida`);
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
      folio?: string;
      lugar?: string;
      incluirFirma?: boolean;
      firmanteNombre?: string;
      firmanteCargo?: string;
      condicionesItems?: string[] | null;
      condicionesText?: string;
      condicionesMode?: 'list' | 'text';
    },
  ) {
    const { empresa, ...updateData } = data;

    const template = await this.templateRepo.findOne({ where: { id: empresa } });
    if (!template) {
      throw new NotFoundException(`Plantilla con ID ${empresa} no encontrada`);
    }

    Object.keys(updateData).forEach((key) => {
      const value = updateData[key as keyof typeof updateData];
      if (value !== undefined && value !== null) {
        (template as any)[key] = value;
      }
    });

    const updated = await this.templateRepo.save(template);

    return {
      success: true,
      message: 'Plantilla actualizada correctamente',
      data: updated,
    };
  }
}