import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethod } from '../../../common/enums/payment-method.enum.js';

@Entity('payment_methods')
export class PaymentMethodConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PaymentMethod, unique: true })
  code: PaymentMethod;

  @Column()
  label: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'display_hint', type: 'varchar', nullable: true })
  displayHint: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
