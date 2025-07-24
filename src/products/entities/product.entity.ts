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

/** Tabla PRODUCTS */
@Entity({ name: 'products' })
export class Product {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  /* -------- FK a CATEGORIES -------- */
  @ManyToOne(
    () => Category,
    (category) => category.products,
    {
      eager: true,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  /* -------- FK a USERS (creador) -------- */
  @ManyToOne(
    () => User,
    (u) => u.productosCreados,
    {
      nullable: true,
      onDelete: 'SET NULL',
    },
  )
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  /* -------- Campos propios -------- */
  @Column({ type: 'varchar', length: 255 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precio!: string;

  @Column({ type: 'jsonb', nullable: true })
  especificaciones?: Record<string, any>;

  @Column({ type: 'varchar', length: 512, nullable: true })
  link_compra?: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  image_url?: string;

  /* -------- Metadatos -------- */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
