import { Module } from '@nestjs/common';
import { PdfService11 } from './pdf.service';
import { HtmlPdfService11 } from './html-pdf.service';
import { PdfServiciosService11 } from './pdf-servicios.service';
import { HtmlPdfServiciosService11 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService11,
    HtmlPdfService11,
    PdfServiciosService11,
    HtmlPdfServiciosService11
  ],
  exports: [PdfService11, PdfServiciosService11]
})
export class PdfModule11 {}