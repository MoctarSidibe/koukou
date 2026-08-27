import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmsModule } from '../farms/farms.module.js';
import { AlertsModule } from '../alerts/alerts.module.js';
import { ReferenceConstantsModule } from '../reference-constants/reference-constants.module.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { InputLot } from '../inputs/entities/input-lot.entity.js';
import { SanitaryController } from './sanitary.controller.js';
import { SanitaryProtocolsController } from './sanitary-protocols.controller.js';
import { SanitaryService } from './sanitary.service.js';
import { SanitaryProtocol } from './entities/sanitary-protocol.entity.js';
import { ProtocolStep } from './entities/protocol-step.entity.js';
import { ProphylaxisEvent } from './entities/prophylaxis-event.entity.js';
import { TreatmentRecord } from './entities/treatment-record.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SanitaryProtocol,
      ProtocolStep,
      ProphylaxisEvent,
      TreatmentRecord,
      ProductionBatch,
      InputLot,
    ]),
    FarmsModule,
    AlertsModule,
    ReferenceConstantsModule,
  ],
  controllers: [SanitaryController, SanitaryProtocolsController],
  providers: [SanitaryService],
  exports: [SanitaryService],
})
export class SanitaryModule {}
