export function canManageFarm(role: string | undefined): boolean {
  return role !== 'ELEVEUR';
}

export function roleLabel(role: string | undefined): string {
  if (role === 'ELEVEUR') return 'Éleveur';
  if (role === 'PLATFORM_ADMIN') return 'Administrateur';
  return 'Propriétaire';
}