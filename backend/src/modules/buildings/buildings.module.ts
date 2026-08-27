import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsModule } from '../alerts/alerts.module.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { FarmsModule } from '../farms/farms.module.js';
import { BuildingsController } from './buildings.controller.js';
import { BuildingsService } from './buildings.service.js';
import { Building } from './entities/building.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Building, ProductionBatch]),
    FarmsModule,
    AlertsModule,
  ],
  controllers: [BuildingsController],
  providers: [BuildingsService],
  exports: [BuildingsService, TypeOrmModule],
})
export class BuildingsModule {}
