import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CareType } from '../../../common/enums/care-type.enum.js';

@Entity('treatment_records')
export class TreatmentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'farm_id', type: 'uuid' })
  @Index()
  farmId: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  @Index()
  batchId: string;

  @Column({ name: 'care_type', type: 'enum', enum: CareType })
  careType: CareType;

  @Column({ name: 'product_name' })
  productName: string;

  @Column({ type: 'varchar', nullable: true })
  dosage: string | null;

  @Column({ type: 'varchar', nullable: true })
  route: string | null;

  @Column({ name: 'administered_at', type: 'timestamptz' })
  administeredAt: Date;

  @Column({ name: 'withdrawal_days', type: 'int', default: 0 })
  withdrawalDays: number;

  @Column({ name: 'withdrawal_end_date', type: 'date', nullable: true })
  withdrawalEndDate: string | null;

  @Column({ name: 'performed_by_id', type: 'uuid', nullable: true })
  performedById: string | null;

  @Column({ name: 'medication_lot_id', type: 'uuid', nullable: true })
  medicationLotId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export function computeWithdrawalEndDate(
  administeredAt: Date,
  withdrawalDays: number,
): string | null {
  if (!withdrawalDays || withdrawalDays <= 0) return null;
  const end = new Date(administeredAt);
  end.setUTCDate(end.getUTCDate() + withdrawalDays);
  return end.toISOString().slice(0, 10);
}
