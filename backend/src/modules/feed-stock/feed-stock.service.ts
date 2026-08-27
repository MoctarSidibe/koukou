import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  In,
  IsNull,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AlertKind, AlertLevel } from '../../common/enums/alert-level.enum.js';
import { FoodType } from '../../common/enums/food-type.enum.js';
import { InputKind } from '../../common/enums/input-kind.enum.js';
import { ReferenceKey } from '../../common/enums/reference-key.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { ReferenceConstantsService } from '../reference-constants/reference-constants.service.js';
import { Farm } from '../farms/entities/farm.entity.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { InputLot } from '../inputs/entities/input-lot.entity.js';
import { DailyEntry } from '../daily-entries/entities/daily-entry.entity.js';
import { CreateLossDto } from './dto/create-loss.dto.js';
import {
  FeedStockLoss,
  computeLossKg,
} from './entities/feed-stock-loss.entity.js';
import { FeedStockSale } from './entities/feed-stock-sale.entity.js';
import { FeedUnit } from '../../common/enums/food-type.enum.js';

const CONSUMPTION_WINDOW_DAYS = 3;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

const TYPE_LABELS: Record<string, string> = {
  DEMARRAGE: 'Démarrage',
  CROISSANCE: 'Croissance',
  FINITION: 'Finition',
};

export interface FeedTypeStock {
  foodType: FoodType;
  receivedKg: number;
  usedKg: number;
  lostKg: number;
  soldKg: number;
  availableKg: number;
  autonomyDays: number | null;
  status: AlertLevel;
}

export interface FeedLotStock {
  id: string;
  productName: string;
  supplier: string;
  supplierLotNumber: string;
  batchId: string | null;
  foodType: FoodType | null;
  receivedDate: string;
  expirationDate: string | null;
  quantity: number;
  unit: string | null;
  receivedKg: number;
  usedKg: number;
  lostKg: number;
  soldKg: number;
  availableKg: number;
  expired: boolean;
}

export interface RecordFeedSaleInput {
  farmId: string;
  inputLotId: string | null;
  batchId?: string | null;
  saleItemId: string | null;
  quantity: number;
  unit: FeedUnit;
  soldAt?: string;
  createdById: string | null;
}

interface ComputedStock {
  lots: FeedLotStock[];
  byType: FeedTypeStock[];
}

@Injectable()
export class FeedStockService {
  constructor(
    @InjectRepository(InputLot)
    private readonly inputRepo: Repository<InputLot>,
    @InjectRepository(DailyEntry)
    private readonly entryRepo: Repository<DailyEntry>,
    @InjectRepository(FeedStockLoss)
    private readonly lossRepo: Repository<FeedStockLoss>,
    @InjectRepository(FeedStockSale)
    private readonly saleRepo: Repository<FeedStockSale>,
    @InjectRepository(Farm)
    private readonly farmRepo: Repository<Farm>,
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    private readonly farmsService: FarmsService,
    private readonly alertsService: AlertsService,
    private readonly constants: ReferenceConstantsService,
  ) {}

  // ---------- Lecture du stock (dashboard) ----------

  async getStockSummary(user: AuthUser, farmId: string) {
    await this.farmsService.assertAccessible(user, farmId);
    await this.evaluateStockAlerts(farmId);
    const [criticalDays, warnDays] = await Promise.all([
      this.constants.get(ReferenceKey.FEED_STOCK_CRITICAL_DAYS, 3),
      this.constants.get(ReferenceKey.FEED_STOCK_WARN_DAYS, 5),
    ]);
    const stock = await this.computeFeedStock(farmId, criticalDays, warnDays);
    const losses = await this.lossRepo.find({
      where: { farmId },
      order: { occurredAt: 'DESC', createdAt: 'DESC' },
    });
    return {
      byType: stock.byType,
      lots: stock.lots,
      losses,
    };
  }

