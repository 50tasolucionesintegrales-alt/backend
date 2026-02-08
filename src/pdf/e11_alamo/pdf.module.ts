import { Module } from '@nestjs/common';
import { PdfService11 } from './pdf.service';
import { HtmlPdfService11 } from './html-pdf.service';

@Module({
  providers: [PdfService11, HtmlPdfService11],
  exports: [PdfService11]
})
export class PdfModule11 {}
