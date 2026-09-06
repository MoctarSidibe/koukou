/**
 * Type d'événement sanitaire enregistré par le fermier sur un lot.
 * REFORME = réforme/culling sanitaire (élimination d'oiseaux malades),
 * DISTINCT du module Abattage (production). La réforme décrémente le cheptel.
 */
export enum HealthEventKind {
  MALADIE = 'MALADIE',
  MORTALITE = 'MORTALITE',
  REFORME = 'REFORME',
  SYMPTOME = 'SYMPTOME',
  VISITE_VETO = 'VISITE_VETO',
  AUTRE = 'AUTRE',
}
