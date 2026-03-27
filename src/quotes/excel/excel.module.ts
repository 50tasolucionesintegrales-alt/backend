import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from '../entities/quote.entity';
import { QuoteItem } from '../entities/quote-item.entity';
import { Product } from 'src/products/entities/product.entity';
import { Category } from 'src/categories/entities/category.entity';
import { ExcelTemplateService } from './excel-template.service';
import { ExcelImportService } from './excel-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, QuoteItem, Product, Category]),
  ],
  providers: [ExcelTemplateService, ExcelImportService],
  exports: [ExcelTemplateService, ExcelImportService],
})
export class ExcelModule {}