  async listLosses(user: AuthUser, farmId: string): Promise<FeedStockLoss[]> {
    await this.farmsService.assertAccessible(user, farmId);
    return this.lossRepo.find({
      where: { farmId },
      order: { occurredAt: 'DESC', createdAt: 'DESC' },
    });
  }

  // ---------- Suivi des pertes (sacs gâtés) ----------

  async recordLoss(
    user: AuthUser,
    farmId: string,
    dto: CreateLossDto,
  ): Promise<FeedStockLoss> {
    const farm = await this.farmsService.assertAccessible(user, farmId);
    const lot = await this.inputRepo.findOne({
      where: { id: dto.inputLotId, farmId },
    });
    if (!lot || lot.kind !== InputKind.ALIMENT) {
      throw new BadRequestException(
        'Lot d’intrant alimentaire introuvable dans cette ferme (catégorie ALIMENT uniquement).',
      );
    }

    const quantityKg = computeLossKg(
      dto.quantity,
      dto.unit,
      farm.defaultSacKg ?? 50,
    );

    const loss = await this.lossRepo.save(
      this.lossRepo.create({
        farmId,
        inputLotId: lot.id,
        batchId: lot.batchId,
        quantityKg,
        reason: dto.reason,
        occurredAt: dto.occurredAt ?? todayStr(),
        notes: dto.notes ?? null,
        createdById: user.id,
      }),
    );
    await this.evaluateStockAlerts(farmId);
    return loss;
  }

  // ---------- Ventes de provende (intégration POS) ----------

  /**
   * Enregistre une vente d'aliment (provende) déclenchée par un point de vente.
   * Convertit la quantité (SAC → kg via `farm.defaultSacKg`). Si `em` est fourni
   * (transaction POS), l'écriture se fait dans cette transaction (validité
   * atomique) ; le rafraîchissement des alertes stock est alors à la charge de
   * l'appelant après commit.
   */
  async recordFeedSale(
    input: RecordFeedSaleInput & { em?: EntityManager },
  ): Promise<FeedStockSale> {
    const manager = input.em;
    const farmRepo = manager ? manager.getRepository(Farm) : this.farmRepo;
    const inputRepo = manager
      ? manager.getRepository(InputLot)
      : this.inputRepo;
    const saleRepo = manager
      ? manager.getRepository(FeedStockSale)
      : this.saleRepo;

    const farm = await farmRepo.findOne({ where: { id: input.farmId } });
    if (!farm) throw new NotFoundException('Ferme introuvable.');

    let lot: InputLot | null = null;
    if (input.inputLotId != null) {
      lot = await inputRepo.findOne({
        where: { id: input.inputLotId, farmId: input.farmId },
      });
      if (!lot || lot.kind !== InputKind.ALIMENT) {
        throw new BadRequestException(
          'Lot d’intrant alimentaire introuvable dans cette ferme (catégorie ALIMENT uniquement).',
        );
      }
    }

    const quantityKg =
      (input.unit ?? FeedUnit.SAC) === FeedUnit.SAC
        ? input.quantity * (farm.defaultSacKg ?? 50)
        : input.quantity;

    if (lot) {
      await this.assertFeedStockAvailable(
        input.em,
        lot.id,
        quantityKg,
        farm.defaultSacKg ?? 50,
      );
    }

    const sale = await saleRepo.save(
      saleRepo.create({
        farmId: input.farmId,
        inputLotId: input.inputLotId,
        batchId: input.batchId ?? lot?.batchId ?? null,
        saleItemId: input.saleItemId,
        quantityKg,
        soldAt: input.soldAt ?? todayStr(),
        createdById: input.createdById,
      }),
    );
    if (!manager) await this.evaluateStockAlerts(input.farmId);
    return sale;
  }

  /** Annule une vente de provende (retour au stock décrémenté). */
  async revertFeedSale(saleItemId: string, em?: EntityManager): Promise<void> {
    const repo = em ? em.getRepository(FeedStockSale) : this.saleRepo;
    await repo.delete({ saleItemId });
  }

