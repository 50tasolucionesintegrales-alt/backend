import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'templates' })
export class Template {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  destinatario?: string;

  @Column({ type: 'text', nullable: true })
  presente?: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({ name: 'folio', type: 'varchar', length: 100, nullable: true })
  folio?: string;

  @Column({ length: 200, nullable: true })
  lugar?: string;

  @Column({ name: 'incluir_firma', default: false })
  incluirFirma?: boolean;

  @Column({ name: 'firmante_nombre', length: 200, nullable: true })
  firmanteNombre?: string;

  @Column({ name: 'firmante_cargo', length: 200, nullable: true })
  firmanteCargo?: string;

  @Column({ name: 'condiciones_items', type: 'text', array: true, nullable: true })
  condicionesItems?: string[];

  @Column({ name: 'condiciones_text', type: 'text', nullable: true })
  condicionesText?: string;

  @Column({ name: 'condiciones_mode', length: 10, default: 'list' })
  condicionesMode?: 'list' | 'text';
}