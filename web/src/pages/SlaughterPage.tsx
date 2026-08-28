import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileOutput, Scissors } from 'lucide-react';
import { api } from '../api/client';
import type { BatchWithMetrics, SlaughterOrder } from '../api/types';
import { useFarm } from '../app/FarmContext';
import { Card, EmptyState, PageHeader, StatusBadge, Th, Td } from '../components/ui';
import { dateFr, num } from '../lib/format';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

const todayIso = () => new Date().toISOString().slice(0, 10);

export function SlaughterPage() {
  const { farmId } = useFarm();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const orders = useQuery({
    queryKey: ['slaughter', farmId],
    queryFn: () => api.get<SlaughterOrder[]>(`/farms/${farmId}/slaughter-orders`),
    enabled: !!farmId,
  });

  const batches = useQuery({
    queryKey: ['batches', farmId],
    queryFn: () => api.get<BatchWithMetrics[]>(`/farms/${farmId}/batches`),
    enabled: !!farmId,
  });
  const activeBatches = (batches.data ?? []).filter((b) => b.status !== 'CLOTURE');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['slaughter', farmId] });
    void queryClient.invalidateQueries({ queryKey: ['batches', farmId] });
  };

  const createOrder = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<SlaughterOrder>(`/farms/${farmId}/slaughter-orders`, body),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
  });

  const send = useMutation({
    mutationFn: (id: string) =>
      api.post(`/farms/${farmId}/slaughter-orders/${id}/send`),
    onSuccess: invalidate,
  });

  const process = useMutation({
    mutationFn: (id: string) =>
      api.post<SlaughterOrder>(`/farms/${farmId}/slaughter-orders/${id}/process`),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      api.post(`/farms/${farmId}/slaughter-orders/${id}/cancel`, {
        reason: 'Annulé depuis le web',
      }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abattage & traçabilité"
        subtitle="Ordres d'abattage, bordereaux PDF et passeports sanitaires."
        actions={
          !creating ? (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              <Scissors className="h-4 w-4" /> Nouvel ordre
            </button>
          ) : null
        }
      />

      {creating ? (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Créer un ordre d'abattage</h2>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              createOrder.mutate({
                batchId: String(f.get('batchId')),
                slaughterType: f.get('slaughterType'),
                destination: f.get('destination'),
                plannedDate: String(f.get('plannedDate')),
                birdCount: Number(f.get('birdCount')),
                totalWeightKg: f.get('totalWeightKg') ? Number(f.get('totalWeightKg')) : undefined,
              });
            }}
          >
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Lot *</span>
              <select name="batchId" required className={inputCls}>
                <option value="">— Choisir —</option>
                {activeBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchName ?? b.id.slice(0, 8)} — {num(b.metrics.liveCount)} vivants
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Type</span>
              <select name="slaughterType" className={inputCls} defaultValue="VIVANT">
                <option value="VIVANT">Vivant</option>
                <option value="ABATTU">Abattu</option>
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Destination</span>
              <select name="destination" className={inputCls} defaultValue="INTERNE">
                <option value="INTERNE">Interne (abattoir ferme)</option>
                <option value="EXTERNE">Externe (abattoir partenaire)</option>
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Date prévue *</span>
              <input name="plannedDate" type="date" required defaultValue={todayIso()} className={inputCls} />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Oiseaux *</span>
              <input name="birdCount" type="number" min={1} required className={inputCls} />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Poids total (kg)</span>
              <input name="totalWeightKg" type="number" min={0} step="0.1" className={inputCls} />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={createOrder.isPending}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {createOrder.isPending ? 'Création…' : "Créer l'ordre"}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
              >
                Annuler
              </button>
            </div>
            {createOrder.isError ? (
              <p className="text-sm text-red-600">{(createOrder.error as Error).message}</p>
            ) : null}
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <Th>Référence</Th>
                <Th>Type</Th>
                <Th>Destination</Th>
                <Th>Prévu</Th>
                <Th>Oiseaux</Th>
                <Th>Code abattoir</Th>
                <Th>Statut</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {(orders.data ?? [])
                .slice()
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((o) => (
                  <tr key={o.id} className="border-t border-slate-100">
                    <Td className="font-mono font-medium">{o.referenceNumber}</Td>
                    <Td><StatusBadge status={o.slaughterType} /></Td>
                    <Td><StatusBadge status={o.destination} /></Td>
                    <Td>{dateFr(o.plannedDate ?? o.createdAt)}</Td>
                    <Td>{num(o.birdCount)}</Td>
                    <Td className="font-mono">{o.externalSlaughterhouseCode ?? o.internalBatchCode ?? '—'}</Td>
                    <Td><StatusBadge status={o.status} /></Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {o.status === 'DRAFT' ? (
                          <>
                            <button
                              onClick={() => send.mutate(o.id)}
                              className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              Envoyer
                            </button>
                            <button
                              onClick={() => confirm(`Annuler ${o.referenceNumber} ?`) && cancel.mutate(o.id)}
                              className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-300"
                            >
                              Annuler
                            </button>
                          </>
                        ) : null}
                        {o.status === 'SENT' ? (
                          <button
                            onClick={() => process.mutate(o.id)}
                            className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700"
                          >
                            Traiter
                          </button>
                        ) : null}
                        {o.destination === 'EXTERNE' ? (
                          <button
                            title="Bordereau PDF"
                            onClick={() =>
                              void api.download(
                                `/farms/${farmId}/slaughter-orders/${o.id}/bordereau`,
                                `${o.referenceNumber}.pdf`,
                              )
                            }
                            className="rounded bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200"
                          >
                            <FileOutput className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              {!orders.data?.length ? (
                <tr>
                  <Td className="py-8 text-center text-slate-400">
                    <EmptyState message="Aucun ordre d'abattage." />
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}