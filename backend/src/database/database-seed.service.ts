import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { BatchType } from '../common/enums/batch-type.enum.js';
import { Species } from '../common/enums/species.enum.js';
import { CareType } from '../common/enums/care-type.enum.js';
import { ReferenceKey } from '../common/enums/reference-key.enum.js';
import { UserRole } from '../common/enums/role.enum.js';
import { Breed } from '../modules/breeds/entities/breed.entity.js';
import { BreedStandard } from '../modules/breeds/entities/breed-standard.entity.js';
import { ReferenceConstant } from '../modules/reference-constants/entities/reference-constant.entity.js';
import { AlertKind } from '../common/enums/alert-level.enum.js';
import { RuleRegistry } from '../modules/alerts/entities/rule-registry.entity.js';
import { SanitaryProtocol } from '../modules/sanitary/entities/sanitary-protocol.entity.js';
import { ProtocolStep } from '../modules/sanitary/entities/protocol-step.entity.js';
import { PaymentMethodConfig } from '../modules/finance/entities/payment-method.entity.js';
import { PaymentMethod } from '../common/enums/payment-method.enum.js';
import { User } from '../modules/users/entities/user.entity.js';

interface SeedConstant {
  key: ReferenceKey;
  value: number;
  description: string;
}

const DEFAULT_CONSTANTS: SeedConstant[] = [
  {
    key: ReferenceKey.STANDARD_MODULE,
    value: 3000,
    description:
      'Unité modulaire standard (standard officiel POUFA : 3000 sujets)',
  },
  {
    key: ReferenceKey.DENSITY_WARN,
    value: 15,
    description: 'Densité d’alerte (oiseaux/m²) — lot Gabon-tropical 12-15',
  },
  {
    key: ReferenceKey.DENSITY_CRITICAL,
    value: 18,
    description: 'Densité critique (oiseaux/m²)',
  },
  {
    key: ReferenceKey.MORTALITY_WARN_PCT,
    value: 1,
    description: 'Seuil d’alerte mortalité (%)',
  },
  {
    key: ReferenceKey.MORTALITY_CRITICAL_PCT,
    value: 5,
    description: 'Seuil critique mortalité (%)',
  },
  {
    key: ReferenceKey.WATER_DROP_WARN_PCT,
    value: 10,
    description: 'Baisse d’eau d’alerte (%) — indicateur n°1',
  },
  {
    key: ReferenceKey.WATER_DROP_CRITICAL_PCT,
    value: 25,
    description: 'Baisse d’eau critique (%)',
  },
  {
    key: ReferenceKey.WATER_WINDOW_DAYS,
    value: 3,
    description: 'Fenêtre (jours) de la moyenne mobile de la consommation d’eau',
  },
  {
    key: ReferenceKey.WATER_PER_BIRD_L_DAY,
    value: 0.2,
    description: 'Norme de consommation d’eau (L / oiseau / jour)',
  },
  {
    key: ReferenceKey.WATER_NORM_DEVIATION_WARN_PCT,
    value: 20,
    description: 'Écart d’alerte (%) à la norme d’eau par oiseau',
  },
  {
    key: ReferenceKey.DEFAULT_SAC_KG,
    value: 50,
    description: 'Poids par défaut d’un sac d’aliment (kg)',
  },
  {
    key: ReferenceKey.FEED_DROP_WARN_PCT,
    value: 10,
    description: 'Baisse d’aliment d’alerte (%)',
  },
  {
    key: ReferenceKey.IPE_DEVIATION_WARN_PCT,
    value: 10,
    description: 'Déviation IPE d’alerte (%)',
  },
  {
    key: ReferenceKey.GMQ_DEVIATION_WARN_PCT,
    value: 10,
    description: 'Déviation GMQ d’alerte (%)',
  },
  {
    key: ReferenceKey.VIDE_SANITAIRE_MIN_DAYS,
    value: 14,
    description: 'Vide sanitaire — durée minimum (jours) avant réintroduction',
  },
  {
    key: ReferenceKey.VIDE_SANITAIRE_MAX_DAYS,
    value: 21,
    description: 'Vide sanitaire — durée recommandée (jours)',
  },
  {
    key: ReferenceKey.AGE_GAP_MAX_WEEKS,
    value: 4,
    description:
      'Écart d’âge maximal (semaines) entre lots cohabitant dans un même bâtiment',
  },
  {
    key: ReferenceKey.BUILDING_DENSITY_WARN,
    value: 15,
    description: 'Densité d’alerte au niveau bâtiment (oiseaux/m²)',
  },
  {
    key: ReferenceKey.BUILDING_DENSITY_CRITICAL,
    value: 18,
    description: 'Densité critique au niveau bâtiment (oiseaux/m²)',
  },
  {
    key: ReferenceKey.PROPHYLAXIE_RETARD_WARN_DAYS,
    value: 1,
    description:
      'Alerter si un soin planifié est en retard de ce nombre de jours',
  },
  {
    key: ReferenceKey.CALENDAR_LEAD_DAYS,
    value: 1,
    description: 'Rappeler un soin N jours avant sa date prévue',
  },
  {
    key: ReferenceKey.FEED_STOCK_WARN_DAYS,
    value: 5,
    description:
      'Stock provende : alerte JAUNE si l’autonomie passe sous N jours',
  },
  {
    key: ReferenceKey.FEED_STOCK_CRITICAL_DAYS,
    value: 3,
    description:
      'Stock provende : alerte ROUGE si l’autonomie passe sous N jours (CDCF — 72 h)',
  },
  {
    key: ReferenceKey.FEED_ORDER_TARGET_DAYS,
    value: 7,
    description:
      'Stock provende : recommander de commander pour couvrir N jours de consommation (quantité suggérée)',
  },
  {
    key: ReferenceKey.RENTABILITE_MARGE_MIN_PCT,
    value: 5,
    description:
      'Rentabilité : marge nette minimale avant alerte JAUNE (compte de résultat par lot)',
  },
  {
    key: ReferenceKey.VENTE_INVENDUS_DAYS,
    value: 5,
    description:
      'Ventes : alerte si un lot en vente n’a pas d’écoulement confirmé depuis N jours',
  },
  {
    key: ReferenceKey.EGG_STOCK_WARN_ALVEOLES,
    value: 10,
    description:
      'Stock œufs : alerte JAUNE dès que le stock non vendu atteint N alvéoles (avant péremption)',
  },
  {
    key: ReferenceKey.CUSTOMER_SEGMENT_TOP_MIN_VISITS,
    value: 6,
    description:
      'Clients : segment TOP dès ce nombre de visites (achats non annulés)',
  },
  {
    key: ReferenceKey.CUSTOMER_SEGMENT_TOP_MIN_FCFA,
    value: 100000,
    description:
      'Clients : segment TOP dès ce total dépensé en FCFA (achats non annulés)',
  },
  {
    key: ReferenceKey.CUSTOMER_SEGMENT_REGULAR_MIN_VISITS,
    value: 2,
    description:
      'Clients : segment RÉGULIER dès ce nombre de visites (achats non annulés)',
  },
  {
    key: ReferenceKey.VENTE_AGE_MIN_DAYS,
    value: 35,
    description:
      'Vente : âge minimal (jours) à partir duquel un lot chair peut être signalé « prêt à vendre »',
  },
  {
    key: ReferenceKey.VENTE_FCR_DEV_MAX_PCT,
    value: 10,
    description:
      'Vente : tolérance maximale de déviation IC (%) vs courbe de la souche avant signal « prêt à vendre »',
  },
  {
    key: ReferenceKey.REFORME_LAY_RATE_FALL_PCT,
    value: 15,
    description:
      'Réforme : signal « prête à vendre » d’une pondeuse quand la ponte chute de X % sous la cible de la souche',
  },
];

