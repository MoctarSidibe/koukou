import { describe, expect, it } from 'vitest';

import { Species } from '../../common/enums/species.enum.js';
import { dominantSpecies, speciesDensityFor } from './density-reference.js';

describe('speciesDensityFor', () => {
  it('poulet conserve la référence plateforme 15/18', () => {
    expect(speciesDensityFor(Species.POULET)).toEqual({
      warnPerM2: 15,
      criticalPerM2: 18,
    });
  });

  it('espèces lourdes (dinde, oie) → densité réduite', () => {
    expect(speciesDensityFor(Species.DINDE)).toEqual({
      warnPerM2: 8,
      criticalPerM2: 10,
    });
    expect(speciesDensityFor(Species.OIE)).toEqual({
      warnPerM2: 7,
      criticalPerM2: 9,
    });
  });

  it('petites espèces (caille) → densité élevée', () => {
    expect(speciesDensityFor(Species.CAILLE)).toEqual({
      warnPerM2: 25,
      criticalPerM2: 30,
    });
  });

  it('toutes les espèces du système ont un référentiel', () => {
    for (const sp of Object.values(Species)) {
      const threshold = speciesDensityFor(sp);
      expect(threshold).not.toBeNull();
      expect(threshold!.warnPerM2).toBeLessThan(threshold!.criticalPerM2);
      expect(threshold!.warnPerM2).toBeGreaterThan(0);
    }
  });

  it('espèce inconnue / absente → null (repli constantes globales)', () => {
    expect(speciesDensityFor(null)).toBeNull();
    expect(speciesDensityFor(undefined)).toBeNull();
  });
});

describe('dominantSpecies', () => {
  it('retourne l’espèce cumulant le plus d’oiseaux', () => {
    const lots = [
      { species: Species.CAILLE, quantityAlive: 3000 },
      { species: Species.POULET, quantityAlive: 400 },
    ];
    expect(dominantSpecies(lots)).toBe(Species.CAILLE);
  });

  it('retourne null sans lot actif', () => {
    expect(dominantSpecies([])).toBeNull();
  });

  it('ignore les lots sans espèce', () => {
    const lots = [{ species: null, quantityAlive: 300 }];
    expect(dominantSpecies(lots)).toBeNull();
  });
});
