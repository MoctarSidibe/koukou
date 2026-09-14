/**
 * Référentiel de mortalité : la mortalité CUMULÉE d'un lot n'est jamais
 * comparable à un seuil fixe (1 %) — elle croît naturellement avec l'âge de
 * la bande (≈ 1 % en 1re semaine, puis incrément régulier jusqu'à un plafond).
 * On compare donc le cumul réel à une mortalité attendue à l'âge du lot, et on
 * ne signale un écart (en hausse) que si le cumul dépasse nettement l'attendu.
 */

export type MortalityStatus = 'normal' | 'elevated' | 'critical';

export interface MortalityReferenceProfile {
  /** Mortalité cumulée attendue à J7 (%) — rampe linéaire depuis J0. */
  week1Pct: number;
  /** Croissance attendue de la mortalité cumulée au-delà de la 1re semaine (% / semaine). */
  growthPerWeekPct: number;
  /** Plafond de la mortalité attendue (%) — une bande bien menée n'atteint jamais ce niveau. */
  capPct: number;
}

/**
 * Mortalité cumulée attendue à un âge donné, selon un profil de référence :
 *   J0 → J7 : rampe linéaire 0 → week1Pct (la 1re semaine concentre les pertes
 *   poussin — péri-mortalité normale ~1 %).
 *   J7+     : week1Pct + growthPerWeekPct par semaine de plus, plafonnée à capPct.
 */
export function expectedCumulativeMortalityPct(
  ageDays: number,
  profile: MortalityReferenceProfile,
): number {
  const days = Math.max(0, ageDays);
  if (days === 0) return 0;
  if (days < 7) return (profile.week1Pct * days) / 7;
  const weeksBeyond = (days - 7) / 7;
  return Math.min(
    profile.capPct,
    profile.week1Pct + profile.growthPerWeekPct * weeksBeyond,
  );
}

/**
 * Classe l'écart de mortalité réel vs attendu :
 *   - devPct = (réel − attendu) / attendu (% relatif).
 *   - `elevated` dès que l'écart dépasse warnDevPct (%).
 *   - `critical` dès que l'écart dépasse critDevPct (%).
 *   - `normal` sinon (ou si l'attendu est 0 / lot tout juste mis en place).
 */
export function classifyMortality(
  actualPct: number,
  expectedPct: number,
  warnDevPct: number,
  critDevPct: number,
): { devPct: number | null; status: MortalityStatus } {
  if (expectedPct <= 0) return { devPct: null, status: 'normal' };
  const devPct = ((actualPct - expectedPct) / expectedPct) * 100;
  if (devPct > critDevPct) return { devPct, status: 'critical' };
  if (devPct > warnDevPct) return { devPct, status: 'elevated' };
  return { devPct, status: 'normal' };
}