import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AlertKind } from '../../../common/enums/alert-level.enum.js';

export type RuleCategory = 'ELEVAGE' | 'HACCP' | 'VENTE';

@Entity('rule_registry')
export class RuleRegistry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'enum', enum: AlertKind })
  kind: AlertKind;

  @Column({ type: 'varchar' })
  category: RuleCategory;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'short_label' })
  shortLabel: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true, name: 'params' })
  params: Record<string, number> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