  /** Contrôle de disponibilité (réception − conso − pertes − ventes) avant vente POS. */
  private async assertFeedStockAvailable(
    em: EntityManager | undefined,
    inputLotId: string,
    quantityKg: number,
    sacKg: number,
  ): Promise<void> {
    const lot = await (em
      ? em.getRepository(InputLot)
      : this.inputRepo
    ).findOne({ where: { id: inputLotId } });
    if (!lot || lot.kind !== InputKind.ALIMENT) {
      throw new BadRequestException(
        'Lot d’intrant alimentaire introuvable dans cette ferme (catégorie ALIMENT uniquement).',
      );
    }
    const entryRepo = em
      ? em.getRepository(DailyEntry)
      : this.entryRepo;
    const lossRepo = em
      ? em.getRepository(FeedStockLoss)
      : this.lossRepo;
    const saleRepo2 = em
      ? em.getRepository(FeedStockSale)
      : this.saleRepo;

    const [entries, losses, feedSales] = await Promise.all([
      entryRepo.find({ where: { inputLotId } }),
      lossRepo.find({ where: { inputLotId } }),
      saleRepo2.find({ where: { inputLotId } }),
    ]);
    const receivedKg = (lot.unit === 'KG' ? lot.quantity : lot.quantity * sacKg) || 0;
    const usedKg = entries.reduce((s, e) => s + e.feedQuantity, 0);
    const lostKg = losses.reduce((s, l) => s + l.quantityKg, 0);
    const soldKg = feedSales.reduce((s, x) => s + x.quantityKg, 0);
    const availableKg = receivedKg - usedKg - lostKg - soldKg;
    if (quantityKg > availableKg + 1e-6) {
      throw new BadRequestException(
        `Stock d’aliment insuffisant sur ce lot : disponible ${round(Math.max(0, availableKg), 2)} kg, vente demandée ${round(quantityKg, 2)} kg.`,
      );
    }
  }

  // ---------- Journal des mouvements (traçabilité 360°) ----------

  async listMovements(user: AuthUser, farmId: string) {
    await this.farmsService.assertAccessible(user, farmId);
    const lots = await this.inputRepo.find({
      where: { farmId, kind: InputKind.ALIMENT },
    });
    const lotType = new Map<string, FoodType | null>(
      lots.map((l) => [l.id, l.foodType]),
    );
    const lotIds = lots.map((l) => l.id);

    const [entries, losses, feedSales] = await Promise.all([
      lotIds.length > 0
        ? this.entryRepo.find({ where: { inputLotId: In(lotIds) } })
        : Promise.resolve<DailyEntry[]>([]),
      this.lossRepo.find({ where: { farmId } }),
      this.saleRepo.find({ where: { farmId } }),
    ]);

    const movements = [
      ...losses.map((l) => ({
        id: l.id,
        type: 'PERTE',
        date: l.occurredAt,
        quantityKg: l.quantityKg,
        foodType: l.inputLotId ? (lotType.get(l.inputLotId) ?? null) : null,
        inputLotId: l.inputLotId,
        batchId: l.batchId,
        reason: l.reason,
        notes: l.notes,
        createdAt: l.createdAt,
      })),
      ...feedSales.map((s) => ({
        id: s.id,
        type: 'VENTE',
        date: s.soldAt,
        quantityKg: s.quantityKg,
        foodType: s.inputLotId ? (lotType.get(s.inputLotId) ?? null) : null,
        inputLotId: s.inputLotId,
        batchId: s.batchId,
        saleItemId: s.saleItemId,
        createdAt: s.createdAt,
      })),
      ...entries.map((e) => ({
        id: e.id,
        type: 'CONSOMMATION',
        date: e.entryDate,
        quantityKg: e.feedQuantity,
        foodType: e.feedType,
        inputLotId: e.inputLotId,
        batchId: e.batchId,
        source: e.source,
        createdAt: e.createdAt,
      })),
    ];
    movements.sort((a, b) =>
      a.date === b.date
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : a.date < b.date
          ? 1
          : -1,
    );
    return movements;
  }

