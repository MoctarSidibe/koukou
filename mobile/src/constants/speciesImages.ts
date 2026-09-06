import { type ImageSourcePropType } from 'react-native';

import type { Species } from '@/api/types';

/** Visuels des espèces (assets/images) — AUTRE n'a pas d'image, on affiche un placeholder. */
export const SPECIES_IMAGES: Partial<Record<Species, ImageSourcePropType>> = {
  POULET: require('../../assets/images/Poulet.jpg'),
  PINTADE: require('../../assets/images/Pintade.jpg'),
  DINDE: require('../../assets/images/Dinde.jpg'),
  CAILLE: require('../../assets/images/Caille.jpg'),
  CANARD: require('../../assets/images/Canard.jpg'),
  OIE: require('../../assets/images/Oie.jpg'),
  FAISAN: require('../../assets/images/Faisant.jpg'),
};