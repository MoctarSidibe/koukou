import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, PackageOpen, Plus } from 'lucide-react';
import { api } from '../api/client';
import type { FeedProduct, FeedStockSummary } from '../api/types';
import { useFarm } from '../app/FarmContext';
import { Card, EmptyState, PageHeader, Th, Td } from '../components/ui';
import { classNames, dateFr, num } from '../lib/format';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

const PHASE_LABELS: Record<string, string> = {
  POUSSIN: 'Poussin',
  DEMARRAGE: 'Démarrage',
  CROISSANCE: 'Croissance',
  PRE_PONTE: 'Pré-ponte',
  PONTE_PHASE_1: 'Ponte 1',
  PONTE_PHASE_2: 'Ponte 2',
  PONTE_PHASE_3: 'Ponte 3',
  FINITION: 'Finition',
  PERSONNALISE: 'Personnalisé',
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  BULKER: 'Bulker',
  BAG: 'Sac',
  MEDICAMENT: 'Médicament',
  MATIERE_PREMIERE: 'Matière première',
};

const phaseLabel = (p: string | null) => (p ? (PHASE_LABELS[p] ?? p) : '—');

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

  const products = useQuery({
    queryKey: ['feed-products', farmId],
    queryFn: () => api.get<FeedProduct[]>(`/farms/${farmId}/feed-products`),
    enabled: !!farmId,
  });

  const addProduct = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post(`/farms/${farmId}/feed-products`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed-products', farmId] });
      void queryClient.invalidateQueries({ queryKey: ['feed-stock', farmId] });
    },
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
                  <Th>Lot conseillé (FEFO)</Th>
                </tr>
              </thead>
              <tbody>
                {stock.data?.byType.map((t) => (
                  <tr key={t.feedPhase ?? 'legacy'} className="border-t border-slate-100">
                    <Td className="font-medium">{phaseLabel(t.feedPhase)}</Td>
                    <Td>{num(t.receivedKg)}</Td>
                    <Td>{num(t.usedKg)}</Td>
                    <Td>{num(t.lostKg)}</Td>
                    <Td
                      className={classNames(
                        'font-semibold',
                        t.autonomyDays != null && t.autonomyDays < 3 ? 'text-red-600' : '',
                      )}
                    >
                      {num(t.availableKg)} kg
                    </Td>
                    <Td>
                      {t.autonomyDays != null ? `${num(t.autonomyDays)} j` : '—'}
                    </Td>
                    <Td>{t.suggestedLotName ?? '—'}</Td>
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
          className="grid gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const inputLotId = f.get('inputLotId') as string;
            addLoss.mutate({
              inputLotId,
              quantity: Number(f.get('quantity') ?? 0) || 0,
              unit: f.get('unit'),
              reason: f.get('reason'),
              notes: null,
            });
            e.currentTarget.reset();
          }}
        >
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Lot (HACCP) *</span>
            <select name="inputLotId" required className={inputCls}>
              <option value="" disabled>
                Choisir le lot…
              </option>
              {(stock.data?.lots ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.productName} — {l.supplierLotNumber} ({num(l.availableKg)} kg rest.)
                </option>
              ))}
            </select>
          </label>
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

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-slate-700">Catalogue provende (par ferme)</h2>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            addProduct.mutate({
              name: f.get('name'),
              entryType: f.get('entryType'),
              feedPhase: (f.get('feedPhase') as string) || undefined,
              supplier: (f.get('supplier') as string) || undefined,
              defaultBagSizeKg: f.get('defaultBagSizeKg') ? Number(f.get('defaultBagSizeKg')) : undefined,
              defaultUnitPriceFcfa: f.get('price') ? Number(f.get('price')) : undefined,
              defaultCostPerMtFcfa: f.get('defaultCostPerMtFcfa') ? Number(f.get('defaultCostPerMtFcfa')) : undefined,
              defaultCostPerBagFcfa: f.get('defaultCostPerBagFcfa') ? Number(f.get('defaultCostPerBagFcfa')) : undefined,
            });
            e.currentTarget.reset();
          }}
        >
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Nom *</span>
            <input name="name" required placeholder="Provende ponte 50" className={inputCls} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Type d'entrée</span>
            <select name="entryType" className={inputCls} defaultValue="BAG">
              <option value="BULKER">Bulker</option>
              <option value="BAG">Sac</option>
              <option value="MEDICAMENT">Médicament</option>
              <option value="MATIERE_PREMIERE">Matière première</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Phase</span>
            <select name="feedPhase" className={inputCls}>
              <option value="">— (non applicable)</option>
              {Object.entries(PHASE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Fournisseur</span>
            <input name="supplier" placeholder="CEAG" className={inputCls} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Prix sac (FCFA)</span>
            <input name="price" type="number" min={0} step={1} placeholder="17000" className={inputCls} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Taille sac (kg)</span>
            <input name="defaultBagSizeKg" type="number" min={0} step={1} placeholder="50" className={inputCls} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Coût / tonne (FCFA)</span>
            <input name="defaultCostPerMtFcfa" type="number" min={0} step={1} placeholder="300000" className={inputCls} />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={addProduct.isPending}
              className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          </div>
        </form>
        <div className="mt-4 border-t border-slate-100" />
        <table className="mt-2 w-full">
          <thead className="bg-slate-50">
            <tr>
              <Th>Produit</Th>
              <Th>Type</Th>
              <Th>Phase</Th>
              <Th>Fournisseur</Th>
              <Th>Prix (FCFA)</Th>
              <Th>Sac (kg)</Th>
              <Th>Statut</Th>
            </tr>
          </thead>
          <tbody>
            {(products.data ?? []).map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <Td className="font-medium">{p.name}</Td>
                <Td>{ENTRY_TYPE_LABELS[p.entryType] ?? p.entryType}</Td>
                <Td>{phaseLabel(p.feedPhase)}</Td>
                <Td>{p.supplier ?? '—'}</Td>
                <Td>
                  {p.entryType === 'BULKER'
                    ? p.defaultCostPerMtFcfa != null
                      ? `${num(p.defaultCostPerMtFcfa)} /t`
                      : '—'
                    : p.defaultUnitPriceFcfa != null
                      ? num(p.defaultUnitPriceFcfa)
                      : '—'}
                </Td>
                <Td>{p.defaultBagSizeKg != null ? num(p.defaultBagSizeKg) : '—'}</Td>
                <Td>{p.active ? 'Actif' : 'Archivé'}</Td>
              </tr>
            ))}
            {!products.data?.length ? (
              <tr>
                <Td className="py-6 text-center text-slate-400">
                  Aucun produit au catalogue. Ajoutez votre provende habituelle pour pré-remplir les saisies.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {addProduct.isError ? (
          <p className="mt-3 text-sm text-red-600">{(addProduct.error as Error).message}</p>
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
                  <Th>Produit</Th>
                  <Th>Fournisseur</Th>
                  <Th>N° lot</Th>
                  <Th>Restant (kg)</Th>
                  <Th>Péremption</Th>
                </tr>
              </thead>
              <tbody>
                {(stock.data?.lots ?? []).map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <Td className="font-medium">{l.productName}</Td>
                    <Td>{l.supplier}</Td>
                    <Td>{l.supplierLotNumber}</Td>
                    <Td>{num(l.availableKg)}</Td>
                    <Td>{l.expirationDate ? dateFr(l.expirationDate) : '—'}</Td>
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
                    <Td>{dateFr(l.occurredAt)}</Td>
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