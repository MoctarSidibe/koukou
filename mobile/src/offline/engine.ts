import { ApiError } from '@/api/client';
import {
  cancelOrder,
  createDailyEntry,
  createInput,
  createOrder,
  createPointOfSale,
  createSale,
  deletePointOfSale,
  deliverOrder,
  ensureCashOpen,
  recordFeedLoss,
  recordOrderPayment,
  updatePointOfSale,
  type CreateInputLotInput,
  type CreateOrderInput,
  type DailyEntryPayload,
  type InvoiceFields,
  type PointOfSaleInput,
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

// ── Commandes (acompte / livraison / annulation) ─────────────

/** Création de commande (bon de commande) : mise en file si hors ligne.
 *  Une même clé d'idempotence (op.id) est envoyée en direct puis au rejeu :
 *  un envoi parti mais non confirmé ne duplique jamais la commande. */
export async function createOrderQueued(
  farmId: string,
  input: CreateOrderInput,
): Promise<SendResult> {
  const opId = nextId('order-create');
  const payload: CreateOrderInput = {
    ...input,
    idempotencyKey: input.idempotencyKey ?? opId,
  };
  try {
    await createOrder(farmId, payload);
    void flushQueue();
    return { status: 'sent' };
  } catch (e) {
    if (shouldQueue(e)) {
      enqueueOp({
        id: opId,
        kind: 'order-create',
        farmId,
        payload,
        createdAt: new Date().toISOString(),
      });
      return { status: 'queued' };
    }
    throw e;
  }
}

/** Acompte sur commande : mis en file si hors ligne (idempotence via idempotencyKey). */
export async function recordOrderPaymentQueued(
  farmId: string,
  orderId: string,
  amountFcfa: number,
): Promise<SendResult> {
  try {
    await ensureCashOpen(farmId);
    await recordOrderPayment(farmId, orderId, amountFcfa);
    void flushQueue();
    return { status: 'sent' };
  } catch (e) {
    if (shouldQueue(e)) {
      const opId = nextId('order-payment');
      enqueueOp({
        id: opId,
        kind: 'order-payment',
        farmId,
        payload: { orderId, amountFcfa, idempotencyKey: opId },
        createdAt: new Date().toISOString(),
      });
      return { status: 'queued' };
    }
    throw e;
  }
}

/** Livraison de commande : mise en file si hors ligne (rejouée à la connexion). */
export async function deliverOrderQueued(farmId: string, orderId: string): Promise<SendResult> {
  try {
    await deliverOrder(farmId, orderId);
    void flushQueue();
    return { status: 'sent' };
  } catch (e) {
    if (shouldQueue(e)) {
      enqueueOp({
        id: nextId('order-deliver'),
        kind: 'order-deliver',
        farmId,
        payload: { orderId },
        createdAt: new Date().toISOString(),
      });
      return { status: 'queued' };
    }
    throw e;
  }
}

/** Annulation de commande : mise en file si hors ligne. */
export async function cancelOrderQueued(farmId: string, orderId: string, reason: string): Promise<SendResult> {
  try {
    await cancelOrder(farmId, orderId, reason);
    void flushQueue();
    return { status: 'sent' };
  } catch (e) {
    if (shouldQueue(e)) {
      enqueueOp({
        id: nextId('order-cancel'),
        kind: 'order-cancel',
        farmId,
        payload: { orderId, reason },
        createdAt: new Date().toISOString(),
      });
      return { status: 'queued' };
    }
    throw e;
  }
}

// ── Points de vente (configuration) ──────────────────────────

export async function createPointOfSaleQueued(farmId: string, input: PointOfSaleInput): Promise<SendResult> {
  try {
    await createPointOfSale(farmId, input);
    void flushQueue();
    return { status: 'sent' };
  } catch (e) {
    if (shouldQueue(e)) {
      enqueueOp({
        id: nextId('pdv-create'),
        kind: 'pdv-create',
        farmId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return { status: 'queued' };
    }
    throw e;
  }
}

export async function updatePointOfSaleQueued(
  farmId: string,
  pointOfSaleId: string,
  input: Partial<PointOfSaleInput>,
): Promise<SendResult> {
  try {
    await updatePointOfSale(farmId, pointOfSaleId, input);
    void flushQueue();
    return { status: 'sent' };
  } catch (e) {
    if (shouldQueue(e)) {
      enqueueOp({
        id: nextId('pdv-update'),
        kind: 'pdv-update',
        farmId,
        payload: { pointOfSaleId, input },
        createdAt: new Date().toISOString(),
      });
      return { status: 'queued' };
    }
    throw e;
  }
}

export async function deletePointOfSaleQueued(farmId: string, pointOfSaleId: string): Promise<SendResult> {
  try {
    await deletePointOfSale(farmId, pointOfSaleId);
    void flushQueue();
    return { status: 'sent' };
  } catch (e) {
    if (shouldQueue(e)) {
      enqueueOp({
        id: nextId('pdv-delete'),
        kind: 'pdv-delete',
        farmId,
        payload: { pointOfSaleId },
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
    } else if (op.kind === 'order-create') {
      await createOrder(op.farmId, op.payload as CreateOrderInput);
    } else if (op.kind === 'order-payment') {
      const p = op.payload as { orderId: string; amountFcfa: number; idempotencyKey?: string };
      await ensureCashOpen(op.farmId);
      await recordOrderPayment(op.farmId, p.orderId, p.amountFcfa, { idempotencyKey: p.idempotencyKey });
    } else if (op.kind === 'order-deliver') {
      await deliverOrder(op.farmId, (op.payload as { orderId: string }).orderId);
    } else if (op.kind === 'order-cancel') {
      const p = op.payload as { orderId: string; reason: string };
      await cancelOrder(op.farmId, p.orderId, p.reason);
    } else if (op.kind === 'pdv-create') {
      await createPointOfSale(op.farmId, op.payload as PointOfSaleInput);
    } else if (op.kind === 'pdv-update') {
      const p = op.payload as { pointOfSaleId: string; input: Partial<PointOfSaleInput> };
      await updatePointOfSale(op.farmId, p.pointOfSaleId, p.input);
    } else if (op.kind === 'pdv-delete') {
      await deletePointOfSale(op.farmId, (op.payload as { pointOfSaleId: string }).pointOfSaleId);
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