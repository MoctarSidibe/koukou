export enum BatchType {
  CHAIR = 'CHAIR',
  PONDEUSE = 'PONDEUSE',
}

export enum BatchStatus {
  ACTIF = 'ACTIF',
  EN_VENTE = 'EN_VENTE',
  /** Lot épuisé par la vente (quantité à zéro) — fermé automatiquement. */
  FINI = 'FINI',
  CLOTURE = 'CLOTURE',
}
