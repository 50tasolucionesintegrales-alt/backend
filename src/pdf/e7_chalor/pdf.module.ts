import { Module } from '@nestjs/common';
import { PdfService7 } from './pdf.service';
import { HtmlPdfService7 } from './html-pdf.service';

@Module({
  providers: [PdfService7, HtmlPdfService7],
  exports: [PdfService7]
})
export class PdfModule7 {
  
}
