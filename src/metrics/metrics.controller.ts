// src/metrics/metrics.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/roles.enum';
import { RangeQueryDto } from './dto/range-query.dto';
import { IdValidationPipe } from 'src/common/pipes/id-validation/id-validation.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /* Top cotizadores */
  @Get('top-cotizadores')
  topCotizadores(@Query() q: RangeQueryDto) {
    return this.metrics.topCotizadores(q);
  }

  /* Top compradores */
  @Get('top-compradores')
  topCompradores(@Query() q: RangeQueryDto) {
    return this.metrics.topCompradores(q);
  }

  /* Top productos más cotizados */
  @Get('top-productos')
  topProductos(@Query() q: RangeQueryDto) {
    return this.metrics.topProductosCotizados(q);
  }

  /* Al hacer click en un usuario: sus cotizaciones del rango */
  @Get('users/:userId/quotes')
  quotesByUser(@Param('userId', IdValidationPipe) userId:number, @Query() q: RangeQueryDto) {
    return this.metrics.quotesByUser(userId, q);
  }

  /* Al hacer click en un usuario: sus órdenes del rango */
  @Get('users/:userId/orders')
  ordersByUser(@Param('userId', IdValidationPipe) userId:number, @Query() q: RangeQueryDto) {
    return this.metrics.ordersByUser(userId, q);
  }

  /* Actividad de login */
  @Get('top-logins')
  topLogins(@Query() q: RangeQueryDto) {
    return this.metrics.topLoginUsers(q);
  }

  @Get('logins/activity')
  loginActivity(@Query() q: RangeQueryDto) {
    return this.metrics.loginActivity(q);
  }

  @Get('users/:userId/logins')
  userLoginActivity(@Param('userId', IdValidationPipe) userId: string, @Query() q: RangeQueryDto) {
    return this.metrics.userLoginActivity(userId, q);
  }

  @Get('users/:userId/logins/count')
  userLoginCount(@Param('userId', IdValidationPipe) userId: string, @Query() q: RangeQueryDto) {
    return this.metrics.loginCountByUser(userId, q);
  }
}
