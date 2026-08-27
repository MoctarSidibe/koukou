import { EventEmitter } from 'node:events';

export interface BatchClosedEvent {
  farmId: string;
  batchId: string;
}

/**
 * Bus d'événements in-process minimal : permet aux modules de s'abonner à des
 * moments clés sans créer de dépendances circulaires (ex. clôture d'un lot →
 * évaluation du P&L / alertes de rentabilité).
 */
export const KOUKOU_EVENTS = {
  BATCH_CLOSED: 'batch.closed',
} as const;

class KoukouBus extends EventEmitter {}

export const koukouBus = new KoukouBus();
