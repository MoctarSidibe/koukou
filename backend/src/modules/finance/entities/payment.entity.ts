import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  PaymentMethod,
  PaymentStatus,
} from '../../../common/enums/payment-method.enum.js';
import { Farm } from '../../farms/entities/farm.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Sale } from './sale.entity.js';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @Column({ name: 'farm_id', type: 'uuid' })
  @Index()
  farmId: string;

  @ManyToOne(() => Sale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column({ name: 'sale_id', type: 'uuid' })
  @Index()
  saleId: string;

  @Column({ name: 'amount_fcfa', type: 'int' })
  amountFcfa: number;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ name: 'payment_date', type: 'date' })
  paymentDate: string;

  @Column({ name: 'idempotency_key', type: 'varchar', nullable: true })
  @Index()
  idempotencyKey: string | null;

  @Column({ name: 'cash_session_id', type: 'uuid', nullable: true })
  cashSessionId: string | null;

  @Column({ name: 'extra', type: 'jsonb', nullable: true })
  extra: Record<string, unknown> | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'operator_id' })
  operator: User | null;

  @Column({ name: 'operator_id', type: 'uuid', nullable: true })
  operatorId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
