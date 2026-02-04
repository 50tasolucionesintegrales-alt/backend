import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
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
    {
      nullable: true,
      onDelete: 'SET NULL',
    },
  )
  @JoinColumn({ name: 'created_by' })
  createdBy?: User | null;

  /* -------- Campos propios -------- */
  @Column({ type: 'varchar', length: 255 })
  nombre!: string;

  @Column({ type: 'varchar', length: 128 })
  descripcion!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precio!: string;

  @Column({ type: 'jsonb', nullable: true })
  especificaciones?: Record<string, any>;

  @Column({ type: 'varchar', length: 512, nullable: true })
  link_compra?: string | null;

  @Column({ type: 'bytea', name: 'image_data', nullable: true })
  imageData?: Buffer | null;

  @Column({ type: 'varchar', length: 255, name: 'image_mime', nullable: true })
  imageMime?: string | null;

  @Column({ type: 'varchar', length: 255, name: 'image_name', nullable: true })
  imageName?: string | null;

  @Column({ type: 'int', name: 'image_size', nullable: true })
  imageSize?: number | null;

  /* -------- Metadatos -------- */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
