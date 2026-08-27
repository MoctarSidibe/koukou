import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BatchType } from '../../../common/enums/batch-type.enum.js';
import { ProductionBatch } from './production-batch.entity.js';

@Entity('type_history_entries')
export class TypeHistoryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProductionBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch: ProductionBatch;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @Column({ type: 'enum', enum: BatchType })
  fromType: BatchType;

  @Column({ type: 'enum', enum: BatchType })
  toType: BatchType;

  @Column({ type: 'date' })
  changedOn: string;

  @Column({ name: 'reason', type: 'varchar', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
