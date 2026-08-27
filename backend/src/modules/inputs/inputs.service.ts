import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { FeedUnit, FoodType } from '../../common/enums/food-type.enum.js';
import { InputKind } from '../../common/enums/input-kind.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { InputLot } from './entities/input-lot.entity.js';

export interface CreateInputLotInput {
  farmId: string;
  batchId?: string | null;
  kind: InputKind;
  foodType?: FoodType | null;
  productName: string;
  supplier: string;
  supplierLotNumber: string;
  expirationDate?: string | null;
  receivedDate?: string | null;
  quantity: number;
  unit?: FeedUnit | null;
}

@Injectable()
export class InputsService {
  constructor(
    @InjectRepository(InputLot)
    private readonly inputRepo: Repository<InputLot>,
    private readonly farmsService: FarmsService,
  ) {}

  async create(user: AuthUser, input: CreateInputLotInput): Promise<InputLot> {
    await this.farmsService.assertAccessible(user, input.farmId);
    return this.inputRepo.save(
      this.inputRepo.create({
        farmId: input.farmId,
        batchId: input.batchId ?? null,
        kind: input.kind,
        foodType: input.foodType ?? null,
        productName: input.productName,
        supplier: input.supplier,
        supplierLotNumber: input.supplierLotNumber,
        expirationDate: input.expirationDate ?? null,
        receivedDate:
          input.receivedDate ?? new Date().toISOString().slice(0, 10),
        quantity: input.quantity,
        unit: input.unit ?? null,
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
