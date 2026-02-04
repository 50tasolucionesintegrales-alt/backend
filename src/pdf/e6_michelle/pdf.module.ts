import { Module } from '@nestjs/common';
import { PdfService6 } from './pdf.service';
import { HtmlPdfService6 } from './html-pdf.service';

@Module({
  providers: [PdfService6, HtmlPdfService6],
  exports: [PdfService6]
})
export class PdfModule6 {}
