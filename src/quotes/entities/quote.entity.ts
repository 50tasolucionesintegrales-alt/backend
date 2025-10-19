import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { QuoteItem } from './quote-item.entity';
import { User } from 'src/users/entities/user.entity';
import { DecimalTransformer } from 'src/common/transformers/decimal.transformer';

@Entity({ name: 'quotes' })
export class Quote {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  /* ---------- Relaciones ---------- */
  @ManyToOne(() => User, (u) => u.quotes, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  /* ---------- Estado ---------- */
  @Column({
    type: 'enum',
    enum: ['draft', 'sent', 'approved', 'rejected'],
    default: 'draft',
  })
  status!: 'draft' | 'sent' | 'approved' | 'rejected';

  /* ---------- Metadatos ---------- */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt?: Date | null;

  @Column({
    type: 'enum',
    enum: ['productos', 'servicios'],
    default: 'productos',
  })
  tipo!: 'productos' | 'servicios';


  /* ---------- Información de negocio ---------- */
  @Column({ length: 120 })
  titulo!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column('numeric', { precision: 5, scale: 2, name: 'iva_pct', default: 16, transformer: DecimalTransformer })
  ivaPct!: number;

  /* Totales */
  @Column('decimal', {
    name: 'total_margen1', precision: 12, scale: 2,
    nullable: true, transformer: DecimalTransformer
  })
  totalMargen1?: number | null;

  @Column('decimal', {
    name: 'total_margen2', precision: 12, scale: 2,
    nullable: true, transformer: DecimalTransformer
  })
  totalMargen2?: number | null;

  @Column('decimal', {
    name: 'total_margen3', precision: 12, scale: 2,
    nullable: true, transformer: DecimalTransformer
  })
  totalMargen3?: number | null;

  @Column('decimal', {
    name: 'total_margen4', precision: 12, scale: 2,
    nullable: true, transformer: DecimalTransformer
  })
  totalMargen4?: number | null;

  @Column('decimal', {
    name: 'total_margen5', precision: 12, scale: 2,
    nullable: true, transformer: DecimalTransformer
  })
  totalMargen5?: number | null;

  @Column('decimal', {
    name: 'total_margen6', precision: 12, scale: 2,
    nullable: true, transformer: DecimalTransformer
  })
  totalMargen6?: number | null;

  @Column('decimal', {
    name: 'total_margen7', precision: 12, scale: 2,
    nullable: true, transformer: DecimalTransformer
  })
  totalMargen7?: number | null;

  @Column('decimal', {
    name: 'total_margen8', precision: 12, scale: 2,
    nullable: true, transformer: DecimalTransformer
  })
  totalMargen8?: number | null;

  @Column('decimal', {
    name: 'total_margen9', precision: 12, scale: 2,
    nullable: true, transformer: DecimalTransformer
  })
  totalMargen9?: number | null;

  @Column('decimal', {
    name: 'total_margen10', precision: 12, scale: 2,
    nullable: true, transformer: DecimalTransformer
  })
  totalMargen10?: number | null;

  /* IVA*/
  @Column('decimal', { name: 'total_iva1', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalIva1?: number | null;
  @Column('decimal', { name: 'total_iva2', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalIva2?: number | null;
  @Column('decimal', { name: 'total_iva3', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalIva3?: number | null;
  @Column('decimal', { name: 'total_iva4', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalIva4?: number | null;
  @Column('decimal', { name: 'total_iva5', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalIva5?: number | null;
  @Column('decimal', { name: 'total_iva6', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalIva6?: number | null;
  @Column('decimal', { name: 'total_iva7', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalIva7?: number | null;
  @Column('decimal', { name: 'total_iva8', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalIva8?: number | null;
  @Column('decimal', { name: 'total_iva9', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalIva9?: number | null;
  @Column('decimal', { name: 'total_iva10', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalIva10?: number | null;

  /* Totales con IVA*/
  @Column('decimal', { name: 'total_final1', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalFinal1?: number | null;
  @Column('decimal', { name: 'total_final2', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalFinal2?: number | null;
  @Column('decimal', { name: 'total_final3', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalFinal3?: number | null;
  @Column('decimal', { name: 'total_final4', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalFinal4?: number | null;
  @Column('decimal', { name: 'total_final5', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalFinal5?: number | null;
  @Column('decimal', { name: 'total_final6', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalFinal6?: number | null;
  @Column('decimal', { name: 'total_final7', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalFinal7?: number | null;
  @Column('decimal', { name: 'total_final8', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalFinal8?: number | null;
  @Column('decimal', { name: 'total_final9', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalFinal9?: number | null;
  @Column('decimal', { name: 'total_final10', precision: 12, scale: 2, nullable: true, transformer: DecimalTransformer })
  totalFinal10?: number | null;

  /* ---------- Ítems ---------- */
  @OneToMany(() => QuoteItem, (qi) => qi.quote, { cascade: true })
  items!: QuoteItem[];
}
