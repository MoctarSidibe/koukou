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
import { FeedUnit, FoodType } from '../../../common/enums/food-type.enum.js';
import { ConsumptionSource } from '../../../common/enums/consumption-source.enum.js';
import { ProductionBatch } from '../../batches/entities/production-batch.entity.js';
import { InputLot } from '../../inputs/entities/input-lot.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('daily_entries')
@Unique(['batch', 'entryDate'])
export class DailyEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProductionBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch: ProductionBatch;

  @Column({ name: 'batch_id', type: 'uuid' })
  @Index()
  batchId: string;

  @Column({ name: 'entry_date', type: 'date' })
  @Index()
  entryDate: string;

  @Column({ type: 'int', default: 0 })
  deaths: number;

  @Column({ name: 'feed_quantity', type: 'float', default: 0 })
  feedQuantity: number;

  @Column({ name: 'feed_unit', type: 'enum', enum: FeedUnit, nullable: true })
  feedUnit: FeedUnit | null;

  @Column({ name: 'feed_type', type: 'enum', enum: FoodType, nullable: true })
  feedType: FoodType | null;

  @Column({ name: 'input_lot_id', type: 'uuid', nullable: true })
  inputLotId: string | null;

  @ManyToOne(() => InputLot, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'input_lot_id' })
  inputLot: InputLot | null;

  @Column({ name: 'water_l', type: 'float', default: 0 })
  waterL: number;

  @Column({ name: 'avg_weight_kg', type: 'float', nullable: true })
  avgWeightKg: number | null;

  @Column({ name: 'eggs_collected', type: 'int', default: 0 })
  eggsCollected: number;

  @Column({ name: 'eggs_sellable', type: 'int', default: 0 })
  eggsSellable: number;

  @Column({ name: 'eggs_cracked', type: 'int', default: 0 })
  eggsCracked: number;

  @Column({ name: 'eggs_small', type: 'int', default: 0 })
  eggsSmall: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'enum', enum: ConsumptionSource, default: ConsumptionSource.MANUELLE })
  source: ConsumptionSource;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
