import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QuoteItem } from './quote-item.entity';
import { User } from 'src/users/entities/user.entity';

@Entity({ name: 'quotes' })
export class Quote {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;

  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'enum',
    enum: ['draft', 'sent', 'approved', 'rejected'],
    default: 'draft',
  })
  status!: 'draft' | 'sent' | 'approved' | 'rejected';

  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;

  @Column({ nullable: true }) pdf_margen1_url?: string;
  @Column({ nullable: true }) pdf_margen2_url?: string;
  @Column({ nullable: true }) pdf_margen3_url?: string;

  @OneToMany(() => QuoteItem, (qi) => qi.quote, { cascade: true })
  items!: QuoteItem[];
}
