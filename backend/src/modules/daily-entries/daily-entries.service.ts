import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { FeedUnit } from '../../common/enums/food-type.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { DailyEntry } from './entities/daily-entry.entity.js';
import { CreateDailyEntryDto } from './dto/create-daily-entry.dto.js';

@Injectable()
export class DailyEntriesService {
  constructor(
    @InjectRepository(DailyEntry)
    private readonly entryRepo: Repository<DailyEntry>,
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    private readonly farmsService: FarmsService,
  ) {}

  async create(
    user: AuthUser,
    farmId: string,
    batchId: string,
    dto: CreateDailyEntryDto,
  ) {
    await this.farmsService.assertAccessible(user, farmId);
    const batch = await this.batchRepo.findOne({
      where: { id: batchId, farmId },
    });
    if (!batch)
      throw new NotFoundException('Lot introuvable dans cette ferme.');

    const feedKg = this.toKg(dto, batch);
    const existing = await this.entryRepo.findOne({
      where: { batchId, entryDate: dto.entryDate },
    });

    const data = {
      batchId,
      entryDate: dto.entryDate,
      deaths: dto.deaths ?? 0,
      feedQuantity: feedKg,
      feedUnit: dto.feedUnit ?? null,
      feedType: dto.feedType ?? null,
      inputLotId: dto.inputLotId ?? null,
      waterL: dto.waterL ?? 0,
      avgWeightKg: dto.avgWeightKg ?? null,
      eggsCollected: dto.eggsCollected ?? 0,
      eggsSellable: dto.eggsSellable ?? 0,
      eggsCracked: dto.eggsCracked ?? 0,
      eggsSmall: dto.eggsSmall ?? 0,
      createdById: user.id,
    };

    const entry = existing
      ? this.entryRepo.merge(existing, data)
      : this.entryRepo.create(data);
    await this.entryRepo.save(entry);
    await this.recomputeLiveCount(batch);
    return entry;
  }

  async listForBatch(user: AuthUser, farmId: string, batchId: string) {
    await this.farmsService.assertAccessible(user, farmId);
    return this.entryRepo.find({
      where: { batchId },
      order: { entryDate: 'ASC' },
    });
  }

  private toKg(dto: CreateDailyEntryDto, batch: ProductionBatch): number {
    const qty = dto.feedQuantity ?? dto.feedBags ?? 0;
    if (dto.feedUnit === FeedUnit.KG) {
      return qty;
    }
    const sacKg = batch.feedUnitSacKg ?? 50;
    const bags = dto.feedBags ?? qty;
    return bags * sacKg;
  }

  private async recomputeLiveCount(batch: ProductionBatch) {
    const rows = await this.entryRepo.find({ where: { batchId: batch.id } });
    const totalDeaths = rows.reduce((s, e) => s + e.deaths, 0);
    batch.quantityAlive = Math.max(0, batch.quantityAtStart - totalDeaths);
    await this.batchRepo.save(batch);
  }
}
