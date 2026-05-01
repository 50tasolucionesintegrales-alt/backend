import { Module } from '@nestjs/common';
import { PdfService2 } from './pdf.service';
import { HtmlPdfService2 } from './html-pdf.service';
import { PdfServiciosService2 } from './pdf-servicios.service';
import { HtmlPdfServiciosService2 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService2, 
    HtmlPdfService2,
    PdfServiciosService2,
    HtmlPdfServiciosService2
  ],
  exports: [PdfService2, PdfServiciosService2]
})
export class PdfModule2 {}