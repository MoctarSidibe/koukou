import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { FeedUnit, FoodType } from '../../common/enums/food-type.enum.js';
import { FeedEntryType } from '../../common/enums/feed-entry-type.enum.js';
import { FeedPhase } from '../../common/enums/feed-phase.enum.js';
import { InputKind } from '../../common/enums/input-kind.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { FeedProduct } from '../feed-stock/entities/feed-product.entity.js';
import { InputLot } from './entities/input-lot.entity.js';

const FEED_PHASE_TO_FOOD_TYPE: Record<string, FoodType> = {
  POUSSIN: FoodType.DEMARRAGE,
  DEMARRAGE: FoodType.DEMARRAGE,
  CROISSANCE: FoodType.CROISSANCE,
  PRE_PONTE: FoodType.PONTE,
  PONTE_PHASE_1: FoodType.PONTE,
  PONTE_PHASE_2: FoodType.PONTE,
  PONTE_PHASE_3: FoodType.PONTE,
  FINITION: FoodType.FINITION,
};

export interface CreateInputLotInput {
  farmId: string;
  batchId?: string | null;
  kind: InputKind;
  foodType?: FoodType | null;
  productId?: string | null;
  productName: string;
  supplier: string;
  supplierLotNumber: string;
  expirationDate?: string | null;
  receivedDate?: string | null;
  quantity?: number | null;
  unit?: FeedUnit | null;
  unitPriceFcfa?: number | null;
  entryType?: FeedEntryType;
  feedPhase?: FeedPhase | null;
  customFeedPhaseName?: string | null;
  bagSizeKg?: number | null;
  numberOfBags?: number | null;
  tonnageMt?: number | null;
  costPerMtFcfa?: number | null;
  totalCostFcfa?: number | null;
  doseQuantity?: number | null;
  doseUnit?: string | null;
  additiveName?: string | null;
  notes?: string | null;
}

@Injectable()
export class InputsService {
  constructor(
    @InjectRepository(InputLot)
    private readonly inputRepo: Repository<InputLot>,
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    @InjectRepository(FeedProduct)
    private readonly productRepo: Repository<FeedProduct>,
    private readonly farmsService: FarmsService,
  ) {}

  async create(user: AuthUser, input: CreateInputLotInput): Promise<InputLot> {
    await this.farmsService.assertAccessible(user, input.farmId);
    if (input.batchId != null) {
      const batch = await this.batchRepo.findOne({
        where: { id: input.batchId, farmId: input.farmId },
      });
      if (!batch)
        throw new BadRequestException(
          'Lot de production introuvable dans cette ferme.',
        );
    }

    let entryType = input.entryType ?? FeedEntryType.BAG;

    let foodType = input.foodType ?? null;
    let unitPriceFcfa = input.unitPriceFcfa ?? null;
    let productId: string | null = input.productId ?? null;
    let feedPhase = input.feedPhase ?? null;
    let customFeedPhaseName = input.customFeedPhaseName ?? null;

    if (productId != null && input.kind === InputKind.ALIMENT) {
      const product = await this.productRepo.findOne({
        where: { id: productId, farmId: input.farmId },
      });
      if (!product)
        throw new BadRequestException(
          'Produit du catalogue provende introuvable dans cette ferme.',
        );
      if (foodType == null) foodType = product.foodType;
      if (unitPriceFcfa == null)
        unitPriceFcfa = product.defaultUnitPriceFcfa ?? null;
      if (feedPhase == null) feedPhase = product.feedPhase;
      if (customFeedPhaseName == null)
        customFeedPhaseName = product.customFeedPhaseName;
      if (entryType == null) entryType = product.entryType;
    } else if (productId != null) {
      productId = null;
    }

    if (feedPhase != null && foodType == null) {
      foodType = FEED_PHASE_TO_FOOD_TYPE[feedPhase] ?? FoodType.DEMARRAGE;
    }

    let quantity = input.quantity ?? 0;
    let unit = input.unit ?? null;

    if (entryType === FeedEntryType.BULKER) {
      const mt = input.tonnageMt ?? 0;
      quantity = mt * 1000;
      unit = FeedUnit.KG;
    } else if (entryType === FeedEntryType.BAG) {
      if (input.tonnageMt != null && input.tonnageMt > 0) {
        quantity = input.tonnageMt * 1000;
      } else if (input.numberOfBags != null && input.numberOfBags > 0) {
        const sizeKg = input.bagSizeKg ?? 50;
        quantity = input.numberOfBags * sizeKg;
      } else {
        // Compatibilité : saisie historique transmettant directement quantité/unité.
        quantity = input.quantity ?? 0;
      }
      unit = FeedUnit.SAC;
    } else if (entryType === FeedEntryType.MATIERE_PREMIERE) {
      const mt = input.tonnageMt ?? 0;
      quantity = mt * 1000;
      unit = FeedUnit.KG;
    } else if (entryType === FeedEntryType.MEDICAMENT) {
      // Un médicament est tracé par dose (pas par kg) : on garde la quantité fournie
      // (dose) pour rester cohérent, sans l'utiliser dans l'autonomie en kg.
      quantity = input.quantity ?? input.doseQuantity ?? 0;
      unit = input.unit ?? null;
    }

    return this.inputRepo.save(
      this.inputRepo.create({
        farmId: input.farmId,
        batchId: input.batchId ?? null,
        kind: input.kind,
        foodType,
        productId,
        productName: input.productName,
        supplier: input.supplier,
        supplierLotNumber: input.supplierLotNumber,
        expirationDate: input.expirationDate ?? null,
        receivedDate:
          input.receivedDate ?? new Date().toISOString().slice(0, 10),
        quantity,
        unit,
        unitPriceFcfa,
        entryType,
        feedPhase,
        customFeedPhaseName: input.customFeedPhaseName ?? null,
        bagSizeKg: input.bagSizeKg ?? null,
        numberOfBags: input.numberOfBags ?? null,
        tonnageMt: input.tonnageMt ?? null,
        costPerMtFcfa: input.costPerMtFcfa ?? null,
        totalCostFcfa: input.totalCostFcfa ?? null,
        doseQuantity: input.doseQuantity ?? null,
        doseUnit: input.doseUnit ?? null,
        additiveName: input.additiveName ?? null,
      }),
    );
  }

  async listForFarm(user: AuthUser, farmId: string): Promise<InputLot[]> {
    await this.farmsService.assertAccessible(user, farmId);
    return this.inputRepo.find({
      where: { farmId },
      order: { receivedDate: 'DESC' },
    });
  }

  async addBatchChickOrigin(
    user: AuthUser,
    farmId: string,
    batchId: string,
    data: {
      productName: string;
      supplier: string;
      supplierLotNumber: string;
    },
  ): Promise<InputLot> {
    return this.create(user, {
      farmId,
      batchId,
      kind: InputKind.POUSSINS,
      productName: data.productName,
      supplier: data.supplier,
      supplierLotNumber: data.supplierLotNumber,
      quantity: 1,
    });
  }
}
