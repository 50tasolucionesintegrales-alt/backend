import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { typeOrmConfig } from './config/typeorm.config';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { ServicesModule } from './services/services.module';
import { QuotesModule } from './quotes/quotes.module';
import { OrdersModule } from './orders/orders.module';
import { MetricsModule } from './metrics/metrics.module';
import { PdfModule } from './pdf/pdf.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: typeOrmConfig,
      inject: [ConfigService],
    }),
    UsersModule,
    MailModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    ServicesModule,
    QuotesModule,
    OrdersModule,
    MetricsModule,
    PdfModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
