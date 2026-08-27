import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { BatchStatus } from '../../common/enums/batch-type.enum.js';
import { Species } from '../../common/enums/species.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { BreedsService } from '../breeds/breeds.service.js';
import { Building } from '../buildings/entities/building.entity.js';
import { ProductionBatch } from './entities/production-batch.entity.js';
import { TypeHistoryEntry } from './entities/type-history-entry.entity.js';
import { CreateBatchDto } from './dto/create-batch.dto.js';
import { ChangeTypeDto } from './dto/change-type.dto.js';
import { UpdateBatchDto } from './dto/update-batch.dto.js';
import { MetricsService } from './metrics.service.js';
import { AdvisoryEngine } from './advisory.engine.js';

@Injectable()
export class BatchesService {
  constructor(
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
    @InjectRepository(TypeHistoryEntry)
    private readonly historyRepo: Repository<TypeHistoryEntry>,
    private readonly farmsService: FarmsService,
    private readonly breedsService: BreedsService,
    private readonly metricsService: MetricsService,
    private readonly advisoryEngine: AdvisoryEngine,
  ) {}

  async create(
    user: AuthUser,
    farmId: string,
    dto: CreateBatchDto,
  ): Promise<BatchWithMetrics> {
    const farm = await this.farmsService.assertAccessible(user, farmId);
    let breedId: string | null = null;
    if (dto.breedId) {
      const breed = await this.breedsService.findById(dto.breedId);
      if (!breed) throw new BadRequestException('Souche introuvable.');
      breedId = breed.id;
    }
    let buildingId: string | null = null;
    let buildingArea = dto.buildingAreaM2 ?? farm.buildingAreaM2 ?? null;
    if (dto.buildingId) {
      const building = await this.buildingRepo.findOne({
        where: { id: dto.buildingId, farmId },
      });
      if (!building)
        throw new BadRequestException('Bâtiment introuvable dans cette ferme.');
      buildingId = building.id;
      if (building.buildingAreaM2 != null)
        buildingArea = building.buildingAreaM2;
    }
    const batch = this.batchRepo.create({
      farmId,
      breedId,
      buildingId,
      batchName: dto.batchName,
      integrationDate: dto.integrationDate,
      quantityAtStart: dto.quantityAtStart,
      quantityAlive: dto.quantityAtStart,
      type: dto.type,
      species: dto.species ?? Species.POULET,
      status: BatchStatus.ACTIF,
      buildingAreaM2: buildingArea,
      feedUnitSacKg: dto.feedUnitSacKg ?? farm.defaultSacKg,
      couvoirSupplier: dto.couvoirSupplier ?? null,
      chickLotNumber: dto.chickLotNumber ?? null,
      hatchDate: dto.hatchDate ?? null,
    });
    await this.batchRepo.save(batch);
    await this.afterChange(user, farmId, batch);
    return this.findOne(user, farmId, batch.id);
  }

  async update(
    user: AuthUser,
    farmId: string,
    batchId: string,
    dto: UpdateBatchDto,
  ): Promise<BatchWithMetrics> {
    await this.farmsService.assertAccessible(user, farmId);
    const batch = await this.batchRepo.findOne({
      where: { id: batchId, farmId },
    });
    if (!batch)
      throw new NotFoundException('Lot introuvable dans cette ferme.');
    const prevBuildingId = batch.buildingId;
    if (dto.batchName !== undefined) batch.batchName = dto.batchName ?? null;
    if (dto.couvoirSupplier !== undefined)
      batch.couvoirSupplier = dto.couvoirSupplier ?? null;
    if (dto.chickLotNumber !== undefined)
      batch.chickLotNumber = dto.chickLotNumber ?? null;
    if (dto.hatchDate !== undefined) batch.hatchDate = dto.hatchDate ?? null;
    if (dto.buildingAreaM2 !== undefined)
      batch.buildingAreaM2 = dto.buildingAreaM2 ?? null;
    if (dto.feedUnitSacKg !== undefined)
      batch.feedUnitSacKg = dto.feedUnitSacKg ?? null;
    if (dto.species !== undefined && dto.species !== null)
      batch.species = dto.species;
    if (dto.buildingId !== undefined) {
      if (dto.buildingId) {
        const building = await this.buildingRepo.findOne({
          where: { id: dto.buildingId, farmId },
        });
        if (!building)
          throw new BadRequestException(
            'Bâtiment introuvable dans cette ferme.',
          );
        batch.buildingId = building.id;
        if (building.buildingAreaM2 != null)
          batch.buildingAreaM2 = building.buildingAreaM2;
      } else {
        batch.buildingId = null;
      }
    }
    await this.batchRepo.save(batch);
    await this.afterChange(user, farmId, batch);
    if (prevBuildingId && prevBuildingId !== batch.buildingId) {
      await this.advisoryEngine.clearBuildingAlerts(farmId, prevBuildingId);
    }
    return this.findOne(user, farmId, batchId);
  }

