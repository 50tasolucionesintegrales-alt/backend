/* src/quotes/entities/quote-item.entity.ts */
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Quote } from './quote.entity';
import { Product } from 'src/products/entities/product.entity';
import { DecimalTransformer } from 'src/common/transformers/decimal.transformer';
import { Service } from 'src/services/entities/service.entity';

@Entity({ name: 'quote_items' })
export class QuoteItem {
  /* ---------- PK ---------- */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  /* ---------- Relaciones ---------- */
  @ManyToOne(() => Quote, (q) => q.items)
  @JoinColumn({ name: 'quote_id' })
  quote!: Quote;

  @ManyToOne(() => Product, { eager: true, nullable:true })
  @JoinColumn({ name: 'product_id' })
  product!: Product | null;

  @ManyToOne(() => Service, { eager: true, nullable: true })
  @JoinColumn({ name: 'service_id' })
  service?: Service | null;

  /* ---------- Datos base ---------- */
  @Column('int')
  cantidad!: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
  })
  costo_unitario!: number;

  /* ---------- Porcentajes de margen ---------- */
  @Column('numeric', {
    precision: 5,
    scale: 2,
    name: 'margen_pct1',
    nullable: true,
    transformer: DecimalTransformer,
  })
  margenPct1?: number | null;

  @Column('numeric', {
    precision: 5,
    scale: 2,
    name: 'margen_pct2',
    nullable: true,
    transformer: DecimalTransformer,
  })
  margenPct2?: number | null;

  @Column('numeric', {
    precision: 5,
    scale: 2,
    name: 'margen_pct3',
    nullable: true,
    transformer: DecimalTransformer,
  })
  margenPct3?: number | null;

  /* ---------- Precios finales ---------- */
  @Column('decimal', {
    precision: 10,
    scale: 2,
    name: 'precio_final1',
    nullable: true,
    transformer: DecimalTransformer,
  })
  precioFinal1?: number | null;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    name: 'precio_final2',
    nullable: true,
    transformer: DecimalTransformer,
  })
  precioFinal2?: number | null;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    name: 'precio_final3',
    nullable: true,
    transformer: DecimalTransformer,
  })
  precioFinal3?: number | null;

  /* ---------- Subtotales ---------- */
  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  subtotal1?: number | null;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  subtotal2?: number | null;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  subtotal3?: number | null;
}
