import { Module } from '@nestjs/common';
import { PdfService1 } from './pdf.service';
import { HtmlPdfService1 } from './html-pdf.service';

@Module({
  providers: [PdfService1, HtmlPdfService1],
  exports: [PdfService1]
})
export class PdfModule1 {}
