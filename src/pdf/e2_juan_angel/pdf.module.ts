import { Module } from '@nestjs/common';
import { PdfService2 } from './pdf.service';
import { HtmlPdfService2 } from './html-pdf.service';

@Module({
  providers: [PdfService2, HtmlPdfService2],
  exports: [PdfService2]
})
export class PdfModule2 {}
