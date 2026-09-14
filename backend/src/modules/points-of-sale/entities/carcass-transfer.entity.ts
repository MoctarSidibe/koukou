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
import { CarcassTransferStatus } from '../../../common/enums/carcass-transfer-status.enum.js';
import { Farm } from '../../farms/entities/farm.entity.js';
import { SlaughterOrder } from '../../slaughter/entities/slaughter-order.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { PointOfSale } from './point-of-sale.entity.js';

@Entity('carcass_transfers')
export class CarcassTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @Column({ name: 'farm_id', type: 'uuid' })
  @Index()
  farmId: string;

  /** Ordre d'abattage source (PROCESSED, ABATTU) : pool de carcasses de la ferme. */
  @ManyToOne(() => SlaughterOrder, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'slaughter_order_id' })
  slaughterOrder: SlaughterOrder;

  @Column({ name: 'slaughter_order_id', type: 'uuid' })
  @Index()
  slaughterOrderId: string;

  @ManyToOne(() => PointOfSale, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'point_of_sale_id' })
  pointOfSale: PointOfSale;

  @Column({ name: 'point_of_sale_id', type: 'uuid' })
  @Index()
  pointOfSaleId: string;

  /** Lot de production d'origine (dénormalisé de l'ordre d'abattage). */
  @Column({ name: 'batch_id', type: 'uuid' })
  @Index()
  batchId: string;

  /** Nombre de carcasses déplacées de la ferme vers la boutique (≥ 1). */
  @Column({ type: 'int' })
  quantity: number;

  /** Carcasses déjà vendues depuis ce transfert (0 ≤ quantitySold ≤ quantity). */
  @Column({ name: 'quantity_sold', type: 'int', default: 0 })
  quantitySold: number;

  @Column({
    type: 'enum',
    enum: CarcassTransferStatus,
    default: CarcassTransferStatus.TRANSFERRED,
  })
  status: CarcassTransferStatus;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

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