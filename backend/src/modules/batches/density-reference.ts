import { Species } from '../../common/enums/species.enum.js';

/**
 * Référentiel de densité par espèce (oiseaux/m²), climat tropical et
 * poulailler aéré. Valeurs indicatives pour des sujets adultes : la densité
 * réelle dépend aussi du poids vif, de la ventilation et du type de logement.
 *
 * Le référentiel sert de défaut « species-aware » qui prime sur les constantes
 * globales (density_warn_per_m2 / density_critical_per_m2, valeur 15/18
 * calibrée pour le poulet de chair). Pour les espèces absentes
 * (extension future), on retombe sur la constante plateforme.
 */
export interface DensityThreshold {
  warnPerM2: number;
  criticalPerM2: number;
}

const DENSITY_BY_SPECIES: Record<Species, DensityThreshold> = {
  [Species.POULET]: { warnPerM2: 15, criticalPerM2: 18 },
  [Species.PINTADE]: { warnPerM2: 14, criticalPerM2: 17 },
  [Species.DINDE]: { warnPerM2: 8, criticalPerM2: 10 },
  [Species.CAILLE]: { warnPerM2: 25, criticalPerM2: 30 },
  [Species.CANARD]: { warnPerM2: 12, criticalPerM2: 15 },
  [Species.OIE]: { warnPerM2: 7, criticalPerM2: 9 },
  [Species.FAISAN]: { warnPerM2: 12, criticalPerM2: 15 },
  [Species.AUTRE]: { warnPerM2: 15, criticalPerM2: 18 },
};

/** Seuils de densité de l'espèce ou null si inconnue (→ constantes globales). */
export function speciesDensityFor(
  species: Species | null | undefined,
): DensityThreshold | null {
  if (!species) return null;
  return DENSITY_BY_SPECIES[species] ?? null;
}

export interface BirdCountLike {
  species: Species | null;
  quantityAlive: number;
}

/**
 * Espèce dominante d'un bâtiment : celle qui cumule le plus d'oiseaux vivants.
 * Retourne null si aucun lot actif.
 */
export function dominantSpecies(activeLots: BirdCountLike[]): Species | null {
  if (activeLots.length === 0) return null;
  const tally = new Map<Species, number>();
  for (const lot of activeLots) {
    if (!lot.species) continue;
    tally.set(lot.species, (tally.get(lot.species) ?? 0) + lot.quantityAlive);
  }
  let best: Species | null = null;
  let bestCount = 0;
  for (const [sp, count] of tally) {
    if (count > bestCount) {
      best = sp;
      bestCount = count;
    }
  }
  return best;
}
