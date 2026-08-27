import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BatchType } from '../../../common/enums/batch-type.enum.js';
import { Species } from '../../../common/enums/species.enum.js';

@Entity('breeds')
export class Breed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'enum', enum: BatchType })
  @Index()
  type: BatchType;

  @Column({ type: 'enum', enum: Species, default: Species.POULET })
  species: Species;

  @Column({ name: 'is_custom', default: false })
  isCustom: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
