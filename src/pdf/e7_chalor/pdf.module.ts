import { Module } from '@nestjs/common';
import { PdfService7 } from './pdf.service';
import { HtmlPdfService7 } from './html-pdf.service';
import { PdfServiciosService7 } from './pdf-servicios.service';
import { HtmlPdfServiciosService7 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService7,
    HtmlPdfService7,
    PdfServiciosService7,
    HtmlPdfServiciosService7,
  ],
  exports: [PdfService7, PdfServiciosService7],
})
export class PdfModule7 {}