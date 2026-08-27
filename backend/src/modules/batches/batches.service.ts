import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { BatchStatus } from '../../common/enums/batch-type.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { BreedsService } from '../breeds/breeds.service.js';
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
    const batch = this.batchRepo.create({
      farmId,
      breedId,
      batchName: dto.batchName,
      integrationDate: dto.integrationDate,
      quantityAtStart: dto.quantityAtStart,
      quantityAlive: dto.quantityAtStart,
      type: dto.type,
      status: BatchStatus.ACTIF,
      buildingAreaM2: dto.buildingAreaM2 ?? farm.buildingAreaM2 ?? null,
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
    const batch = await this.batchRepo.findOne({ where: { id: batchId, farmId } });
    if (!batch) throw new NotFoundException('Lot introuvable dans cette ferme.');
    if (dto.batchName !== undefined) batch.batchName = dto.batchName ?? null;
    if (dto.couvoirSupplier !== undefined) batch.couvoirSupplier = dto.couvoirSupplier ?? null;
    if (dto.chickLotNumber !== undefined) batch.chickLotNumber = dto.chickLotNumber ?? null;
    if (dto.hatchDate !== undefined) batch.hatchDate = dto.hatchDate ?? null;
    if (dto.buildingAreaM2 !== undefined) batch.buildingAreaM2 = dto.buildingAreaM2 ?? null;
    if (dto.feedUnitSacKg !== undefined) batch.feedUnitSacKg = dto.feedUnitSacKg ?? null;
    await this.batchRepo.save(batch);
    await this.afterChange(user, farmId, batch);
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
    if (!batch) throw new NotFoundException('Lot introuvable dans cette ferme.');
    return this.withMetrics(batch);
  }

  async changeType(
    user: AuthUser,
    farmId: string,
    batchId: string,
    dto: ChangeTypeDto,
  ): Promise<BatchWithMetrics> {
    await this.farmsService.assertAccessible(user, farmId);
    const batch = await this.batchRepo.findOne({ where: { id: batchId, farmId } });
    if (!batch) throw new NotFoundException('Lot introuvable dans cette ferme.');

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
    const batch = await this.batchRepo.findOne({ where: { id: batchId, farmId } });
    if (!batch) throw new NotFoundException('Lot introuvable dans cette ferme.');
    this.requireTraceability(batch);
    batch.status = BatchStatus.EN_VENTE;
    await this.batchRepo.save(batch);
    await this.afterChange(user, farmId, batch);
    return this.findOne(user, farmId, batchId);
  }

  async close(user: AuthUser, farmId: string, batchId: string) {
    await this.farmsService.assertAccessible(user, farmId);
    const batch = await this.batchRepo.findOne({ where: { id: batchId, farmId } });
    if (!batch) throw new NotFoundException('Lot introuvable dans cette ferme.');
    this.requireTraceability(batch);
    batch.status = BatchStatus.CLOTURE;
    await this.batchRepo.save(batch);
    return this.findOne(user, farmId, batchId);
  }

  private requireTraceability(batch: ProductionBatch) {
    if (!batch.couvoirSupplier || !batch.chickLotNumber || !batch.hatchDate) {
      throw new BadRequestException(
        'Traçabilité HACCP incomplète : veuillez renseigner la provenance des poussins (couvoir, n° de lot, date d’éclosion) avant la vente.',
      );
    }
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
