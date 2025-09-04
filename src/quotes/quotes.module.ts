import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { Product } from 'src/products/entities/product.entity';
import { PdfService } from './pdf.service';
import { Service } from 'src/services/entities/service.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, QuoteItem, Product, Service]),
    UsersModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService, PdfService],
})
export class QuotesModule { }
