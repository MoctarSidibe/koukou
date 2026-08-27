import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import {
  AlertKind,
  AlertLevel,
  AlertStatus,
} from '../../common/enums/alert-level.enum.js';
import { Alert } from './entities/alert.entity.js';

export interface AlertCandidate {
  kind: AlertKind;
  level: AlertLevel;
  message: string;
  recommendation?: string;
  context?: Record<string, unknown>;
}

export interface AlertsContext {
  farmId: string;
  batchId?: string | null;
  ruleId?: string | null;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) {}

  async raise(candidate: AlertCandidate, ctx: AlertsContext): Promise<Alert> {
    const where: FindOptionsWhere<Alert> = {
      farmId: ctx.farmId,
      kind: candidate.kind,
      status: AlertStatus.ACTIVE,
    };
    if (ctx.batchId) {
      where.batchId = ctx.batchId;
    } else {
      where.batchId = IsNull();
    }
    const existing = await this.alertRepo.findOne({ where });
    if (existing) {
      existing.level = candidate.level;
      existing.message = candidate.message;
      existing.recommendation = candidate.recommendation ?? null;
      existing.context = candidate.context ?? null;
      return this.alertRepo.save(existing);
    }
    const alert = this.alertRepo.create({
      farmId: ctx.farmId,
      batchId: ctx.batchId ?? null,
      ruleId: ctx.ruleId ?? null,
      kind: candidate.kind,
      level: candidate.level,
      status: AlertStatus.ACTIVE,
      message: candidate.message,
      recommendation: candidate.recommendation ?? null,
      context: candidate.context ?? null,
    });
    return this.alertRepo.save(alert);
  }

  async clearKind(
    farmId: string,
    batchId: string | null,
    kind: AlertKind,
  ): Promise<void> {
    const where: FindOptionsWhere<Alert> = {
      farmId,
      kind,
      status: AlertStatus.ACTIVE,
    };
    if (batchId) {
      where.batchId = batchId;
    } else {
      where.batchId = IsNull();
    }
    await this.alertRepo.update(where, { status: AlertStatus.ACQUITTEE });
  }

  async listForFarm(farmId: string, status?: AlertStatus): Promise<Alert[]> {
    const where: Record<string, unknown> = { farmId };
    if (status) where.status = status;
    return this.alertRepo.find({ where, order: { createdAt: 'DESC' } });
  }
}
