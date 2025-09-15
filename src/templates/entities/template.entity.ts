import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({ type: 'bytea' })
  archivo: Buffer; // Guardamos el PDF directamente
}
