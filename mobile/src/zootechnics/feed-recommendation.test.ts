import { describe, expect, it } from 'vitest';
import type { BreedStandard } from '@/api/types';
import { ageWeek, estimateDailyFeedPerBirdKg } from './feed-recommendation';

const COBB_500: BreedStandard[] = [
  { week: 1, targetAvgWeightKg: 0.18, targetFcr: 0.85, targetLayRatePercent: null },
  { week: 2, targetAvgWeightKg: 0.45, targetFcr: 1.19, targetLayRatePercent: null },
  { week: 3, targetAvgWeightKg: 0.8, targetFcr: 1.42, targetLayRatePercent: null },
  { week: 4, targetAvgWeightKg: 1.18, targetFcr: 1.58, targetLayRatePercent: null },
  { week: 5, targetAvgWeightKg: 1.59, targetFcr: 1.71, targetLayRatePercent: null },
  { week: 6, targetAvgWeightKg: 2.01, targetFcr: 1.82, targetLayRatePercent: null },
];

describe('ageWeek', () => {
  it('semaine 1 pour les jours 1 à 7', () => {
    expect(ageWeek(0)).toBe(1);
    expect(ageWeek(6)).toBe(1);
    expect(ageWeek(7)).toBe(2);
  });

  it('J34 → semaine 5', () => {
    expect(ageWeek(34)).toBe(5);
  });
});

describe('estimateDailyFeedPerBirdKg — courbe IC (chair)', () => {
  it('semaine 5 : aliment du jour = différence de cumul poids×IC entre S5 et S4', () => {
    const rec = estimateDailyFeedPerBirdKg({
      ageDays: 34,
      isLayer: false,
      liveCount: 1000,
      weighedWeightKg: null,
      standards: COBB_500,
    });
    const weeklyKg = 1.59 * 1.71 - 1.18 * 1.58;
    expect(rec.kind).toBe('fcr');
    expect(rec.perBirdG).toBe(Math.round((weeklyKg * 1000) / 7));
    expect(rec.totalKgPerDay).toBe(rec.perBirdG == null ? null : Math.round((rec.perBirdG * 1000) / 1000));
  });

  it('J34 · 120 sujets → kg/jour cohérent', () => {
    const rec = estimateDailyFeedPerBirdKg({
      ageDays: 34,
      isLayer: false,
      liveCount: 120,
      weighedWeightKg: null,
      standards: COBB_500,
    });
    const weeklyKg = 1.59 * 1.71 - 1.18 * 1.58;
    const perBirdG = Math.round((weeklyKg * 1000) / 7);
    expect(rec.perBirdG).toBe(perBirdG);
    expect(rec.totalKgPerDay).toBe(Math.round((perBirdG * 120) / 1000));
    expect(rec.referenceWeightKg).toBe(1.59);
    expect(rec.week).toBe(5);
  });

  it('semaine 1 : le cumul couvre directement les 7 jours', () => {
    const rec = estimateDailyFeedPerBirdKg({
      ageDays: 3,
      isLayer: false,
      liveCount: 500,
      weighedWeightKg: null,
      standards: COBB_500,
    });
    expect(rec.kind).toBe('fcr');
    expect(rec.perBirdG).toBe(Math.round((0.18 * 0.85 * 1000) / 7));
  });

  it('une pesée réelle ne change pas la recommandation de la courbe (souche prioritaire)', () => {
    const rec = estimateDailyFeedPerBirdKg({
      ageDays: 34,
      isLayer: false,
      liveCount: 120,
      weighedWeightKg: 1.9,
      standards: COBB_500,
    });
    expect(rec.kind).toBe('fcr');
    // La courbe prime : le poids pesé n'est utilisé qu'en repli.
    expect(rec.referenceWeightKg).toBe(1.59);
  });
});

describe('estimateDailyFeedPerBirdKg — repli % du poids vif', () => {
  it('pondeuse pesée : ≈ 5 % du poids vif', () => {
    const rec = estimateDailyFeedPerBirdKg({
      ageDays: 120,
      isLayer: true,
      liveCount: 300,
      weighedWeightKg: 1.8,
      standards: [],
    });
    expect(rec.kind).toBe('weight');
    expect(rec.perBirdG).toBe(Math.round(1.8 * 1000 * 0.05));
    expect(rec.referenceWeightKg).toBe(1.8);
  });

  it('chair sans courbe et sans pesée : aucune estimation', () => {
    const rec = estimateDailyFeedPerBirdKg({
      ageDays: 20,
      isLayer: false,
      liveCount: 100,
      weighedWeightKg: null,
      standards: [],
    });
    expect(rec.kind).toBe('none');
    expect(rec.perBirdG).toBeNull();
    expect(rec.totalKgPerDay).toBeNull();
  });

  it('chair pesé sans courbe : repli ≈ 4 % du poids pesé', () => {
    const rec = estimateDailyFeedPerBirdKg({
      ageDays: 20,
      isLayer: false,
      liveCount: 100,
      weighedWeightKg: 0.8,
      standards: [],
    });
    expect(rec.kind).toBe('weight');
    expect(rec.perBirdG).toBe(Math.round(0.8 * 1000 * 0.04));
  });
});