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
import { CashSessionStatus } from '../../../common/enums/cash-session-status.enum.js';
import { Farm } from '../../farms/entities/farm.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('cash_sessions')
export class CashSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @Column({ name: 'farm_id', type: 'uuid' })
  @Index()
  farmId: string;

  @Column({
    type: 'enum',
    enum: CashSessionStatus,
    default: CashSessionStatus.OPEN,
  })
  status: CashSessionStatus;

  @Column({ name: 'opened_at', type: 'date' })
  openedAt: string;

  @Column({ name: 'opening_balance_fcfa', type: 'int', default: 0 })
  openingBalanceFcfa: number;

  @Column({ name: 'closing_balance_fcfa', type: 'int', nullable: true })
  closingBalanceFcfa: number | null;

  @Column({ name: 'closing_expected_fcfa', type: 'int', nullable: true })
  closingExpectedFcfa: number | null;

  @Column({ name: 'closing_difference_fcfa', type: 'int', nullable: true })
  closingDifferenceFcfa: number | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'opened_by' })
  openedBy: User | null;

  @Column({ name: 'opened_by', type: 'uuid', nullable: true })
  openedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closedBy: User | null;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
