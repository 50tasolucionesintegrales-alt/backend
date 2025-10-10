// entities/category.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity({ name: 'categories' })
export class Category {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  nombre!: string;

  @Column({ type: 'varchar', length: 255, default: '' }) 
  @Index({ unique: true })
  nombre_norm!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @OneToMany(() => Product, (product) => product.category, { cascade: ['remove'] })
  products!: Product[];
}
