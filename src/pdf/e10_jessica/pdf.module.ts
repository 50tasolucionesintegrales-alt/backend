import { Module } from '@nestjs/common';
import { PdfService10 } from './pdf.service';
import { HtmlPdfService10 } from './html-pdf.service';
import { PdfServiciosService10 } from './pdf-servicios.service';
import { HtmlPdfServiciosService10 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService10,
    HtmlPdfService10,
    PdfServiciosService10,
    HtmlPdfServiciosService10
  ],
  exports: [PdfService10, PdfServiciosService10]
})
export class PdfModule10 {}