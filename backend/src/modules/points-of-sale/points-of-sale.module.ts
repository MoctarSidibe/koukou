import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmsModule } from '../farms/farms.module.js';
import { Farm } from '../farms/entities/farm.entity.js';
import { SlaughterOrder } from '../slaughter/entities/slaughter-order.entity.js';
import { CarcassTransfersService } from './carcass-transfers.service.js';
import { CarcassTransfersController } from './carcass-transfers.controller.js';
import { CarcassTransfer } from './entities/carcass-transfer.entity.js';
import { PointOfSale } from './entities/point-of-sale.entity.js';
import { PointsOfSaleService } from './points-of-sale.service.js';
import { PointsOfSaleController } from './points-of-sale.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PointOfSale, Farm, SlaughterOrder, CarcassTransfer]),
    FarmsModule,
  ],
  controllers: [PointsOfSaleController, CarcassTransfersController],
  providers: [PointsOfSaleService, CarcassTransfersService],
  exports: [PointsOfSaleService],
})
export class PointsOfSaleModule {}