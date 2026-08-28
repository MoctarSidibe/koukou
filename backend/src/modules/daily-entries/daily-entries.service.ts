import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { FeedUnit } from '../../common/enums/food-type.enum.js';
import { InputKind } from '../../common/enums/input-kind.enum.js';
import { BatchStatus } from '../../common/enums/batch-type.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { FlockReconciliationService } from '../batches/flock-reconciliation.service.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { InputLot } from '../inputs/entities/input-lot.entity.js';
import { koukouBus, KOUKOU_EVENTS } from '../../common/utils/event-bus.js';
import { DailyEntry } from './entities/daily-entry.entity.js';
import { CreateDailyEntryDto } from './dto/create-daily-entry.dto.js';

@Injectable()
export class DailyEntriesService {
  constructor(
    @InjectRepository(DailyEntry)
    private readonly entryRepo: Repository<DailyEntry>,
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    @InjectRepository(InputLot)
    private readonly inputRepo: Repository<InputLot>,
    private readonly farmsService: FarmsService,
    private readonly flockReconciliation: FlockReconciliationService,
    private readonly dataSource: DataSource,
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

    if (batch.status === BatchStatus.CLOTURE) {
      throw new BadRequestException(
        'Lot clôturé : impossible d’ajouter une saisie (immuabilité).',
      );
    }

    if (dto.inputLotId != null) {
      const lot = await this.inputRepo.findOne({
        where: { id: dto.inputLotId, farmId },
      });
      if (!lot || lot.kind !== InputKind.ALIMENT) {
        throw new BadRequestException(
          'Lot d’intrant alimentaire introuvable dans cette ferme (catégorie ALIMENT uniquement).',
        );
      }
    }

    return this.dataSource.transaction(async (em) => {
      const entryRepo = em.getRepository(DailyEntry);
      const existing = await entryRepo.findOne({
        where: { batchId, entryDate: dto.entryDate },
      });

      // Seuls les champs réellement fournis sont appliqués (l'upsert ne doit pas
      // écraser les saisies du jour quand on ne met à jour qu'un seul champ).
      const data: Partial<DailyEntry> = {
        batchId,
        entryDate: dto.entryDate,
        createdById: user.id,
      };
      if (dto.deaths !== undefined) data.deaths = dto.deaths;
      if (dto.feedQuantity !== undefined || dto.feedBags !== undefined) {
        data.feedQuantity = this.toKg(dto, batch);
      }
      if (dto.feedUnit !== undefined) data.feedUnit = dto.feedUnit ?? null;
      if (dto.feedType !== undefined) data.feedType = dto.feedType ?? null;
      if (dto.inputLotId !== undefined)
        data.inputLotId = dto.inputLotId ?? null;
      if (dto.waterL !== undefined) data.waterL = dto.waterL;
      if (dto.avgWeightKg !== undefined)
        data.avgWeightKg = dto.avgWeightKg ?? null;
      if (dto.eggsCollected !== undefined)
        data.eggsCollected = dto.eggsCollected;
      if (dto.eggsSellable !== undefined) data.eggsSellable = dto.eggsSellable;
      if (dto.eggsCracked !== undefined) data.eggsCracked = dto.eggsCracked;
      if (dto.eggsSmall !== undefined) data.eggsSmall = dto.eggsSmall;
      if (dto.source !== undefined) data.source = dto.source;

      const entry = existing
        ? entryRepo.merge(existing, data)
        : entryRepo.create(data);
      await entryRepo.save(entry);
      await this.recomputeLiveCount(em, batch.id);
      return entry;
    }).then((entry) => {
      koukouBus.emit(KOUKOU_EVENTS.DAILY_ENTRY_CREATED, {
        farmId,
        batchId,
        entryDate: dto.entryDate,
      });
      return entry;
    });
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

  /**
   * Recalcule le cheptel vivant comme source de vérité :
   * arrivés − morts − oiseaux vendus (ventes non annulées) − oiseaux abattus.
   * Verrou pessimiste (dans la transaction) pour rester en phase avec les
   * décréments du POS.
   */
  private async recomputeLiveCount(em: EntityManager, batchId: string) {
    // Verrou pessimiste acquis AVANT toute lecture des flux de sortie : toute
    // vente/abattage concurrent sérialise sur la même ligne et son impact est
    // visible/après notre lecture (pas de course lecture/écriture).
    const locked = await em
      .getRepository(ProductionBatch)
      .createQueryBuilder('batch')
      .setLock('pessimistic_write')
      .where('batch.id = :id', { id: batchId })
      .getOne();
    if (!locked) return;

    const rows = await em
      .getRepository(DailyEntry)
      .find({ where: { batchId } });
    const totalDeaths = rows.reduce((s, e) => s + e.deaths, 0);
    const [soldBirds, slaughteredBirds] = await Promise.all([
      this.flockReconciliation.netSoldBirds(batchId, em),
      this.flockReconciliation.netSlaughteredBirds(batchId, em),
    ]);
    locked.quantityAlive = Math.max(
      0,
      locked.quantityAtStart - totalDeaths - soldBirds - slaughteredBirds,
    );
    await em.getRepository(ProductionBatch).save(locked);
  }
}
