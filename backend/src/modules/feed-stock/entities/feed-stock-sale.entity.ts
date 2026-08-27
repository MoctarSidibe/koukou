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
import { Farm } from '../../farms/entities/farm.entity.js';
import { InputLot } from '../../inputs/entities/input-lot.entity.js';
import { ProductionBatch } from '../../batches/entities/production-batch.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('feed_stock_sales')
export class FeedStockSale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @Column({ name: 'farm_id', type: 'uuid' })
  @Index()
  farmId: string;

  @ManyToOne(() => InputLot, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'input_lot_id' })
  inputLot: InputLot | null;

  @Column({ name: 'input_lot_id', type: 'uuid', nullable: true })
  @Index()
  inputLotId: string | null;

  @ManyToOne(() => ProductionBatch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'batch_id' })
  batch: ProductionBatch | null;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId: string | null;

  @Column({ name: 'sale_item_id', type: 'uuid', nullable: true })
  @Index()
  saleItemId: string | null;

  @Column({ name: 'quantity_kg', type: 'float' })
  quantityKg: number;

  @Column({ name: 'sold_at', type: 'date' })
  soldAt: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
