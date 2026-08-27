import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { KOUKOU_EVENTS, koukouBus } from '../../common/utils/event-bus.js';
import { RentabiliteService } from './rentabilite.service.js';

/**
 * Abonne le module finance aux événements de cycle de vie des lots
 * (clôture) pour évaluer l'alerte de rentabilité sans couplage circulaire.
 */
@Injectable()
export class FinanceEventsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(FinanceEventsService.name);

  constructor(private readonly rentabiliteService: RentabiliteService) {}

  onApplicationBootstrap() {
    koukouBus.on(KOUKOU_EVENTS.BATCH_CLOSED, this.onBatchClosed);
  }

  onApplicationShutdown() {
    koukouBus.off(KOUKOU_EVENTS.BATCH_CLOSED, this.onBatchClosed);
  }

  private readonly onBatchClosed = ({
    farmId,
    batchId,
  }: {
    farmId: string;
    batchId: string;
  }) => {
    void this.rentabiliteService.evaluateForBatch(farmId, batchId);
  };
}
