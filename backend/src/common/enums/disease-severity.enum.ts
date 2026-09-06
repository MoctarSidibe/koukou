/**
 * Sévérité d'une maladie (4 niveaux, DISEASE — onglet Maladies).
 * Mappée sur AlertLevel pour le scoring : LOW→VERT, MEDIUM→JAUNE, HIGH/CRITICAL→ROUGE.
 */
export enum DiseaseSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}