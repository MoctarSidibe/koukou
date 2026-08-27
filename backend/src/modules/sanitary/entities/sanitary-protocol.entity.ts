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

@Entity('sanitary_protocols')
export class SanitaryProtocol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'enum', enum: Species })
  @Index()
  species: Species;

  @Column({ type: 'enum', enum: BatchType })
  @Index()
  type: BatchType;

  @Column()
  name: string;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_editable', default: true })
  isEditable: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
