export enum OrderCanal {
  /** Vente à la ferme : le client retire sur place. */
  FERME = 'FERME',
  /** Vente en livraison : adresse de livraison, retrait par la ferme. */
  LIVRAISON = 'LIVRAISON',
  /** Précommande : engagement avant disponibilité (acompte possible). */
  PRECOMMANDE = 'PRECOMMANDE',
}