export enum OrderStatus {
  /** Bon de commande émis, en attente d'acompte/validation. */
  PENDING = 'PENDING',
  /** Validée (acompte encaissé ou confirmée par la ferme). */
  CONFIRMED = 'CONFIRMED',
  /** Livrée (ferme) ou livraison effectuée : la vente associée est facturée. */
  LIVRE = 'LIVRE',
  CANCELLED = 'CANCELLED',
}