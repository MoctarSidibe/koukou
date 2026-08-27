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
  buildingId?: string | null;
  ruleId?: string | null;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) {}

  /**
   * Soulève (met à jour s'il existe encore) une alerte active.
   * La déduplication se fait sur (ferme + type + lot OU bâtiment) de façon à
   * ne garder qu'une alerte active par risque, tout en préservant l'historique
   * des alertes résolues.
   */
  async raise(candidate: AlertCandidate, ctx: AlertsContext): Promise<Alert> {
    const where: FindOptionsWhere<Alert> = {
      farmId: ctx.farmId,
      kind: candidate.kind,
      status: AlertStatus.ACTIVE,
    };
    if (ctx.buildingId) {
      where.buildingId = ctx.buildingId;
      where.batchId = IsNull();
    } else if (ctx.batchId) {
      where.batchId = ctx.batchId;
      where.buildingId = IsNull();
    } else {
      where.batchId = IsNull();
      where.buildingId = IsNull();
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
      buildingId: ctx.buildingId ?? null,
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

  /** Marque l'alerte active correspondante comme résolue (fin du risque). */
  async clearKind(
    farmId: string,
    batchId: string | null,
    kind: AlertKind,
    buildingId?: string | null,
  ): Promise<void> {
    const where: FindOptionsWhere<Alert> = {
      farmId,
      kind,
      status: AlertStatus.ACTIVE,
    };
    if (buildingId) {
      where.buildingId = buildingId;
      where.batchId = IsNull();
    } else if (batchId) {
      where.batchId = batchId;
      where.buildingId = IsNull();
    } else {
      where.batchId = IsNull();
      where.buildingId = IsNull();
    }
    await this.alertRepo.update(where, {
      status: AlertStatus.RESOLUE,
      resolvedAt: new Date(),
    });
  }

  async listForFarm(farmId: string, status?: AlertStatus): Promise<Alert[]> {
    const where: Record<string, unknown> = { farmId };
    if (status) where.status = status;
    return this.alertRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  /** Historique COMPLET (actives + acquittées + résolues) pour les rapports 360°. */
  async historyForFarm(farmId: string): Promise<Alert[]> {
    return this.alertRepo.find({
      where: { farmId },
      order: { createdAt: 'DESC' },
    });
  }
}