  async findAll(user: AuthUser, farmId: string): Promise<BatchWithMetrics[]> {
    await this.farmsService.assertAccessible(user, farmId);
    const batches = await this.batchRepo.find({
      where: { farmId },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(batches.map((b) => this.withMetrics(b)));
  }

  async findOne(
    user: AuthUser,
    farmId: string,
    batchId: string,
  ): Promise<BatchWithMetrics> {
    await this.farmsService.assertAccessible(user, farmId);
    const batch = await this.batchRepo.findOne({
      where: { id: batchId, farmId },
    });
    if (!batch)
      throw new NotFoundException('Lot introuvable dans cette ferme.');
    return this.withMetrics(batch);
  }

  async changeType(
    user: AuthUser,
    farmId: string,
    batchId: string,
    dto: ChangeTypeDto,
  ): Promise<BatchWithMetrics> {
    await this.farmsService.assertAccessible(user, farmId);
    const batch = await this.batchRepo.findOne({
      where: { id: batchId, farmId },
    });
    if (!batch)
      throw new NotFoundException('Lot introuvable dans cette ferme.');

    if (batch.type !== dto.toType) {
      await this.historyRepo.save(
        this.historyRepo.create({
          batchId,
          fromType: batch.type,
          toType: dto.toType,
          changedOn: dto.changedOn,
          reason: dto.reason ?? null,
        }),
      );
      batch.type = dto.toType;
      await this.batchRepo.save(batch);
    }
    await this.afterChange(user, farmId, batch);
    return this.findOne(user, farmId, batchId);
  }

  async enterSale(user: AuthUser, farmId: string, batchId: string) {
    await this.farmsService.assertAccessible(user, farmId);
    const batch = await this.batchRepo.findOne({
      where: { id: batchId, farmId },
    });
    if (!batch)
      throw new NotFoundException('Lot introuvable dans cette ferme.');
    batch.status = BatchStatus.EN_VENTE;
    await this.batchRepo.save(batch);
    await this.afterChange(user, farmId, batch);
    return this.findOne(user, farmId, batchId);
  }

  async close(user: AuthUser, farmId: string, batchId: string) {
    await this.farmsService.assertAccessible(user, farmId);
    const batch = await this.batchRepo.findOne({
      where: { id: batchId, farmId },
    });
    if (!batch)
      throw new NotFoundException('Lot introuvable dans cette ferme.');
    batch.status = BatchStatus.CLOTURE;
    await this.batchRepo.save(batch);
    await this.afterChange(user, farmId, batch);
    return this.findOne(user, farmId, batchId);
  }

  private async afterChange(
    _user: AuthUser,
    _farmId: string,
    batch: ProductionBatch,
  ) {
    const metrics = await this.metricsService.compute(batch);
    await this.advisoryEngine.runForBatch(batch, metrics);
  }

  async runAdvisoryForBatch(batchId: string) {
    const batch = await this.batchRepo.findOne({ where: { id: batchId } });
    if (!batch) return;
    const metrics = await this.metricsService.compute(batch);
    await this.advisoryEngine.runForBatch(batch, metrics);
  }

  private async withMetrics(batch: ProductionBatch): Promise<BatchWithMetrics> {
    const metrics = await this.metricsService.compute(batch);
    return { ...batch, metrics };
  }
}

export type BatchWithMetrics = ProductionBatch & {
  metrics: import('./models/batch-metrics.model.js').BatchMetrics;
};