  // ---------- Évaluation de l'alerte stock (ALIMENT) ----------

  /**
   * Alerte niveau ferme sur la PÉREMPTION des lots d'aliment NON rattachés à un
   * lot de production (batchId null) : le cas le plus fréquent (provende stockée).
   * Les intrants liés à un lot (`batchId` renseigné) sont couverts par l'advisory
   * par lot. ROUGE si périmé ou expire sous 7 j, JAUNE sous 14 j.
   */
  private async evaluateFeedExpiration(farmId: string): Promise<void> {
    const soon = new Date();
    soon.setUTCDate(soon.getUTCDate() + 7);
    const secSoon = new Date();
    secSoon.setUTCDate(secSoon.getUTCDate() + 14);
    const soonStr = soon.toISOString().slice(0, 10);
    const secSoonStr = secSoon.toISOString().slice(0, 10);
    const today = todayStr();

    const lots = await this.inputRepo.find({
      where: { farmId, kind: InputKind.ALIMENT, batchId: IsNull() },
    });
    const expired = lots.filter(
      (l) => l.expirationDate != null && l.expirationDate < today,
    );
    const expiring = lots.filter(
      (l) =>
        l.expirationDate != null &&
        l.expirationDate >= today &&
        l.expirationDate <= secSoonStr,
    );

    if (expired.length > 0) {
      const lot = expired[0];
      await this.alertsService.raise(
        {
          kind: AlertKind.PEREMPTION,
          level: AlertLevel.ROUGE,
          message: `Provende périmée au stock : ${lot.productName} (lot ${lot.supplierLotNumber})${expired.length > 1 ? ` et ${expired.length - 1} autre(s)` : ''}.`,
          recommendation:
            'Retirer du stock — ne jamais distribuer une provende périmée (sécurité sanitaire).',
          context: {
            productName: lot.productName,
            expiredCount: expired.length,
          },
        },
        { farmId },
      );
      return;
    }
    if (expiring.length > 0) {
      const urgent = expiring[0]!;
      const isUrgent = urgent.expirationDate! <= soonStr;
      await this.alertsService.raise(
        {
          kind: AlertKind.PEREMPTION,
          level: isUrgent ? AlertLevel.ROUGE : AlertLevel.JAUNE,
          message: `Provende à écouler avant péremption : ${urgent.productName} expire le ${urgent.expirationDate}.`,
          recommendation:
            'Planifier l’utilisation avant la date de péremption (rotation du stock).',
          context: {
            productName: urgent.productName,
            expirationDate: urgent.expirationDate,
          },
        },
        { farmId },
      );
      return;
    }
    await this.alertsService.clearKind(farmId, null, AlertKind.PEREMPTION);
  }

