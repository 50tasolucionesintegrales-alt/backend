import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { Product } from 'src/products/entities/product.entity';
import { Template } from './entities/template.entity';
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
import { Service } from 'src/services/entities/service.entity';
import { HtmlPdfService1 } from 'src/pdf/e1_goltech/html-pdf.service';
import { HtmlPdfServiciosService1 } from 'src/pdf/e1_goltech/html-pdf-servicios.service';
import { HtmlPdfServiciosService2 } from 'src/pdf/e2_juan_angel/html-pdf-servicios.service';
import { HtmlPdfServiciosService3 } from 'src/pdf/e3_giselle/html-pdf-servicios.service';
import { HtmlPdfServiciosService4 } from 'src/pdf/e4_orihuela/html-pdf-servicios.service';
import { HtmlPdfServiciosService5 } from 'src/pdf/e5_mariana/html-pdf-servicios.service';
import { HtmlPdfServiciosService6 } from 'src/pdf/e6_michelle/html-pdf-servicios.service';
import { HtmlPdfServiciosService7 } from 'src/pdf/e7_chalor/html-pdf-servicios.service';
import { HtmlPdfServiciosService8 } from 'src/pdf/e8_leyses/html-pdf-servicios.service';
import { HtmlPdfServiciosService9 } from 'src/pdf/e9_es/html-pdf-servicios.service';
import { HtmlPdfServiciosService10 } from 'src/pdf/e10_jessica/html-pdf-servicios.service';
import { HtmlPdfServiciosService11 } from 'src/pdf/e11_alamo/html-pdf-servicios.service';
import { HtmlPdfServiciosService12 } from 'src/pdf/e12_hugo/html-pdf-servicios.service';
import { HtmlPdfService2 } from 'src/pdf/e2_juan_angel/html-pdf.service';
import { HtmlPdfService3 } from 'src/pdf/e3_giselle/html-pdf.service';
import { HtmlPdfService4 } from 'src/pdf/e4_orihuela/html-pdf.service';
import { HtmlPdfService5 } from 'src/pdf/e5_mariana/html-pdf.service';
import { HtmlPdfService6 } from 'src/pdf/e6_michelle/html-pdf.service';
import { HtmlPdfService7 } from 'src/pdf/e7_chalor/html-pdf.service';
import { HtmlPdfService8 } from 'src/pdf/e8_leyses/html-pdf.service';
import { HtmlPdfService9 } from 'src/pdf/e9_es/html-pdf.service';
import { HtmlPdfService10 } from 'src/pdf/e10_jessica/html-pdf.service';
import { HtmlPdfService11 } from 'src/pdf/e11_alamo/html-pdf.service';
import { HtmlPdfService12 } from 'src/pdf/e12_hugo/html-pdf.service';
import { LicitacionService1 } from 'src/pdf/e1_goltech/licitacion.service';
import { LicitacionService2 } from 'src/pdf/e2_juan_angel/licitacion.service';  
import { LicitacionService3 } from 'src/pdf/e3_giselle/licitacion.service';
import { LicitacionService4 } from 'src/pdf/e4_orihuela/licitacion.service';
import { LicitacionService5 } from 'src/pdf/e5_mariana/licitacion.service';
import { LicitacionService6 } from 'src/pdf/e6_michelle/licitacion.service';
import { LicitacionService7 } from 'src/pdf/e7_chalor/licitacion.service';
import { LicitacionService8 } from 'src/pdf/e8_leyses/licitacion.service';
import { LicitacionService9 } from 'src/pdf/e9_es/licitacion.service';
import { LicitacionService10 } from 'src/pdf/e10_jessica/licitacion.service';
import { LicitacionService11 } from 'src/pdf/e11_alamo/licitacion.service';
import { LicitacionService12 } from 'src/pdf/e12_hugo/licitacion.service';
import { HtmlLicitacionService1 } from 'src/pdf/e1_goltech/html-licitacion.service';
import { HtmlLicitacionService2 } from 'src/pdf/e2_juan_angel/html-licitacion.service'; 
import { HtmlLicitacionService3 } from 'src/pdf/e3_giselle/html-licitacion.service';
import { HtmlLicitacionService4 } from 'src/pdf/e4_orihuela/html-licitacion.service';
import { HtmlLicitacionService5 } from 'src/pdf/e5_mariana/html-licitacion.service';
import { HtmlLicitacionService6 } from 'src/pdf/e6_michelle/html-licitacion.service';
import { HtmlLicitacionService7 } from 'src/pdf/e7_chalor/html-licitacion.service';
import { HtmlLicitacionService8 } from 'src/pdf/e8_leyses/html-licitacion.service';
import { HtmlLicitacionService9 } from 'src/pdf/e9_es/html-licitacion.service';
import { HtmlLicitacionService10 } from 'src/pdf/e10_jessica/html-licitacion.service';
import { HtmlLicitacionService11 } from 'src/pdf/e11_alamo/html-licitacion.service';
import { HtmlLicitacionService12 } from 'src/pdf/e12_hugo/html-licitacion.service';
import { ExcelTemplateService } from './excel/excel-template.service';
import { ExcelImportService } from './excel/excel-import.service';
import { Category } from 'src/categories/entities/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quote,
      QuoteItem,
      Product,
      Service,
      Category,
      Template,
    ]),
    UsersModule,
  ],
  controllers: [QuotesController],
  providers: [
    QuotesService,
    PdfService1,
    PdfServiciosService1,
    PdfServiciosService2,
    PdfServiciosService3,
    PdfServiciosService4,
    PdfServiciosService5,
    PdfServiciosService6,
    PdfServiciosService7,
    PdfServiciosService8,
    PdfServiciosService9,
    PdfServiciosService10,
    PdfServiciosService11,
    PdfServiciosService12,
    PdfService2,
    PdfService3,
    PdfService4,
    PdfService5,
    PdfService6,
    PdfService7,
    PdfService8,
    PdfService9,
    PdfService10,
    PdfService11,
    PdfService12,
    HtmlPdfService1,
    HtmlPdfServiciosService1,
    HtmlPdfServiciosService2,
    HtmlPdfServiciosService3,
    HtmlPdfServiciosService4,
    HtmlPdfServiciosService5,
    HtmlPdfServiciosService6,
    HtmlPdfServiciosService7,
    HtmlPdfServiciosService8,
    HtmlPdfServiciosService9,
    HtmlPdfServiciosService10,
    HtmlPdfServiciosService11,
    HtmlPdfServiciosService12,
    HtmlPdfService2,
    HtmlPdfService3,
    HtmlPdfService4,
    HtmlPdfService5,
    HtmlPdfService6,
    HtmlPdfService7,
    HtmlPdfService8,
    HtmlPdfService9,
    HtmlPdfService10,
    HtmlPdfService11,
    HtmlPdfService12,
    LicitacionService1,
    LicitacionService2,
    LicitacionService3,
    LicitacionService4,
    LicitacionService5, 
    LicitacionService6, 
    LicitacionService7,
    LicitacionService8,
    LicitacionService9,
    LicitacionService10,
    LicitacionService11,
    LicitacionService12,
    HtmlLicitacionService1,
    HtmlLicitacionService2,
    HtmlLicitacionService3,
    HtmlLicitacionService4,
    HtmlLicitacionService5,
    HtmlLicitacionService6,
    HtmlLicitacionService7,
    HtmlLicitacionService8,
    HtmlLicitacionService9,
    HtmlLicitacionService10,
    HtmlLicitacionService11,
    HtmlLicitacionService12,
    ExcelTemplateService,
    ExcelImportService,
  ],
})
export class QuotesModule {}
