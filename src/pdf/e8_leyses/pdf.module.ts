import { Module } from '@nestjs/common';
import { PdfService8 } from './pdf.service';
import { HtmlPdfService8 } from './html-pdf.service';

@Module({
  providers: [PdfService8, HtmlPdfService8],
  exports: [PdfService8]
})
export class PdfModule8 {}
