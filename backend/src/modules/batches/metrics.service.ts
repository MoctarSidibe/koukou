import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertLevel } from '../../common/enums/alert-level.enum.js';
import { ReferenceKey } from '../../common/enums/reference-key.enum.js';
import { DailyEntry } from '../daily-entries/entities/daily-entry.entity.js';
import { Farm } from '../farms/entities/farm.entity.js';
import { ReferenceConstantsService } from '../reference-constants/reference-constants.service.js';
import { ProductionBatch } from './entities/production-batch.entity.js';
import { BatchMetrics } from './models/batch-metrics.model.js';

const DAY1_WEIGHT_KG = 0.045;

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(DailyEntry)
    private readonly entriesRepo: Repository<DailyEntry>,
    @InjectRepository(Farm)
    private readonly farmRepo: Repository<Farm>,
    private readonly constants: ReferenceConstantsService,
  ) {}

  async compute(batch: ProductionBatch): Promise<BatchMetrics> {
    const [entries, standardModule, densityWarn, densityCritical] =
      await Promise.all([
        this.entriesRepo.find({
          where: { batchId: batch.id },
          order: { entryDate: 'ASC' },
        }),
        this.constants.get(ReferenceKey.STANDARD_MODULE, 3000),
        this.constants.get(ReferenceKey.DENSITY_WARN, 15),
        this.constants.get(ReferenceKey.DENSITY_CRITICAL, 18),
      ]);

    const ageDays = this.computeAgeDays(batch.integrationDate);
    const totalDeaths = entries.reduce((s, e) => s + e.deaths, 0);
    const liveCount = Math.max(0, batch.quantityAtStart - totalDeaths);
    const mortalityPercent =
      batch.quantityAtStart > 0
        ? (totalDeaths / batch.quantityAtStart) * 100
        : 0;
    const viabilityPercent = Math.max(0, 100 - mortalityPercent);

    // Convention : feedQuantity est TOUJOURS stocké en kg (conversion sac->kg faite à la saisie).
    const totalFeedKg = entries.reduce((s, e) => s + e.feedQuantity, 0);

    const latestWeight = [...entries]
      .reverse()
      .find((e) => e.avgWeightKg != null && e.avgWeightKg > 0)?.avgWeightKg ?? null;

    const totalWeightGainKg =
      latestWeight != null
        ? (latestWeight - DAY1_WEIGHT_KG) * liveCount
        : null;

    const fcr =
      totalWeightGainKg != null && totalWeightGainKg > 0
        ? totalFeedKg / totalWeightGainKg
        : null;

    const gmqGramsPerDay =
      latestWeight != null && ageDays > 0
        ? ((latestWeight - DAY1_WEIGHT_KG) * 1000) / ageDays
        : null;

    const ipe =
      latestWeight != null && fcr != null && fcr > 0 && ageDays > 0
        ? (latestWeight * viabilityPercent * 100) / (ageDays * fcr)
        : null;

    const eggsCollectedTotal = entries.reduce((s, e) => s + e.eggsCollected, 0);
    const layRatePercent =
      batch.type === 'PONDEUSE' && liveCount > 0
        ? (eggsCollectedTotal / liveCount) * 100
        : null;

    const densityPerM2 =
      batch.buildingAreaM2 != null && batch.buildingAreaM2 > 0
        ? liveCount / batch.buildingAreaM2
        : null;

    const moduleFraction = batch.quantityAtStart / standardModule;

    const farm = await this.farmRepo.findOne({ where: { id: batch.farmId } });
    const moduleRatioVsCapacity =
      farm?.capacityPerBuilding != null && farm.capacityPerBuilding > 0
        ? batch.quantityAtStart / farm.capacityPerBuilding
        : null;

    const status = this.computeStatus({
      mortalityPercent,
      densityPerM2,
      densityWarn,
      densityCritical,
    });

    return {
      ageDays,
      totalDeaths,
      mortalityPercent,
      viabilityPercent,
      liveCount,
      totalFeedKg,
      totalWeightGainKg,
      fcr,
      gmqGramsPerDay,
      ipe,
      eggsCollectedTotal,
      layRatePercent,
      status,
      densityPerM2,
      moduleFraction,
      moduleRatioVsCapacity,
    };
  }

  private computeAgeDays(integrationDate: string): number {
    const start = new Date(integrationDate + 'T00:00:00');
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  }

  private computeStatus(input: {
    mortalityPercent: number;
    densityPerM2: number | null;
    densityWarn: number;
    densityCritical: number;
  }): AlertLevel {
    if (input.densityPerM2 != null && input.densityPerM2 > input.densityCritical) {
      return AlertLevel.ROUGE;
    }
    if (
      input.densityPerM2 != null &&
      input.densityPerM2 > input.densityWarn
    ) {
      return AlertLevel.JAUNE;
    }
    if (input.mortalityPercent > 5) {
      return AlertLevel.ROUGE;
    }
    if (input.mortalityPercent > 1) {
      return AlertLevel.JAUNE;
    }
    return AlertLevel.VERT;
  }
}
