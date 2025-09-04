import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from 'src/quotes/entities/quote.entity';
import { QuoteItem } from 'src/quotes/entities/quote-item.entity';
import { PurchaseOrder } from 'src/orders/entities/purchase-order.entity';
import { Product } from 'src/products/entities/product.entity';
import { User } from 'src/users/entities/user.entity';
import { UserLoginLog } from 'src/auth/entities/user-login-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Quote, QuoteItem, PurchaseOrder, Product, User, UserLoginLog])],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
