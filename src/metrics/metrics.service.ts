import { BadRequestException, Injectable } from '@nestjs/common';
import { MetricsPreset, RangeQueryDto } from './dto/range-query.dto';
import { Between, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Quote } from 'src/quotes/entities/quote.entity';
import { QuoteItem } from 'src/quotes/entities/quote-item.entity';
import { PurchaseOrder } from 'src/orders/entities/purchase-order.entity';
import { Product } from 'src/products/entities/product.entity';
import { User } from 'src/users/entities/user.entity';
import { UserLoginLog } from 'src/auth/entities/user-login-log.entity';

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(Quote) private quotesRepo: Repository<Quote>,
    @InjectRepository(QuoteItem) private quoteItemsRepo: Repository<QuoteItem>,
    @InjectRepository(PurchaseOrder) private ordersRepo: Repository<PurchaseOrder>,
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(UserLoginLog) private loginLogsRepo: Repository<UserLoginLog>
  ) { }

  /* ───────── Helpers de rango ───────── */

  private floorStart(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  private ceilEnd(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  private resolveRange(dto: RangeQueryDto) {
    const preset = dto.preset ?? MetricsPreset.LAST_30D;
    const now = new Date();

    const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

    let from: Date;
    let to: Date;

    switch (preset) {
      case MetricsPreset.LAST_7D: {
        to = now;
        from = new Date(now);
        from.setDate(from.getDate() - 6);
        break;
      }
      case MetricsPreset.LAST_30D: {
        to = now;
        from = new Date(now);
        from.setDate(from.getDate() - 29);
        break;
      }
      case MetricsPreset.THIS_MONTH: {
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      }
      case MetricsPreset.LAST_MONTH: {
        const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        from = startOfMonth(last);
        to = endOfMonth(last);
        break;
      }
      case MetricsPreset.YTD: {
        from = new Date(now.getFullYear(), 0, 1);
        to = now;
        break;
      }
      case MetricsPreset.ALL_TIME: {
        from = new Date(1970, 0, 1);
        to = now;
        break;
      }
      case MetricsPreset.CUSTOM: {
        if (!dto.desde || !dto.hasta) {
          throw new BadRequestException('Para preset "custom" debes enviar desde y hasta');
        }
        from = new Date(dto.desde);
        to = new Date(dto.hasta);
        break;
      }
      default:
        to = now;
        from = new Date(now);
        from.setDate(from.getDate() - 29);
    }

    return { from: this.floorStart(from), to: this.ceilEnd(to), limit: dto.limit ?? 10 };
  }

  /* ───────── Top cotizadores ───────── */

  async topCotizadores(dto: RangeQueryDto) {
    const { from, to, limit } = this.resolveRange(dto);

    const rows = await this.quotesRepo
      .createQueryBuilder('q')
      .innerJoin('q.user', 'u')
      .select('u.id', 'userId')
      .addSelect('u.nombre', 'nombre')
      .addSelect('u.email', 'email')
      .addSelect('COUNT(q.id)', 'cantidad')
      .addSelect('COALESCE(SUM(q.totalMargen1), 0)', 'total_m1')
      .addSelect('COALESCE(SUM(q.totalMargen2), 0)', 'total_m2')
      .addSelect('COALESCE(SUM(q.totalMargen3), 0)', 'total_m3')
      .where('q.status = :sent', { sent: 'sent' })
      .andWhere('q.sentAt BETWEEN :from AND :to', { from, to })
      .groupBy('u.id')
      .addGroupBy('u.nombre')
      .addGroupBy('u.email')
      .orderBy('cantidad', 'DESC')
      .addOrderBy('total_m1', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r) => ({
      userId: String(r.userId),
      nombre: r.nombre,
      email: r.email,
      cantidad: Number(r.cantidad),
      totalMargen1: Number(r.total_m1),
      totalMargen2: Number(r.total_m2),
      totalMargen3: Number(r.total_m3),
      rango: { from, to },
    }));
  }

  /* ───────── Top compradores ───────── */

  async topCompradores(dto: RangeQueryDto) {
    const { from, to, limit } = this.resolveRange(dto);

    const rows = await this.ordersRepo
      .createQueryBuilder('o')
      .innerJoin('o.user', 'u')
      .select('u.id', 'userId')
      .addSelect('u.nombre', 'nombre')
      .addSelect('u.email', 'email')
      .addSelect('COUNT(o.id)', 'cantidad')
      .addSelect('COALESCE(SUM(o.total), 0)', 'monto_total')
      .where('o.status != :draft', { draft: 'draft' })
      .andWhere('o.sentAt BETWEEN :from AND :to', { from, to })
      .groupBy('u.id')
      .addGroupBy('u.nombre')
      .addGroupBy('u.email')
      .orderBy('cantidad', 'DESC')
      .addOrderBy('monto_total', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r) => ({
      userId: String(r.userId),
      nombre: r.nombre,
      email: r.email,
      cantidad: Number(r.cantidad),      // # de órdenes enviadas
      montoTotal: Number(r.monto_total), // suma de totales
      rango: { from, to },
    }));
  }

  /* ───────── Top productos más cotizados ───────── */

  async topProductosCotizados(dto: RangeQueryDto) {
    const { from, to, limit } = this.resolveRange(dto);

    const rows = await this.quoteItemsRepo
      .createQueryBuilder('qi')
      .innerJoin('qi.quote', 'q')
      .innerJoin('qi.product', 'p')
      .select('p.id', 'productId')
      .addSelect('p.nombre', 'nombre')
      .addSelect('COUNT(qi.id)', 'veces')
      .addSelect('COALESCE(SUM(qi.cantidad), 0)', 'cantidad_total')
      .where('q.status = :sent', { sent: 'sent' })
      .andWhere('q.sentAt BETWEEN :from AND :to', { from, to })
      .groupBy('p.id')
      .addGroupBy('p.nombre')
      .orderBy('veces', 'DESC')
      .addOrderBy('cantidad_total', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r) => ({
      productId: String(r.productId),
      nombre: r.nombre,
      vecesCotizado: Number(r.veces),
      cantidadTotal: Number(r.cantidad_total),
      rango: { from, to },
    }));
  }

  /* ───────── Listas por usuario ───────── */

  async quotesByUser(userId: number, dto: RangeQueryDto) {
    const { from, to } = this.resolveRange(dto);

    const quotes = await this.quotesRepo.find({
      where: {
        user: { id: userId } as any,
        status: 'sent',
        sentAt: Between(from, to),
      },
      relations: ['items', 'items.product', 'items.service', 'user'],
      order: { sentAt: 'DESC' },
    });

    return { userId, total: quotes.length, quotes, rango: { from, to } };
  }

  async ordersByUser(userId: number, dto: RangeQueryDto) {
    const { from, to } = this.resolveRange(dto);

    const orders = await this.ordersRepo.find({
      where: {
        user: { id: userId } as any,
        status: Not('draft'),
        sentAt: Between(from, to),
      },
      relations: ['items', 'items.product', 'user'],
      order: { sentAt: 'DESC' },
    });

    return { userId, total: orders.length, orders, rango: { from, to } };
  }

  /* ───── Logins (actividad) ───── */
  async topLoginUsers(dto: RangeQueryDto) {
    const { from, to, limit } = this.resolveRange(dto);
    const rows = await this.loginLogsRepo
      .createQueryBuilder('l')
      .innerJoin('l.user', 'u')
      .select('u.id', 'userId')
      .addSelect('u.nombre', 'nombre')
      .addSelect('u.email', 'email')
      .addSelect('COUNT(l.id)', 'logins')
      .where('l.success = true')
      .andWhere('l.created_at BETWEEN :from AND :to', { from, to }) // created_at = nombre de columna
      .groupBy('u.id').addGroupBy('u.nombre').addGroupBy('u.email')
      .orderBy('logins', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map(r => ({
      userId: String(r.userId),
      nombre: r.nombre,
      email: r.email,
      logins: Number(r.logins),
      rango: { from, to },
    }));
  }

  async loginActivity(dto: RangeQueryDto) {
    const { from, to } = this.resolveRange(dto);
    const rows = await this.loginLogsRepo
      .createQueryBuilder('l')
      .select("date_trunc('day', l.created_at)", 'day')
      .addSelect('COUNT(*)', 'logins')
      .where('l.success = true')
      .andWhere('l.created_at BETWEEN :from AND :to', { from, to })
      .groupBy("date_trunc('day', l.created_at)")
      .orderBy('day', 'ASC')
      .getRawMany();

    return rows.map(r => ({ day: r.day, logins: Number(r.logins) }));
  }

  async userLoginActivity(userId: string, dto: RangeQueryDto) {
    const { from, to } = this.resolveRange(dto);
    const rows = await this.loginLogsRepo
      .createQueryBuilder('l')
      .select("date_trunc('day', l.created_at)", 'day')
      .addSelect('COUNT(*)', 'logins')
      .where('l.success = true')
      .andWhere('l.user = :userId', { userId })
      .andWhere('l.created_at BETWEEN :from AND :to', { from, to })
      .groupBy("date_trunc('day', l.created_at)")
      .orderBy('day', 'ASC')
      .getRawMany();

    return {
      userId,
      rango: { from, to },
      data: rows.map(r => ({ day: r.day, logins: Number(r.logins) })),
    };
  }

  async loginCountByUser(userId: string, dto: RangeQueryDto) {
    const { from, to } = this.resolveRange(dto);
    const row = await this.loginLogsRepo
      .createQueryBuilder('l')
      .select('COUNT(*)', 'total')
      .addSelect('MAX(l.created_at)', 'last')
      .where('l.success = true')
      .andWhere('l.user = :userId', { userId })
      .andWhere('l.created_at BETWEEN :from AND :to', { from, to })
      .getRawOne<{ total: string; last: Date | null }>();

    return {
      userId: String(userId),
      count: Number(row?.total ?? 0),
      lastLoginAt: row?.last ?? null,
      rango: { from, to },
    };
  }
}
