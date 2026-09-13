import { type ImageSourcePropType } from 'react-native';

import type { Species } from '@/api/types';
import { SPECIES_IMAGES } from '@/constants/speciesImages';

/**
 * Visuels des souches (assets/images) — la clé est le nom EXACT de la souche
 * côté serveur (seed `DEFAULT_BREEDS` de database-seed.service.ts). Toute
 * nouvelle souche sans visuel retombe automatiquement sur l'image de son
 * espèce (voir SPECIES_IMAGES) — aucune erreur, jamais de crash.
 */
export const BREED_IMAGES: Record<string, ImageSourcePropType> = {
  // ── Poulet — chair ──
  'Cobb 500': require('@/assets/images/Cobb 500.jpg'),
  'Cobb 700': require('@/assets/images/Cobb 700.jpg'),
  'Ross 308': require('@/assets/images/Ross 308.jpg'),
  'Ross 708': require('@/assets/images/Ross 708.jpg'),
  'Hubbard': require('@/assets/images/Hubbard.jpg'),
  'Arbor Acres': require('@/assets/images/Arbor Acres.jpg'),
  'Sasso T451': require('@/assets/images/Sasso T451.jpg'),
  'Sasso X44': require('@/assets/images/Sasso X44.jpg'),
  'Kuroiler': require('@/assets/images/Kuroiler.jpg'),
  'Kienyeji': require('@/assets/images/Kienyeji.jpg'),
  'Poulet Goliath': require('@/assets/images/Poulet Goliath.jpg'),
  // ── Poulet — pondeuse ──
  'ISA Brown': require('@/assets/images/ISA Brown.jpg'),
  'Lohmann Brown': require('@/assets/images/Lohmann Brown.jpg'),
  'Lohmann White': require('@/assets/images/Lohmann White.jpg'),
  'Hy-Line Brown': require('@/assets/images/Hy-Line Brown.jpg'),
  'Hy-Line White': require('@/assets/images/Hy-Line White.jpg'),
  'Novogen Brown': require('@/assets/images/Novogen Brown.jpg'),
  'Bovans Brown': require('@/assets/images/Bovans Brown.jpg'),
  'Shaver Brown': require('@/assets/images/Shaver Brown.jpg'),
  'White Leghorn': require('@/assets/images/White Leghorn.jpg'),
  'Black Australorp': require('@/assets/images/Black Australorp.jpg'),
  // Pas de visuel « Hisex Brown » fourni → retombe sur l'image de l'espèce.
  'Hisex White': require('@/assets/images/Hisex White.jpg'),
  'Dekalb White': require('@/assets/images/Dekalb White.jpg'),
  'Dekalb Brown': require('@/assets/images/Dekalb Brown.jpg'),
  // ── Pintade ──
  'Pintade Galor': require('@/assets/images/Pintade Galor.jpg'),
  'Pintade Danube': require('@/assets/images/Pintade Danube.jpg'),
  'Pintade Numidia': require('@/assets/images/Pintade Numidia.jpg'),
  'Pintade Pondeuse': require('@/assets/images/Pintade Pondeuse.jpg'),
  // ── Dinde ──
  'Dinde Bronze': require('@/assets/images/Dinde Bronze.jpg'),
  'Dinde Blanche': require('@/assets/images/Dinde Blanche.jpg'),
  'Dinde Broad-Breasted White': require('@/assets/images/Dinde Broad-Breasted White.jpg'),
  'Dinde Bourbon Red': require('@/assets/images/Dinde Bourbon Red.jpg'),
  'Dinde Pondeuse': require('@/assets/images/Dinde Pondeuse.jpg'),
  // ── Caille ──
  'Caille Japonaise': require('@/assets/images/Caille Japonaise.jpg'),
  // ── Canard ──
  'Canard de Barbarie': require('@/assets/images/Canard de Barbarie.jpg'),
  'Canard de Barbarie (pondeuse)': require('@/assets/images/Canard de Barbarie (pondeuse).jpg'),
  // Nom de fichier sans accent ; la clé suit le nom exact de la souche (Pékin).
  'Canard de Pékin': require('@/assets/images/Canard de Pekin.jpg'),
  'Canard Coureur Indien': require('@/assets/images/Canard Coureur Indien.jpg'),
  // ── Oie ──
  'Oie de Toulouse': require('@/assets/images/Oie de Toulouse.jpg'),
  'Oie de Chine': require('@/assets/images/Oie de Chine.jpg'),
  'Oie de Chine (pondeuse)': require('@/assets/images/Oie de Chine (pondeuse).jpg'),
  // ── Faisan ──
  'Faisan de Colchide': require('@/assets/images/Faisan de Colchide.jpg'),
  // Nom de fichier sans accent ; la clé suit le nom exact de la souche (Doré).
  'Faisan Doré': require('@/assets/images/Faisan Dore.jpg'),
};

/**
 * Image d'un lot : priorité au visuel de la SOUCHE (breedName), sinon retombe
 * sur l'image de l'espèce, sinon null (fallback texte du composant appelant).
 * Sert partout où l'on affiche un lot précis (cartes, fiche détail, héros).
 */
export function breedImageForLot(
  breedName: string | null | undefined,
  species: Species | null | undefined,
): ImageSourcePropType | null {
  const breed = breedName?.trim() ? BREED_IMAGES[breedName.trim()] : undefined;
  return breed ?? (species ? SPECIES_IMAGES[species] : undefined) ?? null;
}