  /**
   * Alerte niveau ferme sur l'autonomie du stock de provende :
   * consommation théorique = moyenne des 3 derniers jours de saisies.
   * ROUGE < feed_stock_critical_days (3 j), JAUNE < feed_stock_warn_days (5 j).
   */
  async evaluateStockAlerts(farmId: string): Promise<void> {
    await this.evaluateFeedExpiration(farmId);
    const [warnDays, criticalDays] = await Promise.all([
      this.constants.get(ReferenceKey.FEED_STOCK_WARN_DAYS, 5),
      this.constants.get(ReferenceKey.FEED_STOCK_CRITICAL_DAYS, 3),
    ]);
    const stock = await this.computeFeedStock(farmId, criticalDays, warnDays);
    const assessable = stock.byType.filter((t) => t.autonomyDays != null);

    if (assessable.length === 0) {
      await this.alertsService.clearKind(farmId, null, AlertKind.ALIMENT);
      return;
    }

    const critical = assessable
      .filter((t) => t.autonomyDays! < criticalDays)
      .sort((a, b) => a.autonomyDays! - b.autonomyDays!);
    const warning = assessable
      .filter(
        (t) =>
          t.autonomyDays! < warnDays &&
          !critical.some((c) => c.foodType === t.foodType),
      )
      .sort((a, b) => a.autonomyDays! - b.autonomyDays!);

    const autonomyContext = stock.byType.reduce<Record<string, number | null>>(
      (acc, t) => {
        acc[t.foodType] = t.autonomyDays;
        return acc;
      },
      {},
    );

    if (critical.length > 0) {
      const mostUrgent = critical[0];
      const list = critical
        .map(
          (t) =>
            `${TYPE_LABELS[t.foodType] ?? t.foodType} (${t.autonomyDays} j)`,
        )
        .join(', ');
      await this.alertsService.raise(
        {
          kind: AlertKind.ALIMENT,
          level: AlertLevel.ROUGE,
          message: `Stock de provende critique : ${list}. L'autonomie passe sous les ${criticalDays} jours de consommation théorique.`,
          recommendation: `Commander de la provende ${TYPE_LABELS[mostUrgent.foodType] ?? mostUrgent.foodType} immédiatement pour éviter une rupture d'alimentation de la bande.`,
          context: {
            criticalDays,
            warnDays,
            autonomyDays: autonomyContext,
          },
        },
        { farmId },
      );
    } else if (warning.length > 0) {
      const next = warning[0];
      await this.alertsService.raise(
        {
          kind: AlertKind.ALIMENT,
          level: AlertLevel.JAUNE,
          message: `Stock de provende faible : ${TYPE_LABELS[next.foodType] ?? next.foodType} (environ ${next.autonomyDays} jours d'autonomie restants).`,
          recommendation: `Anticiper une commande de provende ${TYPE_LABELS[next.foodType] ?? next.foodType} pour ne pas atteindre le seuil critique de ${criticalDays} jours.`,
          context: {
            criticalDays,
            warnDays,
            autonomyDays: autonomyContext,
          },
        },
        { farmId },
      );
    } else {
      await this.alertsService.clearKind(farmId, null, AlertKind.ALIMENT);
    }
  }

  // ---------- Calcul du stock ----------

