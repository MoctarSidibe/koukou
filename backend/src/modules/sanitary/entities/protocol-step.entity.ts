import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CareType } from '../../../common/enums/care-type.enum.js';

@Entity('protocol_steps')
export class ProtocolStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'protocol_id', type: 'uuid' })
  @Index()
  protocolId: string;

  @Column({ name: 'step_order', type: 'int' })
  stepOrder: number;

  @Column({ name: 'day_from', type: 'int' })
  dayFrom: number;

  @Column({ name: 'day_to', type: 'int' })
  dayTo: number;

  @Column({ name: 'care_type', type: 'enum', enum: CareType })
  careType: CareType;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  dosage: string | null;

  @Column({ type: 'varchar', nullable: true })
  route: string | null;

  @Column({ name: 'withdrawal_days', type: 'int', default: 0 })
  withdrawalDays: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
