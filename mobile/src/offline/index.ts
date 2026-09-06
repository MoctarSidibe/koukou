import { useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { invalidateFarmQueries } from '@/api/invalidate';
import type { DailyEntryPayload, InvoiceFields, SaleItemPayload } from '@/api/mutations';

import {
  createDailyEntryQueued,
  createFeedInputQueued,
  createSaleQueued,
  flushQueue,
  recordStockLossQueued,
  type FlushSummary,
  type SendResult,
} from './engine';
import { clearQueue, getQueueVersion, loadOps, subscribeQueue, type OfflineOp } from './store';

export { clearQueue, flushQueue };
export type { FlushSummary, OfflineOp, SendResult };

export { createDailyEntryQueued, createFeedInputQueued, createSaleQueued, recordStockLossQueued };

export interface OfflineQueueState {
  pending: OfflineOp[];
  syncing: boolean;
  last: FlushSummary | null;
  flush: () => Promise<void>;
}

export function useOfflineQueue(farmId: string): OfflineQueueState {
  useSyncExternalStore(subscribeQueue, getQueueVersion, getQueueVersion);
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [last, setLast] = useState<FlushSummary | null>(null);
  const pending = loadOps();

  const flush = async () => {
    setSyncing(true);
    try {
      const summary = await flushQueue();
      setLast(summary);
      if (summary.synced > 0) invalidateFarmQueries(queryClient, { farmId });
    } finally {
      setSyncing(false);
    }
  };

  return { pending, syncing, last, flush };
}

export function queueDailyEntry(farmId: string, batchId: string, payload: DailyEntryPayload): Promise<SendResult> {
  return createDailyEntryQueued(farmId, batchId, payload);
}

export function queueSale(
  farmId: string,
  saleDate: string,
  items: SaleItemPayload[],
  amountFcfa: number,
  invoice?: InvoiceFields,
  pointOfSaleId?: string,
): Promise<SendResult> {
  return createSaleQueued(farmId, saleDate, items, amountFcfa, invoice, pointOfSaleId);
}