  private async computeFeedStock(
    farmId: string,
    criticalDays: number,
    warnDays: number,
  ): Promise<ComputedStock> {
    const farm = await this.farmRepo.findOne({ where: { id: farmId } });
    if (!farm) throw new NotFoundException('Ferme introuvable.');
    const sacKg = farm.defaultSacKg ?? 50;

    const lots = await this.inputRepo.find({
      where: { farmId, kind: InputKind.ALIMENT },
      order: { receivedDate: 'DESC', createdAt: 'DESC' },
    });

    let entries: DailyEntry[] = [];
    let losses: FeedStockLoss[] = [];
    let feedSales: FeedStockSale[] = [];

    if (lots.length > 0) {
      const lotIds = lots.map((l) => l.id);
      [entries, losses, feedSales] = await Promise.all([
        this.entryRepo.find({ where: { inputLotId: In(lotIds) } }),
        this.lossRepo.find({ where: { farmId } }),
        this.saleRepo.find({ where: { farmId } }),
      ]);
    }

    const usedByLot = new Map<string, number>();
    for (const e of entries) {
      if (e.inputLotId == null) continue;
      usedByLot.set(
        e.inputLotId,
        (usedByLot.get(e.inputLotId) ?? 0) + e.feedQuantity,
      );
    }
    const lostByLot = new Map<string, number>();
    for (const l of losses) {
      if (l.inputLotId == null) continue;
      lostByLot.set(
        l.inputLotId,
        (lostByLot.get(l.inputLotId) ?? 0) + l.quantityKg,
      );
    }
    const soldByLot = new Map<string, number>();
    for (const s of feedSales) {
      if (s.inputLotId == null) continue;
      soldByLot.set(
        s.inputLotId,
        (soldByLot.get(s.inputLotId) ?? 0) + s.quantityKg,
      );
    }

    const today = todayStr();
    const lotStocks: FeedLotStock[] = lots.map((lot) => {
      const receivedKg =
        (lot.unit === 'KG' ? lot.quantity : lot.quantity * sacKg) || 0;
      const usedKg = usedByLot.get(lot.id) ?? 0;
      const lostKg = lostByLot.get(lot.id) ?? 0;
      const soldKg = soldByLot.get(lot.id) ?? 0;
      const availableKg = round(
        Math.max(0, receivedKg - usedKg - lostKg - soldKg),
        2,
      );
      return {
        id: lot.id,
        productName: lot.productName,
        supplier: lot.supplier,
        supplierLotNumber: lot.supplierLotNumber,
        batchId: lot.batchId,
        foodType: lot.foodType,
        receivedDate: lot.receivedDate,
        expirationDate: lot.expirationDate,
        quantity: lot.quantity,
        unit: lot.unit,
        receivedKg,
        usedKg: round(usedKg, 2),
        lostKg: round(lostKg, 2),
        soldKg: round(soldKg, 2),
        availableKg,
        expired: lot.expirationDate != null && lot.expirationDate < today,
      };
    });

    // Consommation théorique : moyenne des 3 derniers jours (tous lots de la ferme).
    const dailyAvgByType = new Map<FoodType, number>();
    const batchIds = (
      await this.batchRepo.find({ where: { farmId }, select: { id: true } })
    ).map((b) => b.id);
    if (batchIds.length > 0) {
      const since = daysAgoStr(CONSUMPTION_WINDOW_DAYS - 1);
      const windowEntries = await this.entryRepo.find({
        where: { batchId: In(batchIds), entryDate: MoreThanOrEqual(since) },
      });
      if (windowEntries.length > 0) {
        const daysInWindow = new Set(windowEntries.map((e) => e.entryDate))
          .size;
        for (const type of Object.values(FoodType)) {
          const sum = windowEntries
            .filter((e) => e.feedType === type)
            .reduce((s, e) => s + e.feedQuantity, 0);
          if (sum > 0) {
            dailyAvgByType.set(type, round(sum / daysInWindow, 2));
          }
        }
      }
    }

    const byType: FeedTypeStock[] = [];
    for (const type of Object.values(FoodType)) {
      const typedLots = lotStocks.filter((s) => s.foodType === type);
      if (typedLots.length === 0) continue;
      const receivedKg = round(
        typedLots.reduce((s, x) => s + x.receivedKg, 0),
        2,
      );
      const usedKg = round(
        typedLots.reduce((s, x) => s + x.usedKg, 0),
        2,
      );
      const lostKg = round(
        typedLots.reduce((s, x) => s + x.lostKg, 0),
        2,
      );
      const soldKg = round(
        typedLots.reduce((s, x) => s + x.soldKg, 0),
        2,
      );
      const availableKg = round(
        typedLots.reduce((s, x) => s + x.availableKg, 0),
        2,
      );
      const dailyAvg = dailyAvgByType.get(type) ?? 0;
      const autonomyDays =
        dailyAvg > 0 ? round(availableKg / dailyAvg, 1) : null;
      byType.push({
        foodType: type,
        receivedKg,
        usedKg,
        lostKg,
        soldKg,
        availableKg,
        autonomyDays,
        status: this.stockStatus(autonomyDays, criticalDays, warnDays),
      });
    }

    return { lots: lotStocks, byType };
  }

  private stockStatus(
    autonomyDays: number | null,
    criticalDays: number,
    warnDays: number,
  ): AlertLevel {
    if (autonomyDays == null) return AlertLevel.VERT;
    if (autonomyDays < criticalDays) return AlertLevel.ROUGE;
    if (autonomyDays < warnDays) return AlertLevel.JAUNE;
    return AlertLevel.VERT;
  }
}
