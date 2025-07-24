import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Service } from 'src/services/entities/service.entity';

/**
 * Representa la tabla CATEGORIES del esquema.
 */
@Entity({ name: 'categories' })
export class Category {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string; // Usa string para no perder precisión con bigint

  @Column({ type: 'varchar', length: 255 })
  @Index({ unique: true })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  /* ---------- Relaciones ---------- */
  @OneToMany(() => Product, (product) => product.category, {
    cascade: ['remove'],
  })
  products!: Product[];
  @OneToMany(() => Service, (s) => s.category, { cascade: ['remove'] })
  services!: Service[];
}
