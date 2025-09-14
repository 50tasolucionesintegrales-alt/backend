import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { HtmlPdfService } from './html-pdf.service';

@Module({
  providers: [PdfService, HtmlPdfService],
  exports: [PdfService]
})
export class PdfModule {}
