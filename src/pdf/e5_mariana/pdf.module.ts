import { Module } from '@nestjs/common';
import { PdfService5 } from './pdf.service';
import { HtmlPdfService5 } from './html-pdf.service';

@Module({
  providers: [PdfService5, HtmlPdfService5],
  exports: [PdfService5]
})
  export class PdfModule5 {}
