import { Module } from '@nestjs/common';
import { PdfService5 } from './pdf.service';
import { HtmlPdfService5 } from './html-pdf.service';
import { PdfServiciosService5 } from './pdf-servicios.service';
import { HtmlPdfServiciosService5 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService5, 
    HtmlPdfService5,
    PdfServiciosService5,
    HtmlPdfServiciosService5
  ],
  exports: [PdfService5, PdfServiciosService5]
})
  export class PdfModule5 {}