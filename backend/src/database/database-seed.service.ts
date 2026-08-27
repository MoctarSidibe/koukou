import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BatchType } from '../common/enums/batch-type.enum.js';
import { ReferenceKey } from '../common/enums/reference-key.enum.js';
import { Breed } from '../modules/breeds/entities/breed.entity.js';
import { ReferenceConstant } from '../modules/reference-constants/entities/reference-constant.entity.js';
import { AlertKind } from '../common/enums/alert-level.enum.js';
import { RuleRegistry } from '../modules/alerts/entities/rule-registry.entity.js';

interface SeedConstant {
  key: ReferenceKey;
  value: number;
  description: string;
}

const DEFAULT_CONSTANTS: SeedConstant[] = [
  { key: ReferenceKey.STANDARD_MODULE, value: 3000, description: 'Unité modulaire standard (standard officiel POUFA : 3000 sujets)' },
  { key: ReferenceKey.DENSITY_WARN, value: 15, description: 'Densité d’alerte (oiseaux/m²) — bande Gabon-tropicale 12-15' },
  { key: ReferenceKey.DENSITY_CRITICAL, value: 18, description: 'Densité critique (oiseaux/m²)' },
  { key: ReferenceKey.MORTALITY_WARN_PCT, value: 1, description: 'Seuil d’alerte mortalité (%)' },
  { key: ReferenceKey.MORTALITY_CRITICAL_PCT, value: 5, description: 'Seuil critique mortalité (%)' },
  { key: ReferenceKey.WATER_DROP_WARN_PCT, value: 10, description: 'Baisse d’eau d’alerte (%) — indicateur n°1' },
  { key: ReferenceKey.WATER_DROP_CRITICAL_PCT, value: 25, description: 'Baisse d’eau critique (%)' },
  { key: ReferenceKey.DEFAULT_SAC_KG, value: 50, description: 'Poids par défaut d’un sac d’aliment (kg)' },
  { key: ReferenceKey.FEED_DROP_WARN_PCT, value: 10, description: 'Baisse d’aliment d’alerte (%)' },
  { key: ReferenceKey.IPE_DEVIATION_WARN_PCT, value: 10, description: 'Déviation IPE d’alerte (%)' },
  { key: ReferenceKey.VIDE_SANITAIRE_MIN_DAYS, value: 14, description: 'Vide sanitaire — durée minimum (jours) avant réintroduction' },
  { key: ReferenceKey.VIDE_SANITAIRE_MAX_DAYS, value: 21, description: 'Vide sanitaire — durée recommandée (jours)' },
  { key: ReferenceKey.AGE_GAP_MAX_WEEKS, value: 4, description: 'Écart d’âge maximal (semaines) entre bandes cohabitant dans un même bâtiment' },
  { key: ReferenceKey.BUILDING_DENSITY_WARN, value: 15, description: 'Densité d’alerte au niveau bâtiment (oiseaux/m²)' },
  { key: ReferenceKey.BUILDING_DENSITY_CRITICAL, value: 18, description: 'Densité critique au niveau bâtiment (oiseaux/m²)' },
];

const DEFAULT_BREEDS: { name: string; type: BatchType }[] = [
  { name: 'Cobb 500', type: BatchType.CHAIR },
  { name: 'Hubbard', type: BatchType.CHAIR },
  { name: 'Ross 308', type: BatchType.CHAIR },
  { name: 'ISA Brown', type: BatchType.PONDEUSE },
  { name: 'Lohmann Brown', type: BatchType.PONDEUSE },
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
  ) {}

  async onApplicationBootstrap() {
    await this.seedConstants();
    await this.seedBreeds();
    await this.seedRules();
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
          this.breedRepo.create({ name: b.name, type: b.type, isCustom: false }),
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
        description: 'Baisse d’eau = indicateur n°1 des maladies. Alerte dès chute significative.',
      },
      {
        code: 'ipe-1',
        kind: AlertKind.IPE,
        category: 'ELEVAGE',
        shortLabel: 'IPE',
        description: 'Alerte si l’Indice de Performance Européen est en retrait.',
      },
      {
        code: 'haccp-expiration-1',
        kind: AlertKind.PEREMPTION,
        category: 'HACCP',
        shortLabel: 'Péremption intrant',
        description: 'Alerte si un intrant approche ou dépasse sa date de péremption (HACCP).',
      },
      {
        code: 'haccp-traceabilite-1',
        kind: AlertKind.TRACABILITE,
        category: 'VENTE',
        shortLabel: 'Traçabilité avant vente',
        description: 'Bloque/alement la vente si la traçabilité HACCP est incomplète.',
      },
      {
        code: 'cohabitation-1',
        kind: AlertKind.COHABITATION,
        category: 'ELEVAGE',
        shortLabel: 'Cohabitation d’âges',
        description: 'Alerte si des bandes d’âges trop écartés cohabitent dans un bâtiment (risque sanitaire).',
      },
      {
        code: 'vide-sanitaire-1',
        kind: AlertKind.VIDE_SANITAIRE,
        category: 'ELEVAGE',
        shortLabel: 'Vide sanitaire',
        description: 'Alerte si un bâtiment est réoccupé avant la fin du vide sanitaire légal.',
      },
      {
        code: 'building-density-1',
        kind: AlertKind.DENSITE_BATIMENT,
        category: 'ELEVAGE',
        shortLabel: 'Densité du bâtiment',
        description: 'Densité calculée sur la somme des oiseaux de tous les lots actifs du bâtiment.',
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
}
