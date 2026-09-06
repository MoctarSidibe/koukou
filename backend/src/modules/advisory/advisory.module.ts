import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmsModule } from '../farms/farms.module.js';
import { FeedStockModule } from '../feed-stock/feed-stock.module.js';
import { ReferenceConstantsModule } from '../reference-constants/reference-constants.module.js';
import { BatchesModule } from '../batches/batches.module.js';
import { Alert } from '../alerts/entities/alert.entity.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { Building } from '../buildings/entities/building.entity.js';
import { DailyEntry } from '../daily-entries/entities/daily-entry.entity.js';
import { ProphylaxisEvent } from '../sanitary/entities/prophylaxis-event.entity.js';
import { AdvisoryController } from './advisory.controller.js';
import { AdvisoryService } from './advisory.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Alert,
      ProductionBatch,
      DailyEntry,
      ProphylaxisEvent,
      Building,
    ]),
    FarmsModule,
    FeedStockModule,
    ReferenceConstantsModule,
    BatchesModule,
  ],
  controllers: [AdvisoryController],
  providers: [AdvisoryService],
  exports: [AdvisoryService],
})
export class AdvisoryModule {}