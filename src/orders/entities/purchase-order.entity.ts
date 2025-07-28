import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { DecimalTransformer } from 'src/common/transformers/decimal.transformer';

@Entity({ name: 'purchase_orders' })
export class PurchaseOrder {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @ManyToOne(() => User, (u) => u.purchaseOrders, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'user_id' })
    user!: User | null;

    @Column({ type: 'varchar', length: 120 })
    titulo!: string;

    @Column({ type: 'text', nullable: true })
    descripcion?: string | null;

    /* draft → sent → partially_approved / approved / rejected */
    @Column({
        type: 'enum',
        enum: ['draft', 'sent', 'partially_approved', 'approved', 'rejected'],
        default: 'draft',
    })
    status!: 'draft' | 'sent' | 'partially_approved' | 'approved' | 'rejected';

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
    sentAt?: Date | null;

    @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
    resolvedAt?: Date | null;     // cuando quedó approved o rejected

    /* Totales */
    @Column('decimal', {
        precision: 12,
        scale: 2,
        transformer: DecimalTransformer,
        nullable: true,
    })
    total!: number | null;

    /* % de ítems aprobados (0‑100) */
    @Column({ type: 'float', name: 'progress_pct', default: 0 })
    progressPct!: number;

    @OneToMany(() => PurchaseOrderItem, (it) => it.order, { cascade: true })
    items!: PurchaseOrderItem[];
}
