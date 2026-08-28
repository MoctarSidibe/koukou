import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageOpen, Plus } from 'lucide-react';
import { api } from '../api/client';
import type { FeedStockSummary } from '../api/types';
import { useFarm } from '../app/FarmContext';
import { Card, EmptyState, PageHeader, Th, Td } from '../components/ui';
import { classNames, dateFr, num } from '../lib/format';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

export function StockPage() {
  const { farmId } = useFarm();
  const queryClient = useQueryClient();

  const stock = useQuery({
    queryKey: ['feed-stock', farmId],
    queryFn: () => api.get<FeedStockSummary>(`/farms/${farmId}/feed-stock`),
    enabled: !!farmId,
  });

  const addLoss = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post(`/farms/${farmId}/feed-stock/losses`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feed-stock', farmId] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock & inventaire"
        subtitle="Provende par type, lots HACCP et pertes."
      />

      {stock.isLoading ? (
        <div className="text-sm text-slate-500">Chargement…</div>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Stocks par type d'aliment</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Aliment</Th>
                  <Th>Reçu (kg)</Th>
                  <Th>Consommé (kg)</Th>
                  <Th>Pertes (kg)</Th>
                  <Th>Restant (kg)</Th>
                  <Th>Autonomie</Th>
                </tr>
              </thead>
              <tbody>
                {stock.data?.byType.map((t) => (
                  <tr key={t.feedType} className="border-t border-slate-100">
                    <Td className="font-medium">{t.feedType}</Td>
                    <Td>{num(t.receivedKg)}</Td>
                    <Td>{num(t.consumedKg)}</Td>
                    <Td>{num(t.lossKg)}</Td>
                    <Td
                      className={classNames(
                        'font-semibold',
                        t.autonomyDays != null && t.autonomyDays < 3 ? 'text-red-600' : '',
                      )}
                    >
                      {num(t.remainingKg)} kg
                    </Td>
                    <Td>
                      {t.autonomyDays != null ? `${num(t.autonomyDays)} j` : '—'}
                    </Td>
                  </tr>
                ))}
                {!stock.data?.byType.length ? (
                  <tr>
                    <Td className="py-8 text-center text-slate-400">
                      Aucune donnée de stock.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <PackageOpen className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-slate-700">Déclarer une perte (sacs gâtés…)</h2>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            addLoss.mutate({
              type: f.get('unit'),
              quantity: Number(f.get('quantity') ?? 0) || 0,
              reason: f.get('reason'),
            });
            e.currentTarget.reset();
          }}
        >
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Quantité *</span>
            <input name="quantity" type="number" min={0} required step="0.01" className={inputCls} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Unité</span>
            <select name="unit" className={inputCls} defaultValue="SAC">
              <option value="SAC">Sacs</option>
              <option value="KG">Kilogrammes</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Raison</span>
            <select name="reason" className={inputCls} defaultValue="HUMIDITE">
              <option value="HUMIDITE">Humidité</option>
              <option value="RONGEURS">Rongeurs</option>
              <option value="AUTRE">Autre</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={addLoss.isPending}
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Déclarer
            </button>
          </div>
        </form>
        {addLoss.isError ? (
          <p className="mt-3 text-sm text-red-600">{(addLoss.error as Error).message}</p>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Lots d'aliment (HACCP)</h2>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Fournisseur</Th>
                  <Th>N° lot</Th>
                  <Th>Restant (kg)</Th>
                  <Th>Péremption</Th>
                </tr>
              </thead>
              <tbody>
                {(stock.data?.lots ?? []).map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <Td className="font-medium">{l.supplierName ?? '—'}</Td>
                    <Td>{l.lotNumber ?? '—'}</Td>
                    <Td>{num(l.currentStockKg)}</Td>
                    <Td>{l.expiryDate ? dateFr(l.expiryDate) : '—'}</Td>
                  </tr>
                ))}
                {!stock.data?.lots.length ? (
                  <tr>
                    <Td className="py-6 text-center text-slate-400">Aucun lot.</Td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Pertes déclarées</h2>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Date</Th>
                  <Th>Raison</Th>
                  <Th>Quantité</Th>
                </tr>
              </thead>
              <tbody>
                {(stock.data?.losses ?? []).map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <Td>{dateFr(l.createdAt)}</Td>
                    <Td>{l.reason}</Td>
                    <Td>{num(l.quantityKg)} kg</Td>
                  </tr>
                ))}
                {!stock.data?.losses.length ? (
                  <tr>
                    <Td className="py-6 text-center text-slate-400">
                      <EmptyState message="Aucune perte déclarée." />
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}