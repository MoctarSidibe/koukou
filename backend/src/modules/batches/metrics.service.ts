import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertLevel } from '../../common/enums/alert-level.enum.js';
import { BatchType } from '../../common/enums/batch-type.enum.js';
import { ReferenceKey } from '../../common/enums/reference-key.enum.js';
import { BreedStandard } from '../breeds/entities/breed-standard.entity.js';
import { DailyEntry } from '../daily-entries/entities/daily-entry.entity.js';
import { Farm } from '../farms/entities/farm.entity.js';
import { ReferenceConstantsService } from '../reference-constants/reference-constants.service.js';
import { ProductionBatch } from './entities/production-batch.entity.js';
import { BatchMetrics } from './models/batch-metrics.model.js';

const DAY1_WEIGHT_KG = 0.045;

const round2 = (n: number): number => Math.round(n * 100) / 100;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface BreedStatus {
  breedId: string;
  breedName: string;
  breedType: BatchType;
  week: number;
  targetAvgWeightKg: number | null;
  actualAvgWeightKg: number | null;
  avgWeightDeviationPct: number | null;
  targetFcr: number | null;
  actualFcr: number | null;
  fcrDeviationPct: number | null;
  targetLayRatePercent: number | null;
  actualLayRatePercent: number | null;
  layRateDeviationPct: number | null;
}

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(DailyEntry)
    private readonly entriesRepo: Repository<DailyEntry>,
    @InjectRepository(Farm)
    private readonly farmRepo: Repository<Farm>,
    @InjectRepository(BreedStandard)
    private readonly standardRepo: Repository<BreedStandard>,
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
    // quantityAlive est la source de vérité (décréments POS/abattage + reconcilées).
    const liveCount = Math.max(0, batch.quantityAlive);
    const mortalityPercent =
      batch.quantityAtStart > 0
        ? (totalDeaths / batch.quantityAtStart) * 100
        : 0;
    const viabilityPercent = Math.max(0, 100 - mortalityPercent);

    // Convention : feedQuantity est TOUJOURS stocké en kg (conversion sac->kg faite à la saisie).
    const totalFeedKg = entries.reduce((s, e) => s + e.feedQuantity, 0);

    const latestWeight =
      [...entries]
        .reverse()
        .find((e) => e.avgWeightKg != null && e.avgWeightKg > 0)?.avgWeightKg ??
      null;

    const totalWeightGainKg =
      latestWeight != null ? (latestWeight - DAY1_WEIGHT_KG) * liveCount : null;

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
    // Taux de ponte = fenêtre glissante de 7 jours (aligné sur la cible
    // hebdomadaire du référentiel) : un cumul de toute la vie de la bande ne
    // peut pas être comparé à une cible de semaine d'âge (ex. 300 % vs 86 %).
    const windowStart = addDaysIso(todayIso(), -7);
    const windowEntries = entries.filter((e) => e.entryDate >= windowStart);
    const recordedDays = new Set(
      windowEntries.filter((e) => e.eggsCollected > 0).map((e) => e.entryDate),
    ).size;
    const layRatePercent =
      batch.type === 'PONDEUSE' && liveCount > 0 && recordedDays > 0
        ? (windowEntries.reduce((s, e) => s + e.eggsCollected, 0) /
            (liveCount * recordedDays)) *
          100
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

  /**
   * « Breed Intelligence » : compare le lot à la courbe de référence de sa
   * souche (semaine d'âge = floor(ageDays/7)+1, plafonnée à la dernière
   * semaine du référentiel). Retourne null si le lot n'a pas de souche ou que
   * la souche n'a pas de référentiel (souche personnalisée).
   */
  async breedStatus(batch: ProductionBatch): Promise<BreedStatus | null> {
    const breed = batch.breed;
    if (!breed) return null;
    const standards = await this.standardRepo.find({
      where: { breedId: breed.id },
      order: { week: 'ASC' },
    });
    if (standards.length === 0) return null;

    const ageDays = this.computeAgeDays(batch.integrationDate);
    const ageWeek = Math.floor(ageDays / 7) + 1;
    const applicable = standards.filter((s) => s.week <= ageWeek);
    const standard: BreedStandard =
      applicable.length > 0 ? applicable[applicable.length - 1]! : standards[0];

    const deviation = (
      actual: number | null,
      target: number | null,
    ): number | null =>
      actual != null && target != null && target !== 0
        ? round2(((actual - target) / target) * 100)
        : null;

    const metrics = await this.compute(batch);
    const actualAvgWeightKg =
      metrics.gmqGramsPerDay != null
        ? round2(DAY1_WEIGHT_KG + (metrics.gmqGramsPerDay * ageDays) / 1000)
        : null;

    return {
      breedId: breed.id,
      breedName: breed.name,
      breedType: breed.type,
      week: standard.week,
      targetAvgWeightKg: standard.targetAvgWeightKg,
      actualAvgWeightKg,
      avgWeightDeviationPct: deviation(
        actualAvgWeightKg,
        standard.targetAvgWeightKg,
      ),
      targetFcr: standard.targetFcr,
      actualFcr: metrics.fcr,
      fcrDeviationPct: deviation(metrics.fcr, standard.targetFcr),
      targetLayRatePercent: standard.targetLayRatePercent,
      actualLayRatePercent: metrics.layRatePercent,
      layRateDeviationPct: deviation(
        metrics.layRatePercent,
        standard.targetLayRatePercent,
      ),
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
    if (
      input.densityPerM2 != null &&
      input.densityPerM2 > input.densityCritical
    ) {
      return AlertLevel.ROUGE;
    }
    if (input.densityPerM2 != null && input.densityPerM2 > input.densityWarn) {
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