const DEFAULT_BREEDS: { name: string; type: BatchType; species: Species }[] = [
  { name: 'Cobb 500', type: BatchType.CHAIR, species: Species.POULET },
  { name: 'Ross 308', type: BatchType.CHAIR, species: Species.POULET },
  { name: 'Ross 708', type: BatchType.CHAIR, species: Species.POULET },
  { name: 'Hubbard', type: BatchType.CHAIR, species: Species.POULET },
  { name: 'Arbor Acres', type: BatchType.CHAIR, species: Species.POULET },
  { name: 'Sasso T451', type: BatchType.CHAIR, species: Species.POULET },
  { name: 'ISA Brown', type: BatchType.PONDEUSE, species: Species.POULET },
  { name: 'Lohmann Brown', type: BatchType.PONDEUSE, species: Species.POULET },
  { name: 'Hy-Line Brown', type: BatchType.PONDEUSE, species: Species.POULET },
  { name: 'Novogen Brown', type: BatchType.PONDEUSE, species: Species.POULET },
  { name: 'Bovans Brown', type: BatchType.PONDEUSE, species: Species.POULET },
  { name: 'Shaver Brown', type: BatchType.PONDEUSE, species: Species.POULET },
  // ── Pintade ──
  { name: 'Pintade Galor', type: BatchType.CHAIR, species: Species.PINTADE },
  { name: 'Pintade Danube', type: BatchType.CHAIR, species: Species.PINTADE },
  { name: 'Pintade Pondeuse', type: BatchType.PONDEUSE, species: Species.PINTADE },
  // ── Dinde ──
  { name: 'Dinde Bronze', type: BatchType.CHAIR, species: Species.DINDE },
  { name: 'Dinde Blanche', type: BatchType.CHAIR, species: Species.DINDE },
  { name: 'Dinde Pondeuse', type: BatchType.PONDEUSE, species: Species.DINDE },
  // ── Caille ──
  { name: 'Caille Japonaise', type: BatchType.CHAIR, species: Species.CAILLE },
  { name: 'Caille Coturnix', type: BatchType.CHAIR, species: Species.CAILLE },
  { name: 'Caille Pondeuse', type: BatchType.PONDEUSE, species: Species.CAILLE },
  // ── Canard ──
  { name: 'Canard de Barbarie', type: BatchType.CHAIR, species: Species.CANARD },
  { name: 'Canard de Pékin', type: BatchType.CHAIR, species: Species.CANARD },
  { name: 'Canard Coureur Indien', type: BatchType.PONDEUSE, species: Species.CANARD },
  { name: 'Canard de Barbarie (pondeuse)', type: BatchType.PONDEUSE, species: Species.CANARD },
  // ── Oie ──
  { name: 'Oie de Toulouse', type: BatchType.CHAIR, species: Species.OIE },
  { name: 'Oie de Chine', type: BatchType.CHAIR, species: Species.OIE },
  { name: 'Oie de Chine (pondeuse)', type: BatchType.PONDEUSE, species: Species.OIE },
  // ── Faisan ──
  { name: 'Faisan de Colchide', type: BatchType.CHAIR, species: Species.FAISAN },
  { name: 'Faisan Doré', type: BatchType.CHAIR, species: Species.FAISAN },
  { name: 'Faisan de Colchide (pondeuse)', type: BatchType.PONDEUSE, species: Species.FAISAN },
  // ── Autre (volailles locales / non catégorisées) ──
  { name: 'Volaille Locale (chair)', type: BatchType.CHAIR, species: Species.AUTRE },
  { name: 'Volaille Locale (pondeuse)', type: BatchType.PONDEUSE, species: Species.AUTRE },
];

/**
 * Référentiel zootechnique des souches par défaut (valeurs indicatives —
 * documentées fournisseur), utilisé par « Breed Intelligence » pour comparer
 * chaque lot à la courbe de référence de sa souche à la semaine d'âge donnée.
 */
const CHAIR_STANDARD_ROWS = (rows: Array<[number, number, number]>) =>
  rows.map(([week, w, f]) => ({
    week,
    targetAvgWeightKg: w,
    targetFcr: f,
    targetLayRatePercent: null,
  }));

const POND_STANDARD_ROWS = (rows: Array<[number, number]>) =>
  rows.map(([week, rate]) => ({
    week,
    targetAvgWeightKg: null,
    targetFcr: null,
    targetLayRatePercent: rate,
  }));

const DEFAULT_BREED_STANDARDS: Record<
  string,
  Array<{
    week: number;
    targetAvgWeightKg: number | null;
    targetFcr: number | null;
    targetLayRatePercent: number | null;
  }>
