import { Module } from '@nestjs/common';
import { PdfService4 } from './pdf.service';
import { HtmlPdfService4} from './html-pdf.service';

@Module({
  providers: [PdfService4, HtmlPdfService4],
  exports: [PdfService4]
})
export class PdfModule4 {}
