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

  /* URLs de PDFs */
  @Column({ name: 'pdf_margen1_id', type: 'varchar', length: '255', nullable: true })
  pdfMargen1Id?: string | null;

  @Column({ name: 'pdf_margen2_id', type: 'varchar', length: '255', nullable: true })
  pdfMargen2Id?: string | null;

  @Column({ name: 'pdf_margen3_id', type: 'varchar', length: '255', nullable: true })
  pdfMargen3Id?: string | null;

  /* ---------- Ítems ---------- */
  @OneToMany(() => QuoteItem, (qi) => qi.quote, { cascade: true })
  items!: QuoteItem[];
}
