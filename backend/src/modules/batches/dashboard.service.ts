import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AlertLevel, AlertStatus } from '../../common/enums/alert-level.enum.js';
import { BatchStatus } from '../../common/enums/batch-type.enum.js';
import { PaymentStatus } from '../../common/enums/payment-method.enum.js';
import { isoWeekStart } from '../../common/utils/date.utils.js';
import { DailyEntry } from '../daily-entries/entities/daily-entry.entity.js';
import { FarmEmployee } from '../farms/entities/farm-employee.entity.js';
import { FarmsService } from '../farms/farms.service.js';
import { FeedStockService } from '../feed-stock/feed-stock.service.js';
import { Alert } from '../alerts/entities/alert.entity.js';
import { Payment } from '../finance/entities/payment.entity.js';
import { ProductionBatch } from './entities/production-batch.entity.js';

const DAY1_WEIGHT_KG = 0.045;

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface DashboardData {
  farmId: string;
  generatedAt: string;
  liveStock: number;
  batches: { total: number; actif: number; enVente: number; cloture: number };
  mortalityPercent: number | null;
  viabilityPercent: number | null;
  feedAutonomyDays: number | null;
  collectedTodayFcfa: number;
  teamCount: number;
  alerts: { total: number; rouge: number; jaune: number; vert: number };
}

export interface CurveWeek {
  weekStart: string;
  avgWeightKg: number | null;
  feedKg: number;
  deaths: number;
  cumFeedKg: number;
  fcrCumulative: number | null;
}

export interface BatchCurve {
  batchId: string;
  liveCount: number;
  startWeightKg: number;
  weekly: CurveWeek[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    @InjectRepository(DailyEntry)
    private readonly entryRepo: Repository<DailyEntry>,
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(FarmEmployee)
    private readonly employeeRepo: Repository<FarmEmployee>,
    private readonly farmsService: FarmsService,
    private readonly feedStockService: FeedStockService,
  ) {}

  async getDashboard(user: AuthUser, farmId: string): Promise<DashboardData> {
    await this.farmsService.assertAccessible(user, farmId);

    const [batches, alerts, employees, feedSummary, collectedToday] =
      await Promise.all([
        this.batchRepo.find({ where: { farmId } }),
        this.alertRepo.find({
          where: { farmId, status: AlertStatus.ACTIVE },
        }),
        this.employeeRepo.count({ where: { farmId } }),
        this.feedStockService.getStockSummary(user, farmId),
        this.paymentRepo.sum('amountFcfa', {
          farmId,
          paymentDate: new Date().toISOString().slice(0, 10),
          status: PaymentStatus.CONFIRMED,
        }),
      ]);

    let totalDeaths = 0;
    let totalStart = 0;
    const liveStock = batches.reduce((s, b) => s + b.quantityAlive, 0);
    if (batches.length > 0) {
      const entries = await this.entryRepo.find({
        where: { batchId: In(batches.map((b) => b.id)) },
      });
      totalDeaths = entries.reduce((s, e) => s + e.deaths, 0);
      totalStart = batches.reduce((s, b) => s + b.quantityAtStart, 0);
    }

    const mortalityPercent =
      totalStart > 0 ? round2((totalDeaths / totalStart) * 100) : null;
    const viabilityPercent =
      mortalityPercent != null ? round2(100 - mortalityPercent) : null;

    const autonomyDays = feedSummary.byType
      .map((t) => t.autonomyDays)
      .filter((d): d is number => d != null)
      .reduce((min, d) => Math.min(min, d), Infinity);
    const feedAutonomyDays =
      autonomyDays === Infinity ? null : round2(autonomyDays);

    const alertLevels = alerts.reduce(
      (acc, a) => {
        if (a.level === AlertLevel.ROUGE) acc.rouge += 1;
        else if (a.level === AlertLevel.JAUNE) acc.jaune += 1;
        else acc.vert += 1;
        return acc;
      },
      { rouge: 0, jaune: 0, vert: 0 },
    );

    return {
      farmId,
      generatedAt: new Date().toISOString(),
      liveStock,
      batches: {
        total: batches.length,
        actif: batches.filter((b) => b.status === BatchStatus.ACTIF).length,
        enVente: batches.filter((b) => b.status === BatchStatus.EN_VENTE).length,
        cloture: batches.filter((b) => b.status === BatchStatus.CLOTURE).length,
      },
      mortalityPercent,
      viabilityPercent,
      feedAutonomyDays,
      collectedTodayFcfa: collectedToday ?? 0,
      teamCount: employees,
      alerts: { total: alerts.length, ...alertLevels },
    };
  }

  async getCurve(user: AuthUser, farmId: string, batchId: string): Promise<BatchCurve> {
    await this.farmsService.assertAccessible(user, farmId);
    const batch = await this.batchRepo.findOne({ where: { id: batchId, farmId } });
    if (!batch) throw new NotFoundException('Lot introuvable dans cette ferme.');

    const entries = await this.entryRepo.find({
      where: { batchId },
      order: { entryDate: 'ASC' },
    });

    type WeekGroup = {
      weekStart: string;
      weightSum: number;
      weightCount: number;
      feedKg: number;
      deaths: number;
      lastAvgWeightKg: number | null;
    };
    const byWeek = new Map<string, WeekGroup>();
    for (const e of entries) {
      if (e.feedQuantity <= 0 && e.deaths <= 0 && e.avgWeightKg == null) continue;
      const weekStart = isoWeekStart(e.entryDate);
      let group = byWeek.get(weekStart);
      if (!group) {
        group = {
          weekStart,
          weightSum: 0,
          weightCount: 0,
          feedKg: 0,
          deaths: 0,
          lastAvgWeightKg: null,
        };
        byWeek.set(weekStart, group);
      }
      group.feedKg += e.feedQuantity;
      group.deaths += e.deaths;
      if (e.avgWeightKg != null && e.avgWeightKg > 0) {
        group.weightSum += e.avgWeightKg;
        group.weightCount += 1;
        group.lastAvgWeightKg = e.avgWeightKg;
      }
    }

    const liveCount = Math.max(0, batch.quantityAlive);
    const cumFeed = (w: WeekGroup) => w.feedKg;
    const weeks = [...byWeek.values()].sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart),
    );

    let accumulatedFeed = 0;
    const weekly: CurveWeek[] = weeks.map((w) => {
      accumulatedFeed += cumFeed(w);
      const weightGainKg =
        w.lastAvgWeightKg != null
          ? (w.lastAvgWeightKg - DAY1_WEIGHT_KG) * liveCount
          : 0;
      const fcrCumulative =
        weightGainKg > 0 && accumulatedFeed > 0
          ? round2(accumulatedFeed / weightGainKg)
          : null;
      return {
        weekStart: w.weekStart,
        avgWeightKg:
          w.weightCount > 0
            ? round2(w.weightSum / w.weightCount)
            : null,
        feedKg: round2(w.feedKg),
        deaths: w.deaths,
        cumFeedKg: round2(accumulatedFeed),
        fcrCumulative,
      };
    });

    return {
      batchId,
      liveCount,
      startWeightKg: DAY1_WEIGHT_KG,
      weekly,
    };
  }
}