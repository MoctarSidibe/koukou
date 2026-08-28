import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from '../alerts/entities/alert.entity.js';
import { RuleRegistry } from '../alerts/entities/rule-registry.entity.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { Breed } from '../breeds/entities/breed.entity.js';
import { FarmsModule } from '../farms/farms.module.js';
import { Customer } from '../finance/entities/customer.entity.js';
import { Payment } from '../finance/entities/payment.entity.js';
import { PaymentMethodConfig } from '../finance/entities/payment-method.entity.js';
import { Sale } from '../finance/entities/sale.entity.js';
import { SanitaryProtocol } from '../sanitary/entities/sanitary-protocol.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PlatformAdminController } from './platform.controller.js';
import { PlatformService } from './platform.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      ProductionBatch,
      Sale,
      Payment,
      Alert,
      Customer,
      RuleRegistry,
      PaymentMethodConfig,
      Breed,
      SanitaryProtocol,
    ]),
    FarmsModule,
  ],
  controllers: [PlatformAdminController],
  providers: [PlatformService],
})
export class PlatformModule {}
