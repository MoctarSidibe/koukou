import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BatchesModule } from '../batches/batches.module.js';
import { FarmsModule } from '../farms/farms.module.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { DailyEntriesController } from './daily-entries.controller.js';
import { DailyEntriesService } from './daily-entries.service.js';
import { DailyEntry } from './entities/daily-entry.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyEntry, ProductionBatch]),
    FarmsModule,
    BatchesModule,
  ],
  controllers: [DailyEntriesController],
  providers: [DailyEntriesService],
})
export class DailyEntriesModule {}
