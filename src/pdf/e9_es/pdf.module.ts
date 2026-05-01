import { Module } from '@nestjs/common';
import { PdfService9 } from './pdf.service';
import { HtmlPdfService9 } from './html-pdf.service';
import { PdfServiciosService9 } from './pdf-servicios.service';
import { HtmlPdfServiciosService9 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService9, 
    HtmlPdfService9,
    PdfServiciosService9,
    HtmlPdfServiciosService9
  ],
  exports: [PdfService9, PdfServiciosService9]
})
export class PdfModule9 {}