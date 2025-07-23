import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

import { Role } from 'src/common/enums/roles.enum';

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: string;

    @Column({ type: 'varchar', length: 50 })
    nombre: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 50 })
    email: string;

    @Column({ length: 60 })
    password: string;

    @Column({ type: 'varchar',length: 6, nullable: true })
    token: string | null;

    @Column({ type: 'boolean', default: false })
    confirmed: boolean;

    @Column({ type: 'enum', enum: Role, default:Role.Unassigned})
    rol: Role;

    @Column({ type: 'varchar', name: 'google_id', nullable: true })
    googleId: string;

    @Column({ type: 'varchar', nullable: true })
    avatar: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
