import { Module } from '@nestjs/common';
import { PdfService1 } from './pdf.service';
import { HtmlPdfService1 } from './html-pdf.service';
import { PdfServiciosService1 } from './pdf-servicios.service';
import { HtmlPdfServiciosService1 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService1, 
    HtmlPdfService1,
    PdfServiciosService1,
    HtmlPdfServiciosService1
  ],
  exports: [PdfService1, PdfServiciosService1]
})
export class PdfModule1 {}