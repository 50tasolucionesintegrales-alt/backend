import { Module } from '@nestjs/common';
import { PdfService6 } from './pdf.service';
import { HtmlPdfService6 } from './html-pdf.service';
import { PdfServiciosService6 } from './pdf-servicios.service';
import { HtmlPdfServiciosService6 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService6, 
    HtmlPdfService6,
    PdfServiciosService6,
    HtmlPdfServiciosService6
  ],
  exports: [PdfService6, PdfServiciosService6]
})
export class PdfModule6 {}