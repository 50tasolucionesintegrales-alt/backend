// src/services/entities/service.entity.ts
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

@Entity({ name: 'services' })
export class Service {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @ManyToOne(
    () => Category,
    (c) => c.services,
    { eager: true, onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @ManyToOne(
    () => User,
    // (u) => u.serviciosCreados,
    { nullable: true, onDelete: 'SET NULL' },
  )
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  /* -- Campos propios del servicio -- */
  @Column({ type: 'varchar', length: 255 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  precioBase?: string;

  @Column({ type: 'int', nullable: true })
  duracionMinutos?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
