import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BatchType } from '../common/enums/batch-type.enum.js';
import { Species } from '../common/enums/species.enum.js';
import { CareType } from '../common/enums/care-type.enum.js';
import { ReferenceKey } from '../common/enums/reference-key.enum.js';
import { Breed } from '../modules/breeds/entities/breed.entity.js';
import { ReferenceConstant } from '../modules/reference-constants/entities/reference-constant.entity.js';
import { AlertKind } from '../common/enums/alert-level.enum.js';
import { RuleRegistry } from '../modules/alerts/entities/rule-registry.entity.js';
import { SanitaryProtocol } from '../modules/sanitary/entities/sanitary-protocol.entity.js';
import { ProtocolStep } from '../modules/sanitary/entities/protocol-step.entity.js';
import { PaymentMethodConfig } from '../modules/finance/entities/payment-method.entity.js';
import { PaymentMethod } from '../common/enums/payment-method.enum.js';

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
    description: 'Densité d’alerte (oiseaux/m²) — bande Gabon-tropicale 12-15',
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
      'Écart d’âge maximal (semaines) entre bandes cohabitant dans un même bâtiment',
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
];

const DEFAULT_BREEDS: { name: string; type: BatchType; species: Species }[] = [
  { name: 'Cobb 500', type: BatchType.CHAIR, species: Species.POULET },
  { name: 'Hubbard', type: BatchType.CHAIR, species: Species.POULET },
  { name: 'Ross 308', type: BatchType.CHAIR, species: Species.POULET },
  { name: 'ISA Brown', type: BatchType.PONDEUSE, species: Species.POULET },
  { name: 'Lohmann Brown', type: BatchType.PONDEUSE, species: Species.POULET },
];

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

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    @InjectRepository(ReferenceConstant)
    private readonly constantsRepo: Repository<ReferenceConstant>,
    @InjectRepository(Breed)
    private readonly breedRepo: Repository<Breed>,
    @InjectRepository(RuleRegistry)
    private readonly ruleRepo: Repository<RuleRegistry>,
    @InjectRepository(SanitaryProtocol)
    private readonly protocolRepo: Repository<SanitaryProtocol>,
    @InjectRepository(ProtocolStep)
    private readonly stepRepo: Repository<ProtocolStep>,
    @InjectRepository(PaymentMethodConfig)
    private readonly paymentMethodRepo: Repository<PaymentMethodConfig>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedConstants();
    await this.seedBreeds();
    await this.seedRules();
    await this.seedProtocols();
    await this.seedPaymentMethods();
    this.logger.log('Semence des données de référence terminée.');
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
          'Alerte si des bandes d’âges trop écartés cohabitent dans un bâtiment (risque sanitaire).',
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
