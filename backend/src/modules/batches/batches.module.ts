import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsModule } from '../alerts/alerts.module.js';
import { BreedsModule } from '../breeds/breeds.module.js';
import { DailyEntry } from '../daily-entries/entities/daily-entry.entity.js';
import { FarmsModule } from '../farms/farms.module.js';
import { Farm } from '../farms/entities/farm.entity.js';
import { InputLot } from '../inputs/entities/input-lot.entity.js';
import { ReferenceConstantsModule } from '../reference-constants/reference-constants.module.js';
import { AdvisoryEngine } from './advisory.engine.js';
import { BatchesController } from './batches.controller.js';
import { BatchesService } from './batches.service.js';
import { ProductionBatch } from './entities/production-batch.entity.js';
import { TypeHistoryEntry } from './entities/type-history-entry.entity.js';
import { MetricsService } from './metrics.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionBatch,
      TypeHistoryEntry,
      DailyEntry,
      InputLot,
      Farm,
    ]),
    FarmsModule,
    BreedsModule,
    AlertsModule,
    ReferenceConstantsModule,
  ],
  controllers: [BatchesController],
  providers: [BatchesService, MetricsService, AdvisoryEngine],
  exports: [MetricsService, BatchesService],
})
export class BatchesModule {}
