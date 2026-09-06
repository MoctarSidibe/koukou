import { describe, it, expect } from 'vitest';

import { canManageFarm, roleLabel } from './roles';

describe('roles', () => {
  it('canManageFarm : Propriétaire et Administrateur gèrent la ferme', () => {
    expect(canManageFarm('PROPRIETAIRE')).toBe(true);
    expect(canManageFarm('PLATFORM_ADMIN')).toBe(true);
    expect(canManageFarm(undefined)).toBe(true);
  });

  it("canManageFarm : l'Éleveur est restreint", () => {
    expect(canManageFarm('ELEVEUR')).toBe(false);
  });

  it('roleLabel : libellés FR', () => {
    expect(roleLabel('ELEVEUR')).toBe('Éleveur');
    expect(roleLabel('PLATFORM_ADMIN')).toBe('Administrateur');
    expect(roleLabel('PROPRIETAIRE')).toBe('Propriétaire');
  });
});