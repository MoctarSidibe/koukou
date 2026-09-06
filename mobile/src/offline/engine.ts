import { ApiError } from '@/api/client';
import {
  createDailyEntry,
  createInput,
  createSale,
  ensureCashOpen,
  recordFeedLoss,
  type CreateInputLotInput,
  type DailyEntryPayload,
  type InvoiceFields,
  type RecordFeedLossInput,
  type SalePayload,
} from '@/api/mutations';

import { enqueueOp, loadOps, removeOp, type OfflineKind, type OfflineOp } from './store';

let counter = 0;

function nextId(kind: OfflineKind): string {
  counter += 1;
  const stamp = Date.now();
  return `off-${kind}-${stamp}-${counter}`;
}

/** Erreur réseau ou serveur indisponible → on met en attente. */
function shouldQueue(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (e instanceof ApiError) return e.status >= 500;
  return false;
}

/** Erreur applicative (4xx) → on abandonne l'opération (donnée invalide). */
function shouldDrop(e: unknown): boolean {
  return e instanceof ApiError && e.status >= 400 && e.status < 500;
}

export type SendResult = { status: 'sent'; reference?: string } | { status: 'queued' };

export async function createDailyEntryQueued(
  farmId: string,
  batchId: string,
  payload: DailyEntryPayload,
): Promise<SendResult> {
  try {
    await createDailyEntry(farmId, batchId, payload);
    void flushQueue();
    return { status: 'sent' };
  } catch (e) {
    if (shouldQueue(e)) {
      enqueueOp({
        id: nextId('daily-entry'),
        kind: 'daily-entry',
        farmId,
        batchId,
        payload,
        createdAt: new Date().toISOString(),
      });
      return { status: 'queued' };
    }
    throw e;
  }
}

export async function createSaleQueued(
  farmId: string,
  saleDate: string,
  items: SalePayload['items'],
  amountFcfa: number,
  invoice?: InvoiceFields,
  pointOfSaleId?: string,
): Promise<SendResult> {
  try {
    await ensureCashOpen(farmId);
    const res = await createSale(farmId, {
      saleDate,
      items,
      payments: [{ method: 'CASH', amountFcfa }],
      ...invoice,
      ...(pointOfSaleId ? { pointOfSaleId } : {}),
    });
    void flushQueue();
    return { status: 'sent', reference: res.sale.referenceNumber };
  } catch (e) {
    if (shouldQueue(e)) {
      const opId = nextId('sale');
      const payload: SalePayload = {
        saleDate,
        items,
        payments: [{ method: 'CASH', amountFcfa, idempotencyKey: opId }],
        ...invoice,
        ...(pointOfSaleId ? { pointOfSaleId } : {}),
      };
      enqueueOp({ id: opId, kind: 'sale', farmId, payload, createdAt: new Date().toISOString() });
      return { status: 'queued' };
    }
    throw e;
  }
}

/** Entrée de provende (nouveau lot HACCP) : mise en file si hors ligne. */
export function createFeedInputQueued(farmId: string, payload: CreateInputLotInput): Promise<SendResult> {
  return createInputQueued(farmId, payload);
}

/** Déclaration de perte de provende (sacs gâtés) : mise en file si hors ligne. */
export function recordStockLossQueued(farmId: string, payload: RecordFeedLossInput): Promise<SendResult> {
  return lossQueued(farmId, payload);
}

async function createInputQueued(farmId: string, payload: CreateInputLotInput): Promise<SendResult> {
  try {
    await createInput(farmId, payload);
    void flushQueue();
    return { status: 'sent' };
  } catch (e) {
    if (shouldQueue(e)) {
      enqueueOp({
        id: nextId('feed-input'),
        kind: 'feed-input',
        farmId,
        payload,
        createdAt: new Date().toISOString(),
      });
      return { status: 'queued' };
    }
    throw e;
  }
}

async function lossQueued(farmId: string, payload: RecordFeedLossInput): Promise<SendResult> {
  try {
    await recordFeedLoss(farmId, payload);
    void flushQueue();
    return { status: 'sent' };
  } catch (e) {
    if (shouldQueue(e)) {
      enqueueOp({
        id: nextId('stock-loss'),
        kind: 'stock-loss',
        farmId,
        payload,
        createdAt: new Date().toISOString(),
      });
      return { status: 'queued' };
    }
    throw e;
  }
}

async function processOne(op: OfflineOp): Promise<'ok' | 'retry' | 'dropped'> {
  try {
    if (op.kind === 'daily-entry') {
      await createDailyEntry(op.farmId, op.batchId ?? '', op.payload as DailyEntryPayload);
    } else if (op.kind === 'feed-input') {
      await createInput(op.farmId, op.payload as CreateInputLotInput);
    } else if (op.kind === 'stock-loss') {
      await recordFeedLoss(op.farmId, op.payload as RecordFeedLossInput);
    } else {
      await ensureCashOpen(op.farmId);
      await createSale(op.farmId, op.payload as SalePayload);
    }
    return 'ok';
  } catch (e) {
    if (shouldDrop(e)) return 'dropped';
    return 'retry';
  }
}

export interface FlushSummary {
  synced: number;
  dropped: number;
  remaining: number;
}

/** Traite la file dans l'ordre (FIFO) ; s'arrête dès qu'un op ne peut pas partir. */
export async function flushQueue(): Promise<FlushSummary> {
  let synced = 0;
  let dropped = 0;
  for (const op of loadOps()) {
    const result = await processOne(op);
    if (result === 'ok') {
      removeOp(op.id);
      synced += 1;
    } else if (result === 'dropped') {
      removeOp(op.id);
      dropped += 1;
    } else {
      break;
    }
  }
  return { synced, dropped, remaining: loadOps().length };
}