import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'products' })
export class Product {

  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @ManyToOne(() => Category, (category) => category.products, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_by' })
  createdBy?: User | null;

  /* -------- Campos -------- */

  @Column('varchar', { length: 255 })
  nombre!: string;

  /** IMPORTANTE: nullable para evitar ALTER */
  @Column('varchar', { length: 128, nullable: true })
  descripcion?: string | null;

  @Column('decimal', { precision: 10, scale: 2 })
  precio!: string;

  @Column('jsonb', { nullable: true })
  especificaciones?: Record<string, any>;

  /** IMPORTANTE: mantener nullable */
  @Column('varchar', { length: 512, nullable: true })
  link_compra?: string | null;

  @Column('bytea', { name: 'image_data', nullable: true })
  imageData?: Buffer | null;

  @Column('varchar', { length: 255, name: 'image_mime', nullable: true })
  imageMime?: string | null;

  @Column('varchar', { length: 255, name: 'image_name', nullable: true })
  imageName?: string | null;

  @Column('int', { name: 'image_size', nullable: true })
  imageSize?: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}