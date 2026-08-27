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
import { FoodType, FeedUnit } from '../../../common/enums/food-type.enum.js';
import { InputKind } from '../../../common/enums/input-kind.enum.js';
import { Farm } from '../../farms/entities/farm.entity.js';
import { ProductionBatch } from '../../batches/entities/production-batch.entity.js';

@Entity('input_lots')
export class InputLot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @Column({ name: 'farm_id', type: 'uuid' })
  @Index()
  farmId: string;

  @ManyToOne(() => ProductionBatch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'batch_id' })
  batch: ProductionBatch | null;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId: string | null;

  @Column({ type: 'enum', enum: InputKind })
  kind: InputKind;

  @Column({ name: 'food_type', type: 'enum', enum: FoodType, nullable: true })
  foodType: FoodType | null;

  @Column()
  productName: string;

  @Column()
  supplier: string;

  @Column({ name: 'supplier_lot_number' })
  @Index()
  supplierLotNumber: string;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: string | null;

  @Column({ name: 'received_date', type: 'date' })
  receivedDate: string;

  @Column({ type: 'float', default: 0 })
  quantity: number;

  @Column({ type: 'enum', enum: FeedUnit, nullable: true })
  unit: FeedUnit | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
