import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertKind, AlertLevel } from '../../common/enums/alert-level.enum.js';
import { ReferenceKey } from '../../common/enums/reference-key.enum.js';
import { BatchStatus } from '../../common/enums/batch-type.enum.js';
import { day1WeightKg } from '../../common/utils/species-day1-weight.js';
import { Building } from '../buildings/entities/building.entity.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { DailyEntry } from '../daily-entries/entities/daily-entry.entity.js';
import { ReferenceConstantsService } from '../reference-constants/reference-constants.service.js';
import { InputLot } from '../inputs/entities/input-lot.entity.js';
import { ProductionBatch } from './entities/production-batch.entity.js';
import { BatchMetrics } from './models/batch-metrics.model.js';
import { dominantSpecies, speciesDensityFor } from './density-reference.js';

function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class AdvisoryEngine {
  constructor(
    @InjectRepository(DailyEntry)
    private readonly entriesRepo: Repository<DailyEntry>,
    @InjectRepository(InputLot)
    private readonly inputRepo: Repository<InputLot>,
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
    private readonly alertsService: AlertsService,
    private readonly constants: ReferenceConstantsService,
  ) {}

  async runForBatch(batch: ProductionBatch, metrics: BatchMetrics) {
    const farmId = batch.farmId;
    const batchId = batch.id;

    await Promise.all([
      this.evaluateMortality(batch, metrics, farmId, batchId),
      this.evaluateDensity(batch, metrics, farmId, batchId),
      this.evaluateWater(batch, metrics, farmId, batchId),
      this.evaluateWaterHealth(batch, metrics, farmId, batchId),
      this.evaluateIpeGmq(batch, metrics, farmId, batchId),
      this.evaluateGmq(batch, metrics, farmId, batchId),
      this.evaluateExpiration(batch, farmId, batchId),
      this.evaluateSaleReadiness(batch, metrics, farmId, batchId),
      this.evaluateBuildingContext(batch),
    ]);
  }

  /**
   * Purge les alertes de niveau bâtiment d'un bâtiment (lorsqu'aucun lot ne
   * l'occupe plus, ou qu'un lot change de bâtiment). Les prochaines évaluations
   * le re-remonteront si le risque subsiste (philosophie advisory).
   */
  async clearBuildingAlerts(farmId: string, buildingId: string) {
    await Promise.all([
      this.alertsService.clearKind(
        farmId,
        null,
        AlertKind.DENSITE_BATIMENT,
        buildingId,
      ),
      this.alertsService.clearKind(
        farmId,
        null,
        AlertKind.COHABITATION,
        buildingId,
      ),
      this.alertsService.clearKind(
        farmId,
        null,
        AlertKind.VIDE_SANITAIRE,
        buildingId,
      ),
    ]);
  }

  /** Évaluations au niveau BÂTIMENT (densité cumulée, cohabitation d'âges, vide sanitaire). */
  private async evaluateBuildingContext(batch: ProductionBatch) {
    if (!batch.buildingId) return;
    const buildingId = batch.buildingId;
    const farmId = batch.farmId;

    const [building, lots] = await Promise.all([
      this.buildingRepo.findOne({ where: { id: buildingId } }),
      this.batchRepo.find({
        where: { buildingId, farmId },
      }),
    ]);
    if (!building) return;
    const activeLots = lots.filter((l) => l.status !== BatchStatus.CLOTURE);

    await Promise.all([
      this.evaluateBuildingDensity(building, activeLots, farmId),
      this.evaluateCohabitation(activeLots, farmId, buildingId),
      this.evaluateVideSanitaire(building, lots, farmId, buildingId),
    ]);
  }

  private async evaluateBuildingDensity(
    building: Building,
    activeLots: ProductionBatch[],
    farmId: string,
  ) {
    const buildingId = building.id;
    const area = building.buildingAreaM2;
    if (area == null || area <= 0) {
      await this.alertsService.clearKind(
        farmId,
        null,
        AlertKind.DENSITE_BATIMENT,
        buildingId,
      );
      return;
    }
    const activeBirds = activeLots.reduce((s, l) => s + l.quantityAlive, 0);
    const density = activeBirds / area;
    const warn = await this.constants.get(
      ReferenceKey.BUILDING_DENSITY_WARN,
      15,
    );
    const crit = await this.constants.get(
      ReferenceKey.BUILDING_DENSITY_CRITICAL,
      18,
    );
    // Seuils species-aware : l'espèce dominante du bâtiment prime sur la
    // constante globale (calibrée pour le poulet de chair).
    const speciesDensity = speciesDensityFor(dominantSpecies(activeLots));
    const effectiveWarn = speciesDensity?.warnPerM2 ?? warn;
    const effectiveCrit = speciesDensity?.criticalPerM2 ?? crit;
    const activeBatch = activeLots[0];

    if (density > effectiveCrit) {
      await this.alertsService.raise(
        {
          kind: AlertKind.DENSITE_BATIMENT,
          level: AlertLevel.ROUGE,
          message: `Densité du bâtiment critique : ${density.toFixed(1)} oiseaux/m² (${activeBirds} oiseaux cumulés).`,
          recommendation:
            'Réduire le cheptel total du bâtiment ou augmenter la surface. Risque sanitaire et thermique élevé.',
          context: {
            densityBuildingPerM2: density,
            activeBirds,
            activeLots: activeLots.length,
          },
        },
        { farmId, batchId: activeBatch?.id ?? null, buildingId },
      );
    } else if (density > effectiveWarn) {
      await this.alertsService.raise(
        {
          kind: AlertKind.DENSITE_BATIMENT,
          level: AlertLevel.JAUNE,
          message: `Densité du bâtiment élevée : ${density.toFixed(1)} oiseaux/m² (${activeBirds} oiseaux cumulés).`,
          recommendation:
            'Surveiller ventilation et litière ; éviter d’ajouter de nouveaux lots.',
          context: {
            densityBuildingPerM2: density,
            activeBirds,
            activeLots: activeLots.length,
          },
        },
        { farmId, batchId: activeBatch?.id ?? null, buildingId },
      );
    } else {
      await this.alertsService.clearKind(
        farmId,
        null,
        AlertKind.DENSITE_BATIMENT,
        buildingId,
      );
    }
  }

  private async evaluateCohabitation(
    activeLots: ProductionBatch[],
    farmId: string,
    buildingId: string,
  ) {
    if (activeLots.length < 2) {
      await this.alertsService.clearKind(
        farmId,
        null,
        AlertKind.COHABITATION,
        buildingId,
      );
      return;
    }
    const maxGapWeeks = await this.constants.get(
      ReferenceKey.AGE_GAP_MAX_WEEKS,
      4,
    );
    const agesInWeeks = activeLots.map((l) =>
      this.ageInWeeks(l.integrationDate),
    );
    const minWeek = Math.min(...agesInWeeks);
    const maxWeek = Math.max(...agesInWeeks);
    const gapWeeks = maxWeek - minWeek;
    const activeBatch = activeLots[0];

    if (gapWeeks > maxGapWeeks) {
      // Le cas le plus dangereux : un poussin fragile partage avec une bande trop mature.
      const hasChick = minWeek <= 3;
      await this.alertsService.raise(
        {
          kind: AlertKind.COHABITATION,
          level: hasChick ? AlertLevel.ROUGE : AlertLevel.JAUNE,
          message: `Cohabitation d'âges : écart de ${gapWeeks.toFixed(0)} semaines entre ${activeLots.length} lots dans le bâtiment. ${hasChick ? 'Un poussin fragile est exposé à un lot mature — risque élevé de transmission virale.' : ''}`,
          recommendation:
            'Planifier un vide sanitaire et, si possible, séparer les lots d’âges trop écartés pour limiter la propagation de maladies.',
          context: {
            ageGapWeeks: gapWeeks,
            maxAgeGapWeeks: maxGapWeeks,
            activeLots: activeLots.length,
          },
        },
        { farmId, batchId: activeBatch?.id ?? null, buildingId },
      );
    } else {
      await this.alertsService.clearKind(
        farmId,
        null,
        AlertKind.COHABITATION,
        buildingId,
      );
    }
  }

  private async evaluateVideSanitaire(
    building: Building,
    lots: ProductionBatch[],
    farmId: string,
    buildingId: string,
  ) {
    const lastClosed = lots
      .filter((l) => l.status === BatchStatus.CLOTURE)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    if (!lastClosed) {
      await this.alertsService.clearKind(
        farmId,
        null,
        AlertKind.VIDE_SANITAIRE,
        buildingId,
      );
      return;
    }

    const minDays = await this.constants.get(
      ReferenceKey.VIDE_SANITAIRE_MIN_DAYS,
      14,
    );
    const recommendedDays = await this.constants.get(
      ReferenceKey.VIDE_SANITAIRE_MAX_DAYS,
      21,
    );
    const elapsedDays =
      (Date.now() - lastClosed.updatedAt.getTime()) / 86400000;
    const activeBatch = lots.find((l) => l.status !== BatchStatus.CLOTURE);

    if (elapsedDays < minDays) {
      await this.alertsService.raise(
        {
          kind: AlertKind.VIDE_SANITAIRE,
          level: AlertLevel.ROUGE,
          message: `Vide sanitaire non respecté : le dernier lot du bâtiment s'est terminé il y a ${elapsedDays.toFixed(0)} jour(s) (minimum ${minDays}).`,
          recommendation: `Laisser le bâtiment vide et désinfecté ${minDays} à ${recommendedDays} jours avant de réintroduire des poussins. Nettoyer et désinfecter intégralement.`,
          context: { elapsedDays: elapsedDays, minDays, recommendedDays },
        },
        { farmId, batchId: activeBatch?.id ?? null, buildingId },
      );
    } else if (elapsedDays < recommendedDays) {
      await this.alertsService.raise(
        {
          kind: AlertKind.VIDE_SANITAIRE,
          level: AlertLevel.JAUNE,
          message: `Le vide sanitaire du bâtiment est en cours (${elapsedDays.toFixed(0)} jours).`,
          recommendation: `Poursuivre la désinfection ; idéalement attendre ${recommendedDays} jours.`,
          context: { elapsedDays: elapsedDays, minDays, recommendedDays },
        },
        { farmId, batchId: activeBatch?.id ?? null, buildingId },
      );
    } else {
      await this.alertsService.clearKind(
        farmId,
        null,
        AlertKind.VIDE_SANITAIRE,
        buildingId,
      );
    }
  }

  private ageInWeeks(integrationDate: string): number {
    const start = new Date(integrationDate + 'T00:00:00').getTime();
    const now = Date.now();
    return Math.max(0, (now - start) / (7 * 86400000));
  }

  private ageDaysAt(entryDate: string, integrationDate: string): number {
    const entry = new Date(entryDate + 'T00:00:00').getTime();
    const start = new Date(integrationDate + 'T00:00:00').getTime();
    return Math.max(0, Math.floor((entry - start) / 86400000));
  }

  private async evaluateMortality(
    batch: ProductionBatch,
    metrics: BatchMetrics,
    farmId: string,
    batchId: string,
  ) {
    const actualPct = metrics.mortalityPercent;
    const expectedPct = metrics.expectedMortalityPct;
    const devPct = metrics.mortalityDeviationPct;
    const devLabel =
      devPct != null && devPct >= 0
        ? ` — écart +${devPct.toFixed(0)}% vs attendu`
        : '';
    if (metrics.mortalityStatus === 'critical') {
      await this.alertsService.raise(
        {
          kind: AlertKind.MORTALITE,
          level: AlertLevel.ROUGE,
          message: `Mortalité critique : ${actualPct.toFixed(1)}% sur le lot ${batch.batchName} (attendu ${expectedPct.toFixed(1)}% à J${metrics.ageDays}${devLabel}).`,
          recommendation:
            'Contacter immédiatement le vétérinaire, vérifier la biosécurité et l’hygiène du bâtiment.',
          context: {
            mortalityPercent: actualPct,
            expectedMortalityPct: expectedPct,
            mortalityDeviationPercent: devPct,
            ageDays: metrics.ageDays,
          },
        },
        { farmId, batchId },
      );
    } else if (metrics.mortalityStatus === 'elevated') {
      await this.alertsService.raise(
        {
          kind: AlertKind.MORTALITE,
          level: AlertLevel.JAUNE,
          message: `Mortalité en hausse : ${actualPct.toFixed(1)}% sur le lot ${batch.batchName} (attendu ${expectedPct.toFixed(1)}% à J${metrics.ageDays}${devLabel}).`,
          recommendation:
            'Surveiller la consommation d’eau et l’état général du lot.',
          context: {
            mortalityPercent: actualPct,
            expectedMortalityPct: expectedPct,
            mortalityDeviationPercent: devPct,
            ageDays: metrics.ageDays,
          },
        },
        { farmId, batchId },
      );
    } else {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.MORTALITE);
    }
  }

  private async evaluateDensity(
    batch: ProductionBatch,
    metrics: BatchMetrics,
    farmId: string,
    batchId: string,
  ) {
    if (metrics.densityPerM2 == null) {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.SURDENSITE);
      return;
    }
    // Seuils species-aware : le référentiel par espèce prime sur la constante
    // globale (15/18, calibrée poulet de chair).
    const speciesDensity = speciesDensityFor(batch.species);
    const warn =
      speciesDensity?.warnPerM2 ??
      (await this.constants.get(ReferenceKey.DENSITY_WARN, 15));
    const crit =
      speciesDensity?.criticalPerM2 ??
      (await this.constants.get(ReferenceKey.DENSITY_CRITICAL, 18));
    if (metrics.densityPerM2 > crit) {
      await this.alertsService.raise(
        {
          kind: AlertKind.SURDENSITE,
          level: AlertLevel.ROUGE,
          message: `Surdensité critique : ${metrics.densityPerM2.toFixed(1)} oiseaux/m² dans le lot ${batch.batchName}.`,
          recommendation:
            'Réduire le cheptel ou augmenter la surface disponible ; risque sanitaire et de stress thermique.',
          context: { densityPerM2: metrics.densityPerM2 },
        },
        { farmId, batchId },
      );
    } else if (metrics.densityPerM2 > warn) {
      await this.alertsService.raise(
        {
          kind: AlertKind.SURDENSITE,
          level: AlertLevel.JAUNE,
          message: `Densité élevée : ${metrics.densityPerM2.toFixed(1)} oiseaux/m² dans le lot ${batch.batchName}.`,
          recommendation:
            'Surveiller la ventilation et la litière ; prévoir un éclaircissement.',
          context: { densityPerM2: metrics.densityPerM2 },
        },
        { farmId, batchId },
      );
    } else {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.SURDENSITE);
    }
  }

  /**
   * Population vivante estimée le jour d'une saisie : effectif initial moins
   * les morts cumulés jusqu'à cette date (permet de normaliser l'eau par tête).
   */
  private populationAtDay(
    batch: ProductionBatch,
    entries: DailyEntry[],
    refDate: string,
  ): number {
    let deathsBefore = 0;
    for (const e of entries) {
      if (e.entryDate <= refDate) deathsBefore += e.deaths;
    }
    return Math.max(0, batch.quantityAtStart - deathsBefore);
  }

  /**
   * Calcule la baisse de consommation d'eau normalisée par oiseau, par rapport
   * à une moyenne mobile glissante (WATER_WINDOW_DAYS) des jours précédents.
   * Renvoie null si les données sont insuffisantes (pas d'enregistrement du
   * jour, eau à 0, population nulle, pas de base de comparaison).
   */
  private computeWaterDrop(
    batch: ProductionBatch,
    entries: DailyEntry[],
    baselineWindowDays: number,
  ): {
    todayPerBird: number;
    baselinePerBird: number;
    dropPct: number;
    baselineDays: number;
  } | null {
    if (entries.length === 0) return null;
    const today = entries[0];
    if (today.waterL <= 0) return null;
    const todayPop = this.populationAtDay(batch, entries, today.entryDate);
    if (todayPop <= 0) return null;
    const todayPerBird = today.waterL / todayPop;

    const baselineDays = Math.max(1, Math.round(baselineWindowDays));
    let baseSum = 0;
    let baseCount = 0;
    for (let i = 1; i < entries.length && baseCount < baselineDays; i++) {
      const e = entries[i];
      if (e.waterL <= 0) continue;
      const pop = this.populationAtDay(batch, entries, e.entryDate);
      if (pop <= 0) continue;
      baseSum += e.waterL / pop;
      baseCount += 1;
    }
    if (baseCount === 0) return null;
    const baselinePerBird = baseSum / baseCount;
    if (baselinePerBird <= 0) return null;
    const dropPct = ((baselinePerBird - todayPerBird) / baselinePerBird) * 100;
    return { todayPerBird, baselinePerBird, dropPct, baselineDays: baseCount };
  }

  private async evaluateWater(
    batch: ProductionBatch,
    metrics: BatchMetrics,
    farmId: string,
    batchId: string,
  ) {
    const entries = await this.entriesRepo.find({
      where: { batchId: batch.id },
      order: { entryDate: 'DESC' },
    });
    const windowDays = await this.constants.get(
      ReferenceKey.WATER_WINDOW_DAYS,
      3,
    );
    const drop = this.computeWaterDrop(batch, entries, windowDays);
    const warnPct = await this.constants.get(
      ReferenceKey.WATER_DROP_WARN_PCT,
      10,
    );
    const critPct = await this.constants.get(
      ReferenceKey.WATER_DROP_CRITICAL_PCT,
      25,
    );

    if (!drop) {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.EAU);
      return;
    }

    if (drop.dropPct > critPct) {
      await this.alertsService.raise(
        {
          kind: AlertKind.EAU,
          level: AlertLevel.ROUGE,
          message: `Chute brutale de consommation d’eau (${drop.dropPct.toFixed(0)}% vs. moyenne ${drop.baselineDays} j). La baisse d’eau est l’indicateur n°1 des maladies.`,
          recommendation:
            'Vérifier immédiatement l’abreuvement, la santé du lot et contacter le vétérinaire.',
          context: {
            waterDropPercent: drop.dropPct,
            waterLPerBirdToday: Number(drop.todayPerBird.toFixed(3)),
            baselineDays: drop.baselineDays,
          },
        },
        { farmId, batchId },
      );
    } else if (drop.dropPct > warnPct) {
      await this.alertsService.raise(
        {
          kind: AlertKind.EAU,
          level: AlertLevel.JAUNE,
          message: `Baisse de consommation d’eau de ${drop.dropPct.toFixed(0)}%. Indicateur n°1 à surveiller.`,
          recommendation:
            'Contrôler les abreuvoirs et observer le comportement des volailles.',
          context: {
            waterDropPercent: drop.dropPct,
            waterLPerBirdToday: Number(drop.todayPerBird.toFixed(3)),
            baselineDays: drop.baselineDays,
          },
        },
        { farmId, batchId },
      );
    } else {
      // Pas de chute : on signale un écart à la norme par oiseau (consommation
      // anormalement basse OU haute), car cela peut aussi être un mauvais signe.
      const norm = await this.constants.get(
        ReferenceKey.WATER_PER_BIRD_L_DAY,
        0.2,
      );
      const normWarnPct = await this.constants.get(
        ReferenceKey.WATER_NORM_DEVIATION_WARN_PCT,
        20,
      );
      const deviationPct =
        norm > 0 ? (Math.abs(drop.todayPerBird - norm) / norm) * 100 : 0;
      if (deviationPct > normWarnPct) {
        await this.alertsService.raise(
          {
            kind: AlertKind.EAU,
            level: AlertLevel.JAUNE,
            message: `Consommation d’eau de ${drop.todayPerBird.toFixed(2)} L/oiseau/jour, écart de ${deviationPct.toFixed(0)}% à la norme (${norm} L). Vérifier l’abreuvement.`,
            recommendation:
              'Contrôler la pression des abreuvoirs, la qualité de l’eau et l’état sanitaire du lot.',
            context: {
              waterLPerBirdToday: Number(drop.todayPerBird.toFixed(3)),
              waterNormLPerBird: norm,
              normDeviationPercent: deviationPct,
            },
          },
          { farmId, batchId },
        );
      } else {
        await this.alertsService.clearKind(farmId, batchId, AlertKind.EAU);
      }
    }
  }

  /**
   * Alerte combinée « maladie » : une baisse d'eau persistante (indicateur n°1)
   * associée à une mortalité en hausse est un signe probable de maladie. On
   * monte en ROUGE dès que l'un des deux signaux est critique.
   */
  private async evaluateWaterHealth(
    batch: ProductionBatch,
    metrics: BatchMetrics,
    farmId: string,
    batchId: string,
  ) {
    const entries = await this.entriesRepo.find({
      where: { batchId: batch.id },
      order: { entryDate: 'DESC' },
    });
    const windowDays = await this.constants.get(
      ReferenceKey.WATER_WINDOW_DAYS,
      3,
    );
    const drop = this.computeWaterDrop(batch, entries, windowDays);
    const warnPct = await this.constants.get(
      ReferenceKey.WATER_DROP_WARN_PCT,
      10,
    );
    if (!drop || drop.dropPct <= warnPct) {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.MALADIE);
      return;
    }
    // La mortalité n'est un mauvais signe que si elle dépasse l'attendu à
    // l'âge du lot (une mortalité cumulée sous la norme n'active pas l'alerte).
    if (metrics.mortalityStatus === 'normal') {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.MALADIE);
      return;
    }

    const critPct = await this.constants.get(
      ReferenceKey.WATER_DROP_CRITICAL_PCT,
      25,
    );
    const level =
      drop.dropPct > critPct || metrics.mortalityStatus === 'critical'
        ? AlertLevel.ROUGE
        : AlertLevel.JAUNE;
    await this.alertsService.raise(
      {
        kind: AlertKind.MALADIE,
        level,
        message: `Baisse d’eau (${drop.dropPct.toFixed(0)}%) associée à une mortalité en hausse (${metrics.mortalityPercent.toFixed(1)}%) : signe probable de maladie.`,
        recommendation:
          'Contacter rapidement le vétérinaire et vérifier l’abreuvement, l’alimentation et la biosécurité du lot.',
        context: {
          waterDropPercent: drop.dropPct,
          mortalityPercent: metrics.mortalityPercent,
        },
      },
      { farmId, batchId },
    );
  }

  private async evaluateIpeGmq(
    batch: ProductionBatch,
    metrics: BatchMetrics,
    farmId: string,
    batchId: string,
  ) {
    if (metrics.ipe == null || metrics.ageDays < 14) {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.IPE);
      return;
    }
    const warnPct = await this.constants.get(
      ReferenceKey.IPE_DEVIATION_WARN_PCT,
      10,
    );
    if (metrics.ipe < 100 * (1 - warnPct / 100)) {
      await this.alertsService.raise(
        {
          kind: AlertKind.IPE,
          level: AlertLevel.JAUNE,
          message: `IPE faible (${metrics.ipe.toFixed(1)}) sur le lot ${batch.batchName}. Performance en retrait.`,
          recommendation:
            'Revoir la ration alimentaire, la densité et les conditions d’ambiance.',
          context: { ipe: metrics.ipe },
        },
        { farmId, batchId },
      );
    } else {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.IPE);
    }
  }

  /**
   * Alerte sur la déviation du GMQ : le lot sert de référence à lui-même.
   * Si le GMQ cumulé baisse de plus de warnPct par rapport à la dernière pesée
   * précédente, la croissance a ralenti — indicateur précoce de problème.
   */
  private async evaluateGmq(
    batch: ProductionBatch,
    metrics: BatchMetrics,
    farmId: string,
    batchId: string,
  ) {
    if (metrics.gmqGramsPerDay == null || metrics.ageDays < 14) {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.GMQ);
      return;
    }
    const sampleAgeDays = (entryDate: string) =>
      this.ageDaysAt(entryDate, batch.integrationDate);
    const weighted = (
      await this.entriesRepo.find({
        where: { batchId: batch.id },
        order: { entryDate: 'ASC' },
      })
    ).filter((e) => e.avgWeightKg != null && e.avgWeightKg > 0);
    if (weighted.length < 2) {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.GMQ);
      return;
    }
    const prev = weighted[weighted.length - 2];
    const prevAge = sampleAgeDays(prev.entryDate);
    if (prevAge < 7) {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.GMQ);
      return;
    }
    const prevGmq =
      ((prev.avgWeightKg! - day1WeightKg(batch.species)) * 1000) / prevAge;
    if (prevGmq <= 0) {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.GMQ);
      return;
    }
    const dropPct = ((prevGmq - metrics.gmqGramsPerDay) / prevGmq) * 100;
    const warnPct = await this.constants.get(
      ReferenceKey.GMQ_DEVIATION_WARN_PCT,
      10,
    );
    if (dropPct >= warnPct) {
      await this.alertsService.raise(
        {
          kind: AlertKind.GMQ,
          level: AlertLevel.JAUNE,
          message: `GMQ en recul sur le lot ${batch.batchName} : ${metrics.gmqGramsPerDay.toFixed(1)} g/j vs ${prevGmq.toFixed(1)} g/j avant (${dropPct.toFixed(0)}% de baisse).`,
          recommendation:
            'Vérifier la qualité de l’aliment, l’ambiance (chauffage/ventilation) et la santé du lot ; re-poser une pesée de contrôle.',
          context: {
            gmqGramsPerDay: metrics.gmqGramsPerDay,
            previousGmqGramsPerDay: Number(prevGmq.toFixed(1)),
            dropPercent: Number(dropPct.toFixed(1)),
            warnPercent: warnPct,
          },
        },
        { farmId, batchId },
      );
    } else {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.GMQ);
    }
  }

  private async evaluateExpiration(
    batch: ProductionBatch,
    farmId: string,
    batchId: string,
  ) {
    // Convention dates UTC (YYYY-MM-DD) : la comparaison se fait sur des
    // chaînes ISO, sans convertir en heure locale (robustesse aux fuseaux).
    const today = new Date().toISOString().slice(0, 10);
    const soon = addDaysIso(today, 7);
    const secSoon = addDaysIso(today, 14);
    const lots = await this.inputRepo.find({
      where: { farmId, batchId },
    });

    // Agrégation : l'alerte globale du lot dépend de l'ensemble des intrants,
    // pas de l'ordre de lecture (fix d'un clear dépendant de l'ordre).
    const expired: InputLot[] = [];
    const expiringSoon: InputLot[] = [];
    const expiringLater: InputLot[] = [];
    for (const lot of lots) {
      if (!lot.expirationDate) continue;
      if (lot.expirationDate < today) {
        expired.push(lot);
      } else if (lot.expirationDate <= secSoon) {
        (lot.expirationDate <= soon ? expiringSoon : expiringLater).push(lot);
      }
    }

    if (expired.length > 0) {
      const lot = expired[0];
      await this.alertsService.raise(
        {
          kind: AlertKind.PEREMPTION,
          level: AlertLevel.ROUGE,
          message: `Intrant périmé : ${lot.productName} (lot ${lot.supplierLotNumber})${expired.length > 1 ? ` et ${expired.length - 1} autre(s)` : ''}.`,
          recommendation:
            'Retirer du stock — ne pas distribuer un produit périmé pour la sécurité sanitaire.',
          context: {
            productName: lot.productName,
            expiredCount: expired.length,
          },
        },
        { farmId, batchId },
      );
      return;
    }
    if (expiringSoon.length > 0 || expiringLater.length > 0) {
      const urgent = expiringSoon[0] ?? expiringLater[0];
      await this.alertsService.raise(
        {
          kind: AlertKind.PEREMPTION,
          level: expiringSoon.length > 0 ? AlertLevel.ROUGE : AlertLevel.JAUNE,
          message: `Péremption proche : ${urgent.productName} expire le ${urgent.expirationDate}.`,
          recommendation:
            'Planifier l’utilisation avant la date de péremption.',
          context: {
            productName: urgent.productName,
            expirationDate: urgent.expirationDate,
          },
        },
        { farmId, batchId },
      );
      return;
    }
    await this.alertsService.clearKind(farmId, batchId, AlertKind.PEREMPTION);
  }

  private async evaluateSaleReadiness(
    batch: ProductionBatch,
    metrics: BatchMetrics,
    farmId: string,
    batchId: string,
  ) {
    const traceComplete =
      batch.couvoirSupplier != null &&
      batch.chickLotNumber != null &&
      batch.hatchDate != null;
    const isSaleOrClose =
      batch.status === BatchStatus.EN_VENTE ||
      batch.status === BatchStatus.CLOTURE;
    if (!traceComplete && isSaleOrClose) {
      await this.alertsService.raise(
        {
          kind: AlertKind.TRACABILITE,
          level: AlertLevel.ROUGE,
          message: `Traçabilité HACCP incomplète pour le lot ${batch.batchName} — renseignez la provenance des poussins (exigence gouvernementale).`,
          recommendation:
            'Compléter la provenance des poussins (couvoir, n° de lot, date d’éclosion) dès que possible. Cette alerte reste tracée dans l’historique et le rapport du fermier.',
          context: { traceComplete: false },
        },
        { farmId, batchId },
      );
      return;
    }
    await this.alertsService.clearKind(farmId, batchId, AlertKind.TRACABILITE);
  }
}
