import { Module } from '@nestjs/common';
import { PdfService9 } from './pdf.service';
import { HtmlPdfService9 } from './html-pdf.service';

@Module({
  providers: [PdfService9, HtmlPdfService9],
  exports: [PdfService9]
})
export class PdfModule9 {}
