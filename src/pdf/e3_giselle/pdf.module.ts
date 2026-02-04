import { Module } from '@nestjs/common';
import { PdfService3 } from './pdf.service';
import { HtmlPdfService3 } from './html-pdf.service';

@Module({
  providers: [PdfService3, HtmlPdfService3],
  exports: [PdfService3]
})
export class PdfModule3 {}
