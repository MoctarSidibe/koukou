import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertLevel } from '../../common/enums/alert-level.enum.js';
import {
  BatchStatus,
  BatchType,
} from '../../common/enums/batch-type.enum.js';
import { ReferenceKey } from '../../common/enums/reference-key.enum.js';
import { day1WeightKg } from '../../common/utils/species-day1-weight.js';
import { BreedStandard } from '../breeds/entities/breed-standard.entity.js';
import { DailyEntry } from '../daily-entries/entities/daily-entry.entity.js';
import { Farm } from '../farms/entities/farm.entity.js';
import { ReferenceConstantsService } from '../reference-constants/reference-constants.service.js';
import { ProductionBatch } from './entities/production-batch.entity.js';
import {
  BatchMetrics,
  ReadyReason,
} from './models/batch-metrics.model.js';

const round2 = (n: number): number => Math.round(n * 100) / 100;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function deviationPct(
  actual: number | null,
  target: number | null,
): number | null {
  return actual != null && target != null && target !== 0
    ? round2(((actual - target) / target) * 100)
    : null;
}

export interface ReadinessInput {
  type: BatchType;
  status: AlertLevel;
  isClosed: boolean;
  ageDays: number;
  mortalityPercent: number;
  fcrDeviationPct: number | null;
  layRateDeviationPct: number | null;
  minVenteAgeDays: number;
  fcrDeviationMaxPct: number;
  reformeLayRateFallPct: number;
}

export interface ReadinessResult {
  readyForSale: boolean;
  readyReason: ReadyReason;
}

/**
 * Auto-signal de commercialisation : un lot « prêt à vendre » peut être mis
 * en vente / précommande sans intervention manuelle du statut.
 *   - Chair : âge minimal + santé (pas ROUGE) + IC conforme (± tolérance souche).
 *   - Pondeuse : ponte effondrée sous la cible (~ chute cumulée) → réformable.
 */
export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  if (input.isClosed) return { readyForSale: false, readyReason: 'N_A' };
  if (input.status === AlertLevel.ROUGE)
    return { readyForSale: false, readyReason: 'SANITARY' };

  if (input.type === BatchType.PONDEUSE) {
    const fallen =
      input.layRateDeviationPct != null &&
      input.layRateDeviationPct < -input.reformeLayRateFallPct;
    if (!fallen) return { readyForSale: false, readyReason: 'N_A' };
    return { readyForSale: true, readyReason: 'READY' };
  }

  if (input.ageDays < input.minVenteAgeDays)
    return { readyForSale: false, readyReason: 'TOO_YOUNG' };
  if (
    input.fcrDeviationPct != null &&
    input.fcrDeviationPct > input.fcrDeviationMaxPct
  ) {
    return { readyForSale: false, readyReason: 'FCR' };
  }
  return { readyForSale: true, readyReason: 'READY' };
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
    const [
      entries,
      standardModule,
      densityWarn,
      densityCritical,
      minVenteAgeDays,
      fcrDeviationMaxPct,
      reformeLayRateFallPct,
      standard,
    ] = await Promise.all([
      this.entriesRepo.find({
        where: { batchId: batch.id },
        order: { entryDate: 'ASC' },
      }),
      this.constants.get(ReferenceKey.STANDARD_MODULE, 3000),
      this.constants.get(ReferenceKey.DENSITY_WARN, 15),
      this.constants.get(ReferenceKey.DENSITY_CRITICAL, 18),
      this.constants.get(ReferenceKey.VENTE_AGE_MIN_DAYS, 35),
      this.constants.get(ReferenceKey.VENTE_FCR_DEV_MAX_PCT, 10),
      this.constants.get(ReferenceKey.REFORME_LAY_RATE_FALL_PCT, 15),
      this.findStandard(batch),
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
    const totalWaterL = entries.reduce((s, e) => s + e.waterL, 0);

    const latestWeight =
      [...entries]
        .reverse()
        .find((e) => e.avgWeightKg != null && e.avgWeightKg > 0)?.avgWeightKg ??
      null;

    const d1WeightKg = day1WeightKg(batch.species);
    const totalWeightGainKg =
      latestWeight != null ? (latestWeight - d1WeightKg) * liveCount : null;

    const fcr =
      totalWeightGainKg != null && totalWeightGainKg > 0
        ? totalFeedKg / totalWeightGainKg
        : null;

    const gmqGramsPerDay =
      latestWeight != null && ageDays > 0
        ? ((latestWeight - d1WeightKg) * 1000) / ageDays
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

    const readiness = evaluateReadiness({
      type: batch.type,
      status,
      isClosed: batch.status === BatchStatus.CLOTURE,
      ageDays,
      mortalityPercent,
      fcrDeviationPct: deviationPct(fcr, standard?.targetFcr ?? null),
      layRateDeviationPct: deviationPct(
        layRatePercent,
        standard?.targetLayRatePercent ?? null,
      ),
      minVenteAgeDays,
      fcrDeviationMaxPct,
      reformeLayRateFallPct,
    });

    return {
      ageDays,
      totalDeaths,
      mortalityPercent,
      viabilityPercent,
      liveCount,
      totalFeedKg,
      totalWaterL,
      waterLPerBird: liveCount > 0 ? totalWaterL / liveCount : null,
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
      readyForSale: readiness.readyForSale,
      readyReason: readiness.readyReason,
    };
  }

  /** Semaine d'âge courante du lot → dernière entrée du référentiel de la souche. */
  private async findStandard(
    batch: ProductionBatch,
  ): Promise<BreedStandard | null> {
    if (!batch.breed) return null;
    const standards = await this.standardRepo.find({
      where: { breedId: batch.breed.id },
      order: { week: 'ASC' },
    });
    if (standards.length === 0) return null;

    const ageDays = this.computeAgeDays(batch.integrationDate);
    const ageWeek = Math.floor(ageDays / 7) + 1;
    const applicable = standards.filter((s) => s.week <= ageWeek);
    return applicable.length > 0 ? applicable[applicable.length - 1]! : standards[0];
  }

  /**
   * « Breed Intelligence » : compare le lot à la courbe de référence de sa
   * souche (semaine d'âge = floor(ageDays/7)+1, plafonnée à la dernière
   * semaine du référentiel). Retourne null si le lot n'a pas de souche ou que
   * la souche n'a pas de référentiel (souche personnalisée).
   */
  async breedStatus(batch: ProductionBatch): Promise<BreedStatus | null> {
    const standard = await this.findStandard(batch);
    if (!standard) return null;

    const metrics = await this.compute(batch);
    const ageDays = this.computeAgeDays(batch.integrationDate);
    const actualAvgWeightKg =
      metrics.gmqGramsPerDay != null
        ? round2(day1WeightKg(batch.species) + (metrics.gmqGramsPerDay * ageDays) / 1000)
        : null;

    return {
      breedId: batch.breed!.id,
      breedName: batch.breed!.name,
      breedType: batch.breed!.type,
      week: standard.week,
      targetAvgWeightKg: standard.targetAvgWeightKg,
      actualAvgWeightKg,
      avgWeightDeviationPct: deviationPct(
        actualAvgWeightKg,
        standard.targetAvgWeightKg,
      ),
      targetFcr: standard.targetFcr,
      actualFcr: metrics.fcr,
      fcrDeviationPct: deviationPct(metrics.fcr, standard.targetFcr),
      targetLayRatePercent: standard.targetLayRatePercent,
      actualLayRatePercent: metrics.layRatePercent,
      layRateDeviationPct: deviationPct(
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
