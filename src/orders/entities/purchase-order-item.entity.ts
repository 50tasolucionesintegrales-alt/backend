import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from 'src/products/entities/product.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { DecimalTransformer } from 'src/common/transformers/decimal.transformer';

@Entity({ name: 'purchase_order_items' })
export class PurchaseOrderItem {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @ManyToOne(() => PurchaseOrder, (o) => o.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order!: PurchaseOrder;

    @ManyToOne(() => Product, { eager: true })
    @JoinColumn({ name: 'product_id' })
    product!: Product;

    @Column('int')
    cantidad!: number;

    @Column('decimal', {
        precision: 10,
        scale: 2,
        transformer: DecimalTransformer,
    })
    costo_unitario!: number;

    @Column('decimal', {
        precision: 12,
        scale: 2,
        transformer: DecimalTransformer,
    })
    subtotal!: number;

    /* Evidencia */
    @Column({ type: 'varchar', length: 512, nullable: true })
    evidenceUrl?: string | null;

    /* Estado del ítem en aprobación */
    @Column({
        type: 'enum',
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    })
    status!: 'pending' | 'approved' | 'rejected';

    @Column({ type: 'text', nullable: true })
    rejectReason?: string | null;

    @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
    approvedAt?: Date | null;
}
