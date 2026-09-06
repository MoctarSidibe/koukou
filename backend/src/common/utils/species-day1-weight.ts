import { Species } from '../enums/species.enum.js';

/** Poids vif moyen à J1 (kg) par espèce — base des calculs GMQ / FCR / IPE. */
export const DAY1_WEIGHT_KG_BY_SPECIES: Record<Species, number> = {
  [Species.POULET]: 0.045,
  [Species.PINTADE]: 0.027,
  [Species.DINDE]: 0.056,
  [Species.CAILLE]: 0.009,
  [Species.CANARD]: 0.045,
  [Species.OIE]: 0.070,
  [Species.FAISAN]: 0.020,
  [Species.AUTRE]: 0.045,
};

const DEFAULT_DAY1_WEIGHT_KG = 0.045;

export function day1WeightKg(species: Species): number {
  return DAY1_WEIGHT_KG_BY_SPECIES[species] ?? DEFAULT_DAY1_WEIGHT_KG;
}