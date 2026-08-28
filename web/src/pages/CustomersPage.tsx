import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { api } from '../api/client';
import type { Customer } from '../api/types';
import { useFarm } from '../app/FarmContext';
import { Card, EmptyState, PageHeader, Th, Td } from '../components/ui';
import { dateFr } from '../lib/format';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

export function CustomersPage() {
  const { farmId } = useFarm();
  const queryClient = useQueryClient();

  const customers = useQuery({
    queryKey: ['customers', farmId],
    queryFn: () => api.get<Customer[]>(`/farms/${farmId}/customers`),
    enabled: !!farmId,
  });

  const createC = useMutation({
    mutationFn: (body: { fullName: string; phone?: string }) =>
      api.post<Customer>(`/farms/${farmId}/customers`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['customers', farmId] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients & fidélité"
        subtitle="Fiches clients, segments et crédit."
        actions={
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              createC.mutate({
                fullName: String(f.get('fullName')),
                phone: (f.get('phone') as string) || undefined,
              });
              e.currentTarget.reset();
            }}
          >
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Nom *</span>
              <input name="fullName" required className={inputCls} placeholder="Nom complet" />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Téléphone</span>
              <input name="phone" className={inputCls} placeholder="+241…" />
            </label>
            <button
              type="submit"
              disabled={createC.isPending}
              className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              <Users className="h-4 w-4" /> Ajouter
            </button>
          </form>
        }
      />

      {createC.isError ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {(createC.error as Error).message}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <Th>Client</Th>
                <Th>Téléphone</Th>
                <Th>Segment</Th>
                <Th>Inscrit le</Th>
              </tr>
            </thead>
            <tbody>
              {(customers.data ?? []).map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <Td className="font-medium">{c.fullName}</Td>
                  <Td>{c.phone ?? '—'}</Td>
                  <Td>
                    <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                      {c.segment}
                    </span>
                  </Td>
                  <Td>{dateFr(c.createdAt)}</Td>
                </tr>
              ))}
              {!customers.data?.length ? (
                <tr>
                  <Td className="py-8 text-center text-slate-400">
                    <EmptyState message="Aucun client enregistré." />
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