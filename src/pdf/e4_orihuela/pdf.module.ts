import { Module } from '@nestjs/common';
import { PdfService4 } from './pdf.service';
import { HtmlPdfService4} from './html-pdf.service';
import { PdfServiciosService4 } from './pdf-servicios.service';
import { HtmlPdfServiciosService4 } from './html-pdf-servicios.service';

@Module({
  providers: [
    PdfService4, 
    HtmlPdfService4,
    PdfServiciosService4,
    HtmlPdfServiciosService4
  ],
  exports: [PdfService4, PdfServiciosService4]
})
export class PdfModule4 {}