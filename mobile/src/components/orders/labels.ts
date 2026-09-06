type ChipTone = 'neutral' | 'brand' | 'accent' | 'green' | 'amber' | 'red' | 'outline' | 'solid';

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  LIVRE: 'Livrée',
  CANCELLED: 'Annulée',
};

export const ORDER_STATUS_TONES: Record<string, ChipTone> = {
  PENDING: 'amber',
  CONFIRMED: 'brand',
  LIVRE: 'green',
  CANCELLED: 'red',
};

export const ORDER_CANAL_LABELS: Record<string, string> = {
  FERME: 'Retrait ferme',
  PRECOMMANDE: 'Précommande',
  LIVRAISON: 'Livraison',
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function orderStatusTone(status: string): ChipTone {
  return ORDER_STATUS_TONES[status] ?? 'neutral';
}

export function orderCanalLabel(canal: string): string {
  return ORDER_CANAL_LABELS[canal] ?? canal;
}

export function productLabel(productType: string): string {
  switch (productType) {
    case 'POULET_PIECE':
      return 'Poulet à la pièce';
    case 'POULET_KG':
      return 'Poulet au kilo';
    case 'ABATTU_PIECE':
      return 'Abattu à la pièce';
    case 'ABATTU_KG':
      return 'Abattu au kilo';
    case 'OEUFS':
      return 'Œufs (alvéoles)';
    default:
      return productType;
  }
}