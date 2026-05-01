import { Module } from '@nestjs/common';
import { PdfService8 } from './pdf.service';
import { HtmlPdfService8 } from './html-pdf.service';
import { PdfServiciosService8 } from './pdf-servicios.service';
import { HtmlPdfServiciosService8 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService8, 
    HtmlPdfService8,
    PdfServiciosService8,
    HtmlPdfServiciosService8
  ],
  exports: [PdfService8, PdfServiciosService8]
})
export class PdfModule8 {}