> = {
  'Cobb 500': CHAIR_STANDARD_ROWS([
    [1, 0.18, 0.85],
    [2, 0.45, 1.19],
    [3, 0.8, 1.42],
    [4, 1.18, 1.58],
    [5, 1.59, 1.71],
    [6, 2.01, 1.82],
    [7, 2.44, 1.92],
    [8, 2.87, 2.01],
    [9, 3.3, 2.1],
    [10, 3.72, 2.2],
    [11, 4.14, 2.29],
    [12, 4.55, 2.38],
  ]),
  'Ross 308': CHAIR_STANDARD_ROWS([
    [1, 0.165, 0.85],
    [2, 0.43, 1.08],
    [3, 0.81, 1.29],
    [4, 1.24, 1.48],
    [5, 1.69, 1.64],
    [6, 2.14, 1.78],
    [7, 2.58, 1.92],
    [8, 3.0, 2.04],
    [9, 3.41, 2.16],
    [10, 3.8, 2.27],
    [11, 4.18, 2.38],
    [12, 4.56, 2.49],
  ]),
  Hubbard: CHAIR_STANDARD_ROWS([
    [1, 0.18, 0.85],
    [2, 0.46, 1.15],
    [3, 0.84, 1.38],
    [4, 1.27, 1.58],
    [5, 1.72, 1.74],
    [6, 2.18, 1.88],
    [7, 2.63, 2.01],
    [8, 3.07, 2.13],
    [9, 3.5, 2.24],
    [10, 3.92, 2.34],
    [11, 4.33, 2.44],
    [12, 4.74, 2.54],
  ]),
  'ISA Brown': POND_STANDARD_ROWS([
    [18, 5],
    [19, 18],
    [20, 40],
    [21, 62],
    [22, 78],
    [23, 86],
    [24, 90],
    [25, 92],
    [27, 93],
    [30, 92],
    [34, 90],
    [38, 88],
    [42, 86],
    [46, 83],
    [50, 79],
    [54, 75],
    [58, 71],
    [62, 67],
    [66, 63],
    [70, 58],
    [72, 55],
  ]),
  'Lohmann Brown': POND_STANDARD_ROWS([
    [18, 5],
    [19, 15],
    [20, 38],
    [21, 60],
    [22, 75],
    [23, 85],
    [24, 89],
    [26, 90],
    [28, 91],
    [32, 92],
    [36, 90],
    [40, 88],
    [44, 85],
    [48, 82],
    [52, 78],
    [56, 73],
    [60, 68],
    [64, 62],
    [68, 56],
    [72, 50],
  ]),
  'Arbor Acres': CHAIR_STANDARD_ROWS([
    [1, 0.18, 0.85],
    [2, 0.46, 1.16],
    [3, 0.82, 1.4],
    [4, 1.22, 1.56],
    [5, 1.64, 1.7],
    [6, 2.06, 1.8],
    [7, 2.48, 1.9],
    [8, 2.9, 2.0],
    [9, 3.32, 2.09],
    [10, 3.74, 2.19],
    [11, 4.16, 2.29],
    [12, 4.56, 2.4],
  ]),
  'Ross 708': CHAIR_STANDARD_ROWS([
    [1, 0.16, 0.85],
    [2, 0.44, 1.05],
    [3, 0.85, 1.24],
    [4, 1.3, 1.42],
    [5, 1.78, 1.58],
    [6, 2.26, 1.72],
    [7, 2.75, 1.86],
    [8, 3.23, 2.0],
    [9, 3.7, 2.13],
    [10, 4.16, 2.25],
    [11, 4.59, 2.37],
    [12, 5.0, 2.48],
  ]),
  'Sasso T451': CHAIR_STANDARD_ROWS([
    [1, 0.15, 0.9],
    [2, 0.35, 1.2],
    [3, 0.6, 1.5],
    [4, 0.85, 1.7],
    [5, 1.1, 1.9],
    [6, 1.35, 2.05],
    [7, 1.6, 2.2],
    [8, 1.85, 2.3],
    [9, 2.1, 2.4],
    [10, 2.35, 2.5],
    [11, 2.6, 2.6],
    [12, 2.85, 2.7],
  ]),
  'Hy-Line Brown': POND_STANDARD_ROWS([
    [18, 5],
    [19, 16],
    [20, 39],
    [21, 60],
    [22, 76],
    [23, 85],
    [24, 89],
    [26, 91],
    [28, 92],
    [32, 93],
    [36, 92],
    [40, 90],
    [44, 87],
    [48, 84],
    [52, 80],
    [56, 75],
    [60, 70],
    [64, 64],
    [68, 58],
    [72, 52],
  ]),
  'Novogen Brown': POND_STANDARD_ROWS([
    [18, 5],
    [19, 17],
    [20, 41],
    [21, 63],
    [22, 79],
    [23, 87],
    [24, 90],
    [26, 91],
    [28, 92],
    [32, 93],
    [36, 91],
    [40, 89],
    [44, 86],
    [48, 82],
    [52, 77],
    [56, 71],
    [60, 65],
    [64, 58],
    [68, 52],
    [72, 46],
  ]),
  'Bovans Brown': POND_STANDARD_ROWS([
    [18, 5],
    [19, 15],
    [20, 35],
    [21, 55],
    [22, 72],
    [23, 83],
    [24, 88],
    [26, 92],
    [28, 94],
    [32, 95],
    [36, 94],
    [40, 92],
    [44, 90],
    [48, 87],
    [52, 83],
    [56, 78],
    [60, 73],
    [64, 67],
    [68, 61],
    [72, 55],
  ]),
  'Shaver Brown': POND_STANDARD_ROWS([
    [18, 5],
    [19, 16],
    [20, 38],
    [21, 58],
    [22, 74],
    [23, 84],
    [24, 89],
    [26, 91],
    [28, 93],
    [32, 94],
    [36, 93],
    [40, 91],
    [44, 89],
    [48, 86],
    [52, 82],
    [56, 77],
    [60, 72],
    [64, 66],
    [68, 59],
    [72, 52],
  ]),
  // ── Pintade ŒChair ──
  'Pintade Galor': CHAIR_STANDARD_ROWS([
    [1, 0.09, 1.1],
    [2, 0.17, 1.5],
    [3, 0.28, 1.8],
    [4, 0.4, 2.0],
    [5, 0.52, 2.15],
    [6, 0.65, 2.3],
    [7, 0.78, 2.4],
    [8, 0.92, 2.5],
    [9, 1.06, 2.6],
    [10, 1.2, 2.7],
    [11, 1.34, 2.8],
    [12, 1.47, 2.9],
  ]),
  'Pintade Danube': CHAIR_STANDARD_ROWS([
    [1, 0.1, 1.1],
    [2, 0.19, 1.45],
    [3, 0.31, 1.75],
    [4, 0.45, 1.95],
    [5, 0.6, 2.1],
    [6, 0.74, 2.25],
    [7, 0.9, 2.4],
    [8, 1.06, 2.55],
    [9, 1.22, 2.65],
    [10, 1.38, 2.75],
    [11, 1.53, 2.85],
    [12, 1.68, 2.95],
  ]),
  'Pintade Pondeuse': POND_STANDARD_ROWS([
    [20, 5],
    [21, 15],
    [22, 28],
    [23, 42],
    [24, 55],
    [25, 62],
    [26, 66],
    [28, 68],
    [30, 67],
    [34, 64],
    [38, 60],
    [42, 56],
    [46, 52],
    [50, 48],
    [54, 44],
    [58, 40],
    [60, 38],
  ]),
  // ── Dinde ──
  'Dinde Bronze': CHAIR_STANDARD_ROWS([
    [1, 0.12, 1.4],
    [2, 0.25, 1.7],
    [3, 0.45, 1.9],
    [4, 0.7, 2.1],
    [5, 1.0, 2.3],
    [6, 1.35, 2.5],
    [7, 1.75, 2.65],
    [8, 2.2, 2.8],
    [9, 2.7, 2.95],
    [10, 3.2, 3.1],
    [11, 3.7, 3.2],
    [12, 4.15, 3.3],
    [14, 5.0, 3.5],
    [16, 5.75, 3.6],
    [18, 6.5, 3.7],
    [20, 7.15, 3.8],
    [22, 7.7, 3.9],
    [24, 8.2, 4.0],
  ]),
  'Dinde Blanche': CHAIR_STANDARD_ROWS([
    [1, 0.13, 1.3],
    [2, 0.3, 1.5],
    [3, 0.55, 1.7],
    [4, 0.9, 1.85],
    [5, 1.3, 2.0],
    [6, 1.75, 2.15],
    [7, 2.25, 2.3],
    [8, 2.8, 2.45],
    [9, 3.4, 2.6],
    [10, 4.0, 2.7],
    [11, 4.6, 2.8],
    [12, 5.2, 2.9],
    [14, 6.4, 3.05],
    [16, 7.5, 3.15],
    [18, 8.5, 3.25],
    [20, 9.3, 3.35],
    [22, 10.0, 3.45],
    [24, 10.6, 3.55],
  ]),
  // ── Caille ──
  'Caille Japonaise': CHAIR_STANDARD_ROWS([
    [1, 0.015, 1.2],
    [2, 0.045, 1.6],
    [3, 0.09, 2.0],
    [4, 0.14, 2.4],
    [5, 0.18, 2.7],
    [6, 0.2, 2.9],
    [7, 0.21, 3.1],
    [8, 0.22, 3.2],
  ]),
  'Caille Coturnix': CHAIR_STANDARD_ROWS([
    [1, 0.016, 1.2],
    [2, 0.05, 1.5],
    [3, 0.1, 1.9],
    [4, 0.16, 2.3],
    [5, 0.21, 2.6],
    [6, 0.24, 2.8],
    [7, 0.25, 3.0],
    [8, 0.26, 3.1],
  ]),
  'Caille Pondeuse': POND_STANDARD_ROWS([
    [5, 10],
    [6, 40],
    [7, 65],
    [8, 75],
    [9, 80],
    [10, 82],
    [12, 83],
    [16, 80],
    [20, 75],
    [24, 70],
    [28, 62],
    [32, 55],
    [36, 48],
    [40, 42],
  ]),
  // ── Canard ──
  'Canard de Barbarie': CHAIR_STANDARD_ROWS([
    [1, 0.14, 1.1],
    [2, 0.3, 1.4],
    [3, 0.5, 1.7],
    [4, 0.75, 1.9],
    [5, 1.0, 2.1],
    [6, 1.3, 2.3],
    [7, 1.55, 2.5],
    [8, 1.8, 2.6],
    [9, 2.1, 2.7],
    [10, 2.4, 2.75],
    [11, 2.7, 2.8],
    [12, 3.0, 2.85],
  ]),
  'Canard de Pékin': CHAIR_STANDARD_ROWS([
    [1, 0.18, 1.0],
    [2, 0.45, 1.3],
    [3, 0.8, 1.5],
    [4, 1.2, 1.7],
    [5, 1.65, 1.85],
    [6, 2.1, 2.0],
    [7, 2.6, 2.1],
    [8, 3.0, 2.2],
    [9, 3.3, 2.25],
    [10, 3.45, 2.3],
  ]),
  'Canard Coureur Indien': POND_STANDARD_ROWS([
    [16, 10],
    [18, 30],
    [20, 55],
    [22, 70],
    [24, 80],
    [26, 85],
    [28, 86],
    [32, 85],
    [36, 82],
    [40, 78],
    [44, 74],
    [48, 70],
    [52, 65],
    [56, 60],
    [60, 55],
  ]),
  'Canard de Barbarie (pondeuse)': POND_STANDARD_ROWS([
    [24, 5],
    [26, 10],
    [28, 15],
    [30, 20],
    [32, 22],
    [34, 23],
    [36, 23],
    [40, 22],
    [44, 20],
    [48, 18],
    [52, 15],
  ]),
  // ── Oie ──
  'Oie de Toulouse': CHAIR_STANDARD_ROWS([
    [1, 0.2, 1.3],
    [2, 0.5, 1.6],
    [3, 1.0, 1.9],
    [4, 1.6, 2.2],
    [5, 2.2, 2.5],
    [6, 2.8, 2.8],
    [8, 3.6, 3.1],
    [10, 4.3, 3.4],
    [12, 4.9, 3.6],
    [14, 5.4, 3.7],
    [16, 5.7, 3.8],
    [18, 5.9, 3.9],
    [20, 6.1, 4.0],
  ]),
  'Oie de Chine': CHAIR_STANDARD_ROWS([
    [1, 0.15, 1.3],
    [2, 0.4, 1.6],
    [3, 0.8, 1.9],
    [4, 1.2, 2.2],
    [5, 1.6, 2.5],
    [6, 2.0, 2.8],
    [8, 2.7, 3.1],
    [10, 3.2, 3.3],
    [12, 3.5, 3.5],
    [14, 3.7, 3.6],
    [16, 3.85, 3.7],
    [18, 4.0, 3.75],
  ]),
  'Oie de Chine (pondeuse)': POND_STANDARD_ROWS([
    [20, 5],
    [22, 15],
    [24, 30],
    [26, 40],
    [28, 45],
    [30, 48],
    [32, 48],
    [36, 45],
    [40, 40],
    [44, 35],
    [48, 28],
    [52, 20],
  ]),
  // ── Faisan ──
  'Faisan de Colchide': CHAIR_STANDARD_ROWS([
    [1, 0.03, 1.1],
    [2, 0.06, 1.5],
    [3, 0.1, 1.8],
    [4, 0.16, 2.1],
    [6, 0.3, 2.5],
    [8, 0.5, 2.8],
    [10, 0.7, 3.0],
    [12, 0.9, 3.1],
    [14, 1.05, 3.15],
    [16, 1.2, 3.2],
    [18, 1.3, 3.25],
    [20, 1.4, 3.3],
  ]),
  'Faisan Doré': CHAIR_STANDARD_ROWS([
    [1, 0.03, 1.1],
    [2, 0.06, 1.5],
    [3, 0.1, 1.8],
    [4, 0.15, 2.1],
    [6, 0.28, 2.5],
    [8, 0.46, 2.8],
    [10, 0.65, 3.0],
    [12, 0.85, 3.1],
    [14, 1.0, 3.15],
    [16, 1.1, 3.2],
    [18, 1.2, 3.25],
    [20, 1.3, 3.3],
  ]),
  'Faisan de Colchide (pondeuse)': POND_STANDARD_ROWS([
    [20, 5],
    [22, 10],
    [24, 15],
    [26, 20],
    [28, 23],
    [30, 25],
    [32, 25],
    [36, 22],
    [40, 18],
    [44, 10],
  ]),
  // ── Dinde Pondeuse (reproductrices) ──
  'Dinde Pondeuse': POND_STANDARD_ROWS([
    [28, 10],
    [30, 25],
    [32, 45],
    [34, 55],
    [36, 60],
    [38, 62],
    [40, 62],
    [44, 60],
    [48, 58],
    [52, 54],
    [56, 50],
    [60, 45],
  ]),
  // ── Autre (volailles locales) ──
  'Volaille Locale (chair)': CHAIR_STANDARD_ROWS([
    [1, 0.03, 1.5],
    [2, 0.07, 1.8],
    [4, 0.15, 2.2],
    [6, 0.28, 2.5],
    [8, 0.42, 2.8],
    [10, 0.58, 3.0],
    [12, 0.75, 3.2],
    [14, 0.9, 3.4],
    [16, 1.05, 3.5],
    [18, 1.2, 3.6],
    [20, 1.35, 3.7],
    [22, 1.5, 3.8],
    [24, 1.6, 3.9],
  ]),
  'Volaille Locale (pondeuse)': POND_STANDARD_ROWS([
    [20, 10],
    [22, 20],
    [24, 35],
    [26, 45],
    [28, 50],
    [30, 52],
    [34, 50],
    [38, 47],
    [42, 43],
    [46, 40],
    [50, 36],
    [54, 32],
    [58, 28],
    [60, 25],
  ]),
};

