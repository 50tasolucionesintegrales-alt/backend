import { Module } from '@nestjs/common';
import { PdfService3 } from './pdf.service';
import { HtmlPdfService3 } from './html-pdf.service';
import { PdfServiciosService3 } from './pdf-servicios.service';
import { HtmlPdfServiciosService3 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService3, 
    HtmlPdfService3,
    PdfServiciosService3,
    HtmlPdfServiciosService3
  ],
  exports: [PdfService3, PdfServiciosService3]
})
export class PdfModule3 {}