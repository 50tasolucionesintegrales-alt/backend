import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { Product } from 'src/products/entities/product.entity';
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
import { Service } from 'src/services/entities/service.entity';
import { HtmlPdfService1 } from 'src/pdf/e1_goltech/html-pdf.service';
import { HtmlPdfService2 } from 'src/pdf/e2_juan_angel/html-pdf.service';
import { HtmlPdfService3 } from 'src/pdf/e3_giselle/html-pdf.service';
import { HtmlPdfService4 } from 'src/pdf/e4_orihuela/html-pdf.service';
import { HtmlPdfService5 } from 'src/pdf/e5_mariana/html-pdf.service';
import { HtmlPdfService6 } from 'src/pdf/e6_michelle/html-pdf.service';
import { HtmlPdfService7 } from 'src/pdf/e7_chalor/html-pdf.service';
import { HtmlPdfService8 } from 'src/pdf/e8_leyses/html-pdf.service';
import { HtmlPdfService9 } from 'src/pdf/e9_es/html-pdf.service';
import { HtmlPdfService10 } from 'src/pdf/e10_jessica/html-pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, QuoteItem, Product, Service]),
    UsersModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService, 
    PdfService1, 
    PdfService2, 
    PdfService3, 
    PdfService4, 
    PdfService5, 
    PdfService6, 
    PdfService7, 
    PdfService8, 
    PdfService9, 
    PdfService10, 
    HtmlPdfService1, 
    HtmlPdfService2, 
    HtmlPdfService3, 
    HtmlPdfService4, 
    HtmlPdfService5, 
    HtmlPdfService6, 
    HtmlPdfService7, 
    HtmlPdfService8, 
    HtmlPdfService9, 
    HtmlPdfService10],
})
export class QuotesModule { }