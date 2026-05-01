import { Module } from '@nestjs/common';
import { PdfService12 } from './pdf.service';
import { HtmlPdfService12 } from './html-pdf.service';
import { PdfServiciosService12 } from './pdf-servicios.service';
import { HtmlPdfServiciosService12 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService12,
    HtmlPdfService12,
    PdfServiciosService12,
    HtmlPdfServiciosService12
  ],
  exports: [PdfService12, PdfServiciosService12]
})
export class PdfModule12 {}