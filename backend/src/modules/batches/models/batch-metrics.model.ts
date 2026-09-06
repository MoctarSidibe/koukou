import { AlertLevel } from '../../../common/enums/alert-level.enum.js';

export type ReadyReason =
  | 'READY'
  | 'TOO_YOUNG'
  | 'FCR'
  | 'SANITARY'
  | 'N_A';

export interface BatchMetrics {
  ageDays: number;
  totalDeaths: number;
  mortalityPercent: number;
  viabilityPercent: number;
  liveCount: number;
  totalFeedKg: number;
  totalWaterL: number;
  waterLPerBird: number | null;
  totalWeightGainKg: number | null;
  fcr: number | null;
  gmqGramsPerDay: number | null;
  ipe: number | null;
  eggsCollectedTotal: number;
  layRatePercent: number | null;
  status: AlertLevel;
  densityPerM2: number | null;
  moduleFraction: number;
  moduleRatioVsCapacity: number | null;
  /** Lot commercialisable : auto-signal (âge + performance). Déclenche précommande/vente. */
  readyForSale: boolean;
  readyReason: ReadyReason;
}
