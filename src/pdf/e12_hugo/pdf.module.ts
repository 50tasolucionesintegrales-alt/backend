import { Module } from '@nestjs/common';
import { PdfService12 } from './pdf.service';
import { HtmlPdfService12 } from './html-pdf.service';

@Module({
  providers: [PdfService12, HtmlPdfService12],
  exports: [PdfService12]
})
export class PdfModule12 {}