interface DefaultProtocolStep {
  stepOrder: number;
  dayFrom: number;
  dayTo: number;
  careType: CareType;
  name: string;
  dosage: string | null;
  route: string | null;
  withdrawalDays: number;
}

interface DefaultProtocol {
  code: string;
  name: string;
  species: Species;
  type: BatchType;
  steps: DefaultProtocolStep[];
}

const DEFAULT_PROTOCOLS: DefaultProtocol[] = [
  {
    code: 'proto-poulet-chair-standard',
    name: 'Programme sanitaire standard — Poulet de chair',
    species: Species.POULET,
    type: BatchType.CHAIR,
    steps: [
      {
        stepOrder: 1,
        dayFrom: 0,
        dayTo: 1,
        careType: CareType.VACCIN,
        name: 'Vaccin Marek (couvoir)',
        dosage: '1 dose/sujet',
        route: 'SC (couvoir)',
        withdrawalDays: 0,
      },
      {
        stepOrder: 2,
        dayFrom: 7,
        dayTo: 9,
        careType: CareType.VACCIN,
        name: 'Vaccin Gumboro (IBD) — intermédiaire+',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 3,
        dayFrom: 14,
        dayTo: 16,
        careType: CareType.VACCIN,
        name: 'Vaccin Newcastle (LaSota)',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson / oculo-nasal',
        withdrawalDays: 0,
      },
      {
        stepOrder: 4,
        dayFrom: 21,
        dayTo: 24,
        careType: CareType.VACCIN,
        name: 'Vaccin Newcastle rappel (LaSota)',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 5,
        dayFrom: 28,
        dayTo: 30,
        careType: CareType.VITAMINE,
        name: 'Vitaminage + électrolytes de fin de cycle',
        dosage: 'Selon indication',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
    ],
  },
  {
    code: 'proto-poule-pondeuse-standard',
    name: 'Programme sanitaire standard — Poule pondeuse',
    species: Species.POULET,
    type: BatchType.PONDEUSE,
    steps: [
      {
        stepOrder: 1,
        dayFrom: 0,
        dayTo: 1,
        careType: CareType.VACCIN,
        name: 'Vaccin Marek (couvoir)',
        dosage: '1 dose/sujet',
        route: 'SC (couvoir)',
        withdrawalDays: 0,
      },
      {
        stepOrder: 2,
        dayFrom: 7,
        dayTo: 10,
        careType: CareType.VACCIN,
        name: 'Vaccin Newcastle (LaSota) + Bronchite (H120)',
        dosage: '1 dose/sujet',
        route: 'Eau / oculo-nasal',
        withdrawalDays: 0,
      },
      {
        stepOrder: 3,
        dayFrom: 14,
        dayTo: 16,
        careType: CareType.VACCIN,
        name: 'Vaccin Gumboro (IBD)',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 4,
        dayFrom: 21,
        dayTo: 24,
        careType: CareType.VACCIN,
        name: 'Vaccin Newcastle rappel',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 5,
        dayFrom: 28,
        dayTo: 31,
        careType: CareType.VACCIN,
        name: 'Vaccin Gumboro rappel',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 6,
        dayFrom: 35,
        dayTo: 38,
        careType: CareType.VITAMINE,
        name: 'Vitaminage + électrolytes',
        dosage: 'Selon indication',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
    ],
  },
];

/**
 * Programmes de vaccination pré-chargés (recommandation pays — Gabon).
 * Référentiel : calendrier vaccinal national avicole (poussins de chair et
 * poules pondeuses). Non bloquants : au chargement, les étapes dont la date
 * d'application est déjà passée ou déjà réalisées sont sautées (advisory).
 */
const GABON_VACC_PROTOCOLS: DefaultProtocol[] = [
  {
    code: 'vacc-poulet-chair-gabon',
    name: 'Programme de vaccination — Poulet de chair (Gabon)',
    species: Species.POULET,
    type: BatchType.CHAIR,
    steps: [
      {
        stepOrder: 1,
        dayFrom: 1,
        dayTo: 1,
        careType: CareType.VACCIN,
        name: 'Maladie de Marek — Vaccin obligatoire',
        dosage: '1 dose/sujet',
        route: 'Injection sous-cutanée (couvoir)',
        withdrawalDays: 0,
      },
      {
        stepOrder: 2,
        dayFrom: 1,
        dayTo: 3,
        careType: CareType.VACCIN,
        name: 'Newcastle (ND) + Bronchite infectieuse (BI) — obligatoire',
        dosage: '1 dose/sujet',
        route: 'Goutte oculaire / nébulisation',
        withdrawalDays: 0,
      },
      {
        stepOrder: 3,
        dayFrom: 7,
        dayTo: 10,
        careType: CareType.VACCIN,
        name: 'Gumboro (IBD) 1re dose — obligatoire',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 4,
        dayFrom: 14,
        dayTo: 16,
        careType: CareType.VACCIN,
        name: 'Gumboro (IBD) 2e dose (booster) — obligatoire',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 5,
        dayFrom: 21,
        dayTo: 21,
        careType: CareType.VACCIN,
        name: 'Newcastle (ND) + Bronchite (BI) rappel — obligatoire',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 6,
        dayFrom: 35,
        dayTo: 35,
        careType: CareType.VACCIN,
        name: 'Newcastle (ND) dernier rappel si cycle long (optionnel)',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
    ],
  },
  {
    code: 'vacc-poule-pondeuse-gabon',
    name: 'Programme de vaccination — Poule pondeuse (Gabon)',
    species: Species.POULET,
    type: BatchType.PONDEUSE,
    steps: [
      {
        stepOrder: 1,
        dayFrom: 1,
        dayTo: 1,
        careType: CareType.VACCIN,
        name: 'Maladie de Marek — Vaccin obligatoire',
        dosage: '1 dose/sujet',
        route: 'Injection sous-cutanée (couvoir)',
        withdrawalDays: 0,
      },
      {
        stepOrder: 2,
        dayFrom: 1,
        dayTo: 3,
        careType: CareType.VACCIN,
        name: 'Newcastle (ND) + Bronchite infectieuse (BI) — obligatoire',
        dosage: '1 dose/sujet',
        route: 'Goutte oculaire / nébulisation',
        withdrawalDays: 0,
      },
      {
        stepOrder: 3,
        dayFrom: 7,
        dayTo: 10,
        careType: CareType.VACCIN,
        name: 'Gumboro (IBD) 1re dose — obligatoire',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 4,
        dayFrom: 14,
        dayTo: 14,
        careType: CareType.VACCIN,
        name: 'Newcastle (ND) + Bronchite (BI) rappel — obligatoire',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 5,
        dayFrom: 18,
        dayTo: 21,
        careType: CareType.VACCIN,
        name: 'Gumboro (IBD) 2e dose (booster) — obligatoire',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 6,
        dayFrom: 28,
        dayTo: 28,
        careType: CareType.VACCIN,
        name: 'Variole aviaire — obligatoire',
        dosage: '1 dose/sujet',
        route: 'Transfixion voile alaire',
        withdrawalDays: 0,
      },
      {
        stepOrder: 7,
        dayFrom: 42,
        dayTo: 42,
        careType: CareType.VACCIN,
        name: 'Newcastle (ND) + Bronchite (BI) rappel — obligatoire',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
      {
        stepOrder: 8,
        dayFrom: 56,
        dayTo: 70,
        careType: CareType.VACCIN,
        name: 'Typhose aviaire (réglementé)',
        dosage: 'Selon recommandation vétérinaire',
        route: 'Injection intramusculaire',
        withdrawalDays: 0,
      },
      {
        stepOrder: 9,
        dayFrom: 84,
        dayTo: 84,
        careType: CareType.VACCIN,
        name: 'Coryza infectieux (recommandé en zones humides)',
        dosage: 'Selon recommandation vétérinaire',
        route: 'Injection intramusculaire',
        withdrawalDays: 0,
      },
      {
        stepOrder: 10,
        dayFrom: 98,
        dayTo: 112,
        careType: CareType.VACCIN,
        name: 'EDS + Newcastle (ND) + Bronchite (BI) — pré-ponte, obligatoire',
        dosage: '1 dose/sujet',
        route: 'Injection intramusculaire (combiné)',
        withdrawalDays: 0,
      },
      {
        stepOrder: 11,
        dayFrom: 168,
        dayTo: 365,
        careType: CareType.VACCIN,
        name: 'Newcastle (ND) rappel cyclique en ponte (tous les 2 mois)',
        dosage: '1 dose/sujet',
        route: 'Eau de boisson',
        withdrawalDays: 0,
      },
    ],
  },
];

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    @InjectRepository(ReferenceConstant)
    private readonly constantsRepo: Repository<ReferenceConstant>,
    @InjectRepository(Breed)
    private readonly breedRepo: Repository<Breed>,
    @InjectRepository(BreedStandard)
    private readonly standardRepo: Repository<BreedStandard>,
    @InjectRepository(RuleRegistry)
    private readonly ruleRepo: Repository<RuleRegistry>,
    @InjectRepository(SanitaryProtocol)
    private readonly protocolRepo: Repository<SanitaryProtocol>,
    @InjectRepository(ProtocolStep)
    private readonly stepRepo: Repository<ProtocolStep>,
    @InjectRepository(PaymentMethodConfig)
    private readonly paymentMethodRepo: Repository<PaymentMethodConfig>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedPlatformAdmin();
    await this.seedConstants();
    await this.seedBreeds();
    await this.seedBreedStandards();
    await this.seedRules();
    await this.seedProtocols();
    await this.seedGabonPrograms();
    await this.seedPaymentMethods();
    this.logger.log('Semence des données de référence terminée.');
  }

  /** Compte administrateur plateforme (env uniquement, aucun défaut en clair). */
  private async seedPlatformAdmin(): Promise<void> {
    const email = this.config.get('PLATFORM_ADMIN_EMAIL');
    const phone = this.config.get('PLATFORM_ADMIN_PHONE');
    const password = this.config.get('PLATFORM_ADMIN_PASSWORD');
    if (!email || !phone || !password) {
      this.logger.warn(
        'Variables PLATFORM_ADMIN_EMAIL/PLATFORM_ADMIN_PHONE/PLATFORM_ADMIN_PASSWORD absentes : aucun administrateur plateforme créé.',
      );
      return;
    }
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) return;
    await this.usersRepo.save(
      this.usersRepo.create({
        phone,
        email: email ?? null,
        passwordHash: await bcrypt.hash(password, 10),
        fullName:
          this.config.get('PLATFORM_ADMIN_NAME') ?? 'Administrateur Plateforme',
        role: UserRole.PLATFORM_ADMIN,
      }),
    );
    this.logger.log(`Compte administrateur plateforme prêt (${email}).`);
  }

  private async seedConstants() {
    for (const c of DEFAULT_CONSTANTS) {
      const existing = await this.constantsRepo.findOne({
        where: { key: c.key },
      });
      if (!existing) {
        await this.constantsRepo.save(
          this.constantsRepo.create({ ...c, isEditable: true }),
        );
      }
    }
  }

  private async seedBreeds() {
    for (const b of DEFAULT_BREEDS) {
      const existing = await this.breedRepo.findOne({
        where: { name: b.name },
      });
      if (!existing) {
        await this.breedRepo.save(
          this.breedRepo.create({
            name: b.name,
            type: b.type,
            species: b.species,
            isCustom: false,
          }),
        );
      }
    }
  }

  /** Courbes zootechniques de référence des souches par défaut (idempotent). */
  private async seedBreedStandards() {
    for (const [name, standards] of Object.entries(DEFAULT_BREED_STANDARDS)) {
      const breed = await this.breedRepo.findOne({ where: { name } });
      if (!breed) continue;
      const alreadySeeded = await this.standardRepo.count({
        where: { breedId: breed.id },
      });
      if (alreadySeeded > 0) continue;
      await this.standardRepo.save(
        standards.map((s) =>
          this.standardRepo.create({ ...s, breedId: breed.id }),
        ),
      );
    }
  }

  private async seedRules() {
    const rules: Partial<RuleRegistry>[] = [
      {
        code: 'mortality-1',
        kind: AlertKind.MORTALITE,
        category: 'ELEVAGE',
        shortLabel: 'Mortalité',
        description: 'Déclenche une alerte selon le taux de mortalité du lot.',
      },
      {
        code: 'density-1',
        kind: AlertKind.SURDENSITE,
        category: 'ELEVAGE',
        shortLabel: 'Surdensité',
        description: 'Déclenche une alerte selon la densité (oiseaux/m²).',
      },
      {
        code: 'water-1',
        kind: AlertKind.EAU,
        category: 'ELEVAGE',
        shortLabel: 'Consommation d’eau',
        description:
          'Baisse d’eau = indicateur n°1 des maladies. Alerte dès chute significative.',
      },
      {
        code: 'maladie-1',
        kind: AlertKind.MALADIE,
        category: 'ELEVAGE',
        shortLabel: 'Signe de maladie',
        description:
          'Baisse d’eau combinée à une mortalité en hausse : signe probable de maladie.',
      },
      {
        code: 'ipe-1',
        kind: AlertKind.IPE,
        category: 'ELEVAGE',
        shortLabel: 'IPE',
        description:
          'Alerte si l’Indice de Performance Européen est en retrait.',
      },
      {
        code: 'gmq-1',
        kind: AlertKind.GMQ,
        category: 'ELEVAGE',
        shortLabel: 'GMQ',
        description:
          'Alerte si le Gain Moyen Quotidien fléchit par rapport à la trajectoire du lot.',
      },
      {
        code: 'haccp-expiration-1',
        kind: AlertKind.PEREMPTION,
        category: 'HACCP',
        shortLabel: 'Péremption intrant',
        description:
          'Alerte si un intrant approche ou dépasse sa date de péremption (HACCP).',
      },
      {
        code: 'haccp-traceabilite-1',
        kind: AlertKind.TRACABILITE,
        category: 'VENTE',
        shortLabel: 'Traçabilité avant vente',
        description:
          'Alerte si la vente est envisagée alors que la traçabilité HACCP est incomplète.',
      },
      {
        code: 'cohabitation-1',
        kind: AlertKind.COHABITATION,
        category: 'ELEVAGE',
        shortLabel: 'Cohabitation d’âges',
        description:
          'Alerte si des lots d’âges trop écartés cohabitent dans un bâtiment (risque sanitaire).',
      },
      {
        code: 'vide-sanitaire-1',
        kind: AlertKind.VIDE_SANITAIRE,
        category: 'ELEVAGE',
        shortLabel: 'Vide sanitaire',
        description:
          'Alerte si un bâtiment est réoccupé avant la fin du vide sanitaire légal.',
      },
      {
        code: 'building-density-1',
        kind: AlertKind.DENSITE_BATIMENT,
        category: 'ELEVAGE',
        shortLabel: 'Densité du bâtiment',
        description:
          'Densité calculée sur la somme des oiseaux de tous les lots actifs du bâtiment.',
      },
      {
        code: 'prophylaxie-1',
        kind: AlertKind.PROPHYLAXIE,
        category: 'ELEVAGE',
        shortLabel: 'Prophylaxie',
        description:
          'Soin planifié en retard ou à venir sur un lot (calendrier sanitaire).',
      },
      {
        code: 'delai-attente-1',
        kind: AlertKind.DELAI_ATTENTE,
        category: 'HACCP',
        shortLabel: 'Délai d’attente',
        description:
          "Délai d'attente antibiotique en cours : commercialisation suspendue jusqu'à son expiration (sécurité alimentaire).",
      },
      {
        code: 'stock-aliment-1',
        kind: AlertKind.ALIMENT,
        category: 'ELEVAGE',
        shortLabel: 'Stock provende',
        description:
          'Alerte si le stock de provende passe sous le seuil d’autonomie (JAUNE < 5 j, ROUGE < 3 j de consommation théorique).',
      },
      {
        code: 'rentabilite-1',
        kind: AlertKind.RENTABILITE,
        category: 'FINANCE',
        shortLabel: 'Rentabilité du lot',
        description:
          'Compte de résultat par lot : alerte ROUGE si perte nette, JAUNE si la marge passe sous le seuil minimal (évaluée à la clôture et après chaque vente/dépense).',
      },
      {
        code: 'vente-1',
        kind: AlertKind.VENTE,
        category: 'FINANCE',
        shortLabel: 'Écoulement / invendus',
        description:
          'Alerte si un lot en vente n’a pas eu d’écoulement confirmé depuis vente_invendu_days (5 j) — invendus générant du surcoût (surcharge du bâtiment).',
      },
      {
        code: 'task-1',
        kind: AlertKind.TACHE,
        category: 'EQUIPE',
        shortLabel: 'Tâche en retard',
        description:
          'Alerte ROUGE de niveau ferme si une tâche de l’équipe a dépassé son échéance (statut non FAIT / non ANNULEE).',
      },
      {
        code: 'saisie-manquee-1',
        kind: AlertKind.SAISIE_MANQUEE,
        category: 'ELEVAGE',
        shortLabel: 'Saisie quotidienne manquante',
        description:
          'Alerte JAUNE de niveau ferme si un lot actif/lot en vente n’a pas de saisie journalière pour aujourd’hui (vigilance quotidienne).',
      },
      {
        code: 'stock-oeuf-1',
        kind: AlertKind.STOCK_OEUF,
        category: 'VENTE',
        shortLabel: 'Stock d’œufs à écouler',
        description:
          'Alerte JAUNE si le stock d’œufs non vendus (collectés − vendus) dépasse le seuil de l’alvéoles à écouler avant péremption.',
      },
      {
        code: 'heat-stress-1',
        kind: AlertKind.HEAT,
        category: 'ELEVAGE',
        shortLabel: 'Stress thermique',
        description:
          'Alerte selon l’indice température-humidité (THI) prévu pour la ville de la ferme : Danger/Sévère = ROUGE, Modéré = JAUNE (conseils hydratation/ventilation).',
      },
    ];
    for (const rule of rules) {
      const existing = await this.ruleRepo.findOne({
        where: { code: rule.code, kind: rule.kind },
      });
      if (!existing) {
        await this.ruleRepo.save(
          this.ruleRepo.create({
            ...rule,
            isActive: true,
            category: rule.category as never,
            params: null,
          }),
        );
      }
    }
  }

  private async seedProtocols() {
    for (const protocol of DEFAULT_PROTOCOLS) {
      const existing = await this.protocolRepo.findOne({
        where: { code: protocol.code },
      });
      if (existing) continue;
      const saved = await this.protocolRepo.save(
        this.protocolRepo.create({
          code: protocol.code,
          name: protocol.name,
          species: protocol.species,
          type: protocol.type,
          isDefault: true,
          isEditable: true,
        }),
      );
      for (const s of protocol.steps) {
        await this.stepRepo.save(
          this.stepRepo.create({
            protocolId: saved.id,
            stepOrder: s.stepOrder,
            dayFrom: s.dayFrom,
            dayTo: s.dayTo,
            careType: s.careType,
            name: s.name,
            dosage: s.dosage,
            route: s.route,
            withdrawalDays: s.withdrawalDays,
            active: true,
          }),
        );
      }
    }
  }

  /**
   * Programme de vaccination pré-chargé (Gabon) : référentiel protégé
   * (isEditable = false, isDefault = false) — proposé dans l'onglet
   * Traitements, sans jamais écraser le protocole par défaut de l'espèce.
   */
  private async seedGabonPrograms() {
    for (const program of GABON_VACC_PROTOCOLS) {
      const existing = await this.protocolRepo.findOne({
        where: { code: program.code },
      });
      if (existing) continue;
      const saved = await this.protocolRepo.save(
        this.protocolRepo.create({
          code: program.code,
          name: program.name,
          species: program.species,
          type: program.type,
          isDefault: false,
          isEditable: false,
        }),
      );
      for (const s of program.steps) {
        await this.stepRepo.save(
          this.stepRepo.create({
            protocolId: saved.id,
            stepOrder: s.stepOrder,
            dayFrom: s.dayFrom,
            dayTo: s.dayTo,
            careType: s.careType,
            name: s.name,
            dosage: s.dosage,
            route: s.route,
            withdrawalDays: s.withdrawalDays,
            active: true,
          }),
        );
      }
    }
  }

  /**
   * POS : CASH activé par défaut ; MOBILE_MONEY / QR_CODE affichés au guichet
   * mais désactivés (« Bientôt disponible ») jusqu'à l'intégration des API.
   */
  private async seedPaymentMethods() {
    const defaults: Partial<PaymentMethodConfig>[] = [
      {
        code: PaymentMethod.CASH,
        label: 'Espèces',
        enabled: true,
        displayHint: 'Encaissement comptoir',
        sortOrder: 1,
      },
      {
        code: PaymentMethod.MOBILE_MONEY,
        label: 'Mobile Money (Airtel Money / Moov Money)',
        enabled: false,
        displayHint: 'Bientôt disponible',
        sortOrder: 2,
      },
      {
        code: PaymentMethod.QR_CODE,
        label: 'Paiement par QR code',
        enabled: false,
        displayHint: 'Bientôt disponible',
        sortOrder: 3,
      },
    ];
    for (const def of defaults) {
      const existing = await this.paymentMethodRepo.findOne({
        where: { code: def.code },
      });
      if (!existing) {
        await this.paymentMethodRepo.save(
          this.paymentMethodRepo.create(def as PaymentMethodConfig),
        );
      }
    }
  }
}
