import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmsModule } from '../farms/farms.module.js';
import { AlertsModule } from '../alerts/alerts.module.js';
import { ReferenceConstantsModule } from '../reference-constants/reference-constants.module.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { InputLot } from '../inputs/entities/input-lot.entity.js';
import { DailyEntry } from '../daily-entries/entities/daily-entry.entity.js';
import { Farm } from '../farms/entities/farm.entity.js';
import { FeedStockController } from './feed-stock.controller.js';
import { FeedStockService } from './feed-stock.service.js';
import { FeedProductsController } from './feed-products.controller.js';
import { FeedProductsService } from './feed-products.service.js';
import { FeedProduct } from './entities/feed-product.entity.js';
import { FeedStockLoss } from './entities/feed-stock-loss.entity.js';
import { FeedStockSale } from './entities/feed-stock-sale.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InputLot,
      DailyEntry,
      FeedStockLoss,
      FeedStockSale,
      FeedProduct,
      Farm,
      ProductionBatch,
    ]),
    FarmsModule,
    AlertsModule,
    ReferenceConstantsModule,
  ],
  controllers: [FeedStockController, FeedProductsController],
  providers: [FeedStockService, FeedProductsService],
  exports: [FeedStockService, FeedProductsService],
})
export class FeedStockModule {}
