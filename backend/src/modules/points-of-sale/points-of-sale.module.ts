import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmsModule } from '../farms/farms.module.js';
import { Farm } from '../farms/entities/farm.entity.js';
import { PointOfSale } from './entities/point-of-sale.entity.js';
import { PointsOfSaleService } from './points-of-sale.service.js';
import { PointsOfSaleController } from './points-of-sale.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PointOfSale, Farm]),
    FarmsModule,
  ],
  controllers: [PointsOfSaleController],
  providers: [PointsOfSaleService],
  exports: [PointsOfSaleService],
})
export class PointsOfSaleModule {}