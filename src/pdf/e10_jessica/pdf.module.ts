import { Module } from '@nestjs/common';
import { PdfService10 } from './pdf.service';
import { HtmlPdfService10 } from './html-pdf.service';

@Module({
  providers: [PdfService10, HtmlPdfService10],
  exports: [PdfService10]
})
export class PdfModule10 {}
