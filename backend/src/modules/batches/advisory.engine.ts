import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AlertKind,
  AlertLevel,
} from '../../common/enums/alert-level.enum.js';
import { ReferenceKey } from '../../common/enums/reference-key.enum.js';
import { BatchStatus } from '../../common/enums/batch-type.enum.js';
import { Building } from '../buildings/entities/building.entity.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { DailyEntry } from '../daily-entries/entities/daily-entry.entity.js';
import { ReferenceConstantsService } from '../reference-constants/reference-constants.service.js';
import { InputLot } from '../inputs/entities/input-lot.entity.js';
import { ProductionBatch } from './entities/production-batch.entity.js';
import { BatchMetrics } from './models/batch-metrics.model.js';

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
      this.evaluateIpeGmq(batch, metrics, farmId, batchId),
      this.evaluateExpiration(batch, farmId, batchId),
      this.evaluateSaleReadiness(batch, metrics, farmId, batchId),
      this.evaluateBuildingContext(batch),
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
    if (area == null || area <= 0) return;
    const activeBirds = activeLots.reduce(
      (s, l) => s + l.quantityAlive,
      0,
    );
    const density = activeBirds / area;
    const warn = await this.constants.get(ReferenceKey.BUILDING_DENSITY_WARN, 15);
    const crit = await this.constants.get(ReferenceKey.BUILDING_DENSITY_CRITICAL, 18);
    const activeBatch = activeLots[0];

    if (density > crit) {
      await this.alertsService.raise(
        {
          kind: AlertKind.DENSITE_BATIMENT,
          level: AlertLevel.ROUGE,
          message: `Densité du bâtiment critique : ${density.toFixed(1)} oiseaux/m² (${activeBirds} oiseaux cumulés).`,
          recommendation:
            'Réduire le cheptel total du bâtiment ou augmenter la surface. Risque sanitaire et thermique élevé.',
          context: { densityBuildingPerM2: density, activeBirds, activeLots: activeLots.length },
        },
        { farmId, batchId: activeBatch?.id ?? null, buildingId },
      );
    } else if (density > warn) {
      await this.alertsService.raise(
        {
          kind: AlertKind.DENSITE_BATIMENT,
          level: AlertLevel.JAUNE,
          message: `Densité du bâtiment élevée : ${density.toFixed(1)} oiseaux/m² (${activeBirds} oiseaux cumulés).`,
          recommendation: 'Surveiller ventilation et litière ; éviter d’ajouter de nouveaux lots.',
          context: { densityBuildingPerM2: density, activeBirds, activeLots: activeLots.length },
        },
        { farmId, batchId: activeBatch?.id ?? null, buildingId },
      );
    } else {
      await this.alertsService.clearKind(farmId, null, AlertKind.DENSITE_BATIMENT, buildingId);
    }
  }

  private async evaluateCohabitation(
    activeLots: ProductionBatch[],
    farmId: string,
    buildingId: string,
  ) {
    if (activeLots.length < 2) {
      await this.alertsService.clearKind(farmId, null, AlertKind.COHABITATION, buildingId);
      return;
    }
    const maxGapWeeks = await this.constants.get(ReferenceKey.AGE_GAP_MAX_WEEKS, 4);
    const agesInWeeks = activeLots.map((l) => this.ageInWeeks(l.integrationDate));
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
          message: `Cohabitation d'âges : écart de ${gapWeeks.toFixed(0)} semaines entre ${activeLots.length} bandes dans le bâtiment. ${hasChick ? 'Un poussin fragile est exposé à une bande mature — risque élevé de transmission virale.' : ''}`,
          recommendation:
            'Planifier un vide sanitaire et, si possible, séparer les bandes d’âges trop écartés pour limiter la propagation de maladies.',
          context: { ageGapWeeks: gapWeeks, maxAgeGapWeeks: maxGapWeeks, activeLots: activeLots.length },
        },
        { farmId, batchId: activeBatch?.id ?? null, buildingId },
      );
    } else {
      await this.alertsService.clearKind(farmId, null, AlertKind.COHABITATION, buildingId);
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
    if (!lastClosed) return;

    const minDays = await this.constants.get(ReferenceKey.VIDE_SANITAIRE_MIN_DAYS, 14);
    const recommendedDays = await this.constants.get(ReferenceKey.VIDE_SANITAIRE_MAX_DAYS, 21);
    const elapsedDays = (Date.now() - lastClosed.updatedAt.getTime()) / 86400000;
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
      await this.alertsService.clearKind(farmId, null, AlertKind.VIDE_SANITAIRE, buildingId);
    }
  }

  private ageInWeeks(integrationDate: string): number {
    const start = new Date(integrationDate + 'T00:00:00').getTime();
    const now = Date.now();
    return Math.max(0, (now - start) / (7 * 86400000));
  }

  private async evaluateMortality(
    batch: ProductionBatch,
    metrics: BatchMetrics,
    farmId: string,
    batchId: string,
  ) {
    const warnPct = await this.constants.get(ReferenceKey.MORTALITY_WARN_PCT, 1);
    const critPct = await this.constants.get(ReferenceKey.MORTALITY_CRITICAL_PCT, 5);
    if (metrics.mortalityPercent > critPct) {
      await this.alertsService.raise(
        {
          kind: AlertKind.MORTALITE,
          level: AlertLevel.ROUGE,
          message: `Mortalité critique : ${metrics.mortalityPercent.toFixed(1)}% sur le lot ${batch.batchName}.`,
          recommendation:
            'Contacter immédiatement le vétérinaire, vérifier la biosécurité et l’hygiène du bâtiment.',
          context: { mortalityPercent: metrics.mortalityPercent },
        },
        { farmId, batchId },
      );
    } else if (metrics.mortalityPercent > warnPct) {
      await this.alertsService.raise(
        {
          kind: AlertKind.MORTALITE,
          level: AlertLevel.JAUNE,
          message: `Mortalité en hausse : ${metrics.mortalityPercent.toFixed(1)}% sur le lot ${batch.batchName}.`,
          recommendation: 'Surveiller la consommation d’eau et l’état général du lot.',
          context: { mortalityPercent: metrics.mortalityPercent },
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
    if (metrics.densityPerM2 == null) return;
    const warn = await this.constants.get(ReferenceKey.DENSITY_WARN, 15);
    const crit = await this.constants.get(ReferenceKey.DENSITY_CRITICAL, 18);
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
    if (entries.length < 2) return;
    const today = entries[0];
    const yesterday = entries[1];
    if (yesterday.waterL <= 0) return;
    const dropPct = ((yesterday.waterL - today.waterL) / yesterday.waterL) * 100;
    const warnPct = await this.constants.get(ReferenceKey.WATER_DROP_WARN_PCT, 10);
    const critPct = await this.constants.get(ReferenceKey.WATER_DROP_CRITICAL_PCT, 25);
    if (dropPct > critPct) {
      await this.alertsService.raise(
        {
          kind: AlertKind.EAU,
          level: AlertLevel.ROUGE,
          message: `Chute brutale de consommation d’eau (${dropPct.toFixed(0)}%). La baisse d’eau est l’indicateur n°1 des maladies.`,
          recommendation:
            'Vérifier immédiatement l’abreuvement, la santé du lot et contacter le vétérinaire.',
          context: { waterDropPercent: dropPct },
        },
        { farmId, batchId },
      );
    } else if (dropPct > warnPct) {
      await this.alertsService.raise(
        {
          kind: AlertKind.EAU,
          level: AlertLevel.JAUNE,
          message: `Baisse de consommation d’eau de ${dropPct.toFixed(0)}%. Indicateur n°1 à surveiller.`,
          recommendation: 'Contrôler les abreuvoirs et observer le comportement des volailles.',
          context: { waterDropPercent: dropPct },
        },
        { farmId, batchId },
      );
    } else {
      await this.alertsService.clearKind(farmId, batchId, AlertKind.EAU);
    }
  }

  private async evaluateIpeGmq(
    batch: ProductionBatch,
    metrics: BatchMetrics,
    farmId: string,
    batchId: string,
  ) {
    if (metrics.ipe == null || metrics.ageDays < 14) return;
    const warnPct = await this.constants.get(ReferenceKey.IPE_DEVIATION_WARN_PCT, 10);
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

  private async evaluateExpiration(
    batch: ProductionBatch,
    farmId: string,
    batchId: string,
  ) {
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    const secSoon = new Date();
    secSoon.setDate(secSoon.getDate() + 14);
    const lots = await this.inputRepo.find({
      where: { farmId, batchId },
    });
    for (const lot of lots) {
      if (!lot.expirationDate) continue;
      const exp = new Date(lot.expirationDate + 'T00:00:00');
      if (exp < new Date()) {
        await this.alertsService.raise(
          {
            kind: AlertKind.PEREMPTION,
            level: AlertLevel.ROUGE,
            message: `Intrant périmé : ${lot.productName} (lot ${lot.supplierLotNumber}).`,
            recommendation:
              'Retirer du stock — ne pas distribuer un produit périmé pour la sécurité sanitaire.',
            context: { productName: lot.productName },
          },
          { farmId, batchId },
        );
      } else if (exp <= secSoon) {
        await this.alertsService.raise(
          {
            kind: AlertKind.PEREMPTION,
            level: exp <= soon ? AlertLevel.ROUGE : AlertLevel.JAUNE,
            message: `Péremption proche : ${lot.productName} expire le ${lot.expirationDate}.`,
            recommendation: 'Planifier l’utilisation avant la date de péremption.',
            context: { productName: lot.productName, expirationDate: lot.expirationDate },
          },
          { farmId, batchId },
        );
      } else {
        await this.alertsService.clearKind(farmId, batchId, AlertKind.PEREMPTION);
      }
    }
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
      batch.status === BatchStatus.EN_VENTE || batch.status === BatchStatus.CLOTURE;
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
