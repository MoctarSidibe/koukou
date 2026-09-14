import { AlertLevel } from '../../../common/enums/alert-level.enum.js';
import type { MortalityStatus } from '../mortality-reference.js';

export type ReadyReason =
  | 'READY'
  | 'TOO_YOUNG'
  | 'FCR'
  | 'SANITARY'
  | 'N_A';

export interface EggBreakdown {
  /** Œufs collectés au total (toutes classes confondues). */
  collected: number;
  /** Œufs commercialisables = collectés − (fêlés + petits + double jaune + sales). */
  sellable: number;
  cracked: number;
  small: number;
  doubleYolk: number;
  dirty: number;
}

export interface BatchMetrics {
  ageDays: number;
  totalDeaths: number;
  mortalityPercent: number;
  /** Mortalité cumulée attendue à l'âge du lot (référentiel de la bande, éprouvé en élevage). */
  expectedMortalityPct: number;
  /** Écart relatif (%) de la mortalité réelle vs attendue (null si attendue = 0). */
  mortalityDeviationPct: number | null;
  /** Lecture simple de l'écart : normal / en hausse / critique. */
  mortalityStatus: MortalityStatus;
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
  /** Répartition des œufs par classe (vie de la bande). */
  eggBreakdown: EggBreakdown;
  layRatePercent: number | null;
  status: AlertLevel;
  densityPerM2: number | null;
  moduleFraction: number;
  moduleRatioVsCapacity: number | null;
  /** Lot commercialisable : auto-signal (âge + performance). Déclenche précommande/vente. */
  readyForSale: boolean;
  readyReason: ReadyReason;
  /** Nombre d'alertes ACTIVES concernant ce lot (badge sur la carte lot). */
  alerts: number;
}
