import type { BreedStandard } from '@/api/types';

export interface FeedRecommendationOptions {
  /** Âge du lot en jours. */
  ageDays: number;
  /** Lot pondeuse ou chair. */
  isLayer: boolean;
  /** Effectif vivant actuel. */
  liveCount: number;
  /** Dernier poids moyen pesé (kg) — null si jamais pesé. */
  weighedWeightKg: number | null;
  /** Courbes zootechniques de la souche (fetchBreedStandards), semaine par semaine. */
  standards: BreedStandard[];
}

/** Comment la recommandation a été déduite (contexte utilisateur). */
export type FeedRecommendationKind = 'fcr' | 'weight' | 'none';

export interface FeedRecommendation {
  /** Cible estimée, en g par oiseau et par jour. */
  perBirdG: number | null;
  /** Cible pour l'effectif vivant, en kg par jour. */
  totalKgPerDay: number | null;
  /** Poids (kg) de référence utilisé par le calcul. */
  referenceWeightKg: number | null;
  /** Semaine d'âge retenue sur la courbe souche. */
  week: number | null;
  kind: FeedRecommendationKind;
}

/** Semaine d'âge (convention : semaine 1 = jours 1 à 7). */
export function ageWeek(ageDays: number): number {
  return Math.max(1, Math.floor(ageDays / 7) + 1);
}

function closestStandard(standards: BreedStandard[], week: number): BreedStandard | null {
  if (standards.length === 0) return null;
  const exact = standards.find((s) => s.week === week);
  if (exact) return exact;
  const prior = [...standards].reverse().find((s) => s.week <= week);
  if (prior) return prior;
  return standards.reduce((a, b) => (Math.abs(a.week - week) < Math.abs(b.week - week) ? a : b));
}

/**
 * Estime l'aliment nécessaire pour la journée du lot, en s'appuyant sur la
 * connaissance zootechnique de la souche quand elle existe :
 *
 * 1. **Courbe IC (chair)** : aliment cumulé ≈ poids cible × IC, courbe par courbe
 *    (l'aliment de la semaine = différence de cumul entre la semaine courante et
 *    la précédente) — la recommandation suit donc l'âge ET la souche.
 * 2. **Repli % du poids vif** : pondéuses ou souches sans courbe IC : ≈ 5 % du
 *    poids moyen (pesé, sinon cible souche) pour les pondeuses, 4 % pour la chair.
 */
export function estimateDailyFeedPerBirdKg(opts: FeedRecommendationOptions): FeedRecommendation {
  const week = ageWeek(opts.ageDays);
  const MIN_G = 5;
  const MAX_G = 400;

  const current = closestStandard(opts.standards, week);
  const prev = current && current.week > 1 ? closestStandard(opts.standards, current.week - 1) : null;
  const targetWeightKg = current?.targetAvgWeightKg ?? null;

  let perBirdG: number | null = null;
  let referenceWeightKg: number | null = null;
  let kind: FeedRecommendationKind = 'none';

  if (current && current.targetFcr != null && current.targetFcr > 0 && targetWeightKg != null) {
    const cumCur = targetWeightKg * current.targetFcr;
    const cumPrev =
      prev && prev.targetFcr != null && prev.targetFcr > 0 && prev.targetAvgWeightKg != null
        ? prev.targetAvgWeightKg * prev.targetFcr
        : null;
    // Semaine 1 : l'aliment cumulé couvre les 7 premiers jours.
    const weeklyKg = cumPrev == null ? cumCur : cumCur - cumPrev;
    if (weeklyKg > 0) {
      perBirdG = (weeklyKg * 1000) / 7;
      kind = 'fcr';
      referenceWeightKg = targetWeightKg;
    }
  }

  if (perBirdG == null) {
    referenceWeightKg = opts.weighedWeightKg ?? targetWeightKg;
    if (referenceWeightKg != null && referenceWeightKg > 0) {
      perBirdG = referenceWeightKg * 1000 * (opts.isLayer ? 0.05 : 0.04);
      kind = 'weight';
    }
  }

  if (perBirdG != null) {
    perBirdG = Math.round(Math.max(MIN_G, Math.min(MAX_G, perBirdG)));
  }

  const totalKgPerDay =
    perBirdG != null && opts.liveCount > 0
      ? Math.round((perBirdG * opts.liveCount) / 1000)
      : null;

  if (kind === 'none') referenceWeightKg = null;

  return { perBirdG, totalKgPerDay, referenceWeightKg, week, kind };
}