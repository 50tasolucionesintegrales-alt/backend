import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from 'src/users/entities/user.entity';

@Entity({ name: 'user_login_logs' })
export class UserLoginLog {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'user_id' })
    user?: User | null;

    // útil para loguear intentos fallidos con email no existente
    @Column({ type: 'varchar', length: 100, nullable: true })
    emailIntent?: string | null;

    @Column({ type: 'boolean', default: false })
    success!: boolean;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ip?: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_agent' })
    userAgent?: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;
}
