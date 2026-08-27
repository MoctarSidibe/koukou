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
  CashMovementSource,
  CashMovementType,
} from '../../../common/enums/cash-session-status.enum.js';
import { Farm } from '../../farms/entities/farm.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { CashSession } from './cash-session.entity.js';
import { Sale } from './sale.entity.js';

@Entity('cash_movements')
export class CashMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @Column({ name: 'farm_id', type: 'uuid' })
  @Index()
  farmId: string;

  @ManyToOne(() => CashSession, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cash_session_id' })
  cashSession: CashSession | null;

  @Column({ name: 'cash_session_id', type: 'uuid', nullable: true })
  @Index()
  cashSessionId: string | null;

  @Column({ type: 'enum', enum: CashMovementType })
  type: CashMovementType;

  @Column({
    type: 'enum',
    enum: CashMovementSource,
    default: CashMovementSource.MANUAL,
  })
  source: CashMovementSource;

  @Column({ name: 'amount_fcfa', type: 'int' })
  amountFcfa: number;

  @Column({ name: 'reason', type: 'varchar', nullable: true })
  reason: string | null;

  @ManyToOne(() => Sale, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale | null;

  @Column({ name: 'sale_id', type: 'uuid', nullable: true })
  saleId: string | null;

  @Column({ name: 'movement_date', type: 'date' })
  movementDate: string;

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
