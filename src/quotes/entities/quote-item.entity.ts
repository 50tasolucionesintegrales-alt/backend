import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Quote } from './quote.entity';
import { Product } from 'src/products/entities/product.entity';

@Entity({ name: 'quote_items' })
export class QuoteItem {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;

  @ManyToOne(() => Quote, (q) => q.items)
  @JoinColumn({ name: 'quote_id' })
  quote!: Quote;

  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column('int') cantidad!: number;
  @Column('decimal', { precision: 10, scale: 2 }) costo_unitario!: string;

  @Column('numeric', {
    precision: 5,
    scale: 2,
    name: 'margen_pct1',
    nullable: true,
  })
  margenPct1?: string;
  @Column('numeric', {
    precision: 5,
    scale: 2,
    name: 'margen_pct2',
    nullable: true,
  })
  margenPct2?: string;
  @Column('numeric', {
    precision: 5,
    scale: 2,
    name: 'margen_pct3',
    nullable: true,
  })
  margenPct3?: string;

  @Column({
    type: 'enum',
    enum: ['1', '2', '3'],
    name: 'margen_seleccionado',
    nullable: true,
  })
  margenSeleccionado?: '1' | '2' | '3';

  @Column('decimal', {
    precision: 10,
    scale: 2,
    name: 'precio_final',
    nullable: true,
  })
  precioFinal?: string;

  @Column('decimal', { precision: 10, scale: 2 }) subtotal!: string;
}
