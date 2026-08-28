import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PromotionType } from '../../../common/enums/promotion-type.enum.js';
import { Farm } from '../../farms/entities/farm.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Customer } from './customer.entity.js';

@Entity('promotions')
@Unique('UQ_promotions_farm_code', ['farmId', 'code'])
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @Column({ name: 'farm_id', type: 'uuid' })
  @Index()
  farmId: string;

  @Column({ name: 'code', type: 'varchar' })
  @Index()
  code: string;

  @Column({ name: 'label' })
  label: string;

  @Column({ type: 'enum', enum: PromotionType })
  type: PromotionType;

  @Column({ type: 'int' })
  value: number;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'min_subtotal_fcfa', type: 'int', nullable: true })
  minSubtotalFcfa: number | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  @Index()
  customerId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
