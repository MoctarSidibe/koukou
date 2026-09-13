import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, UserPlus, UserRound } from 'lucide-react-native';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/auth/AuthContext';
import { fetchCustomerHistory, fetchCustomerStats, fetchCustomers } from '@/api';
import { invalidateFarmQueries } from '@/api/invalidate';
import { createCustomer } from '@/api/mutations';
import type { CustomerSegment, SaleFull } from '@/api/types';
import { initials } from '@/api/format';
import { color, palette, fmtFcfa } from '@/constants/theme';

const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  NOUVEAU: 'Nouveau',
  REGULIER: 'Régulier',
  TOP: 'Top client',
};

function SegmentChip({ s }: { s: CustomerSegment }) {
  const tone = s === 'TOP' ? 'green' : s === 'REGULIER' ? 'brand' : 'neutral';
  return <Chip label={SEGMENT_LABEL[s] ?? s} tone={tone} dot />;
}

function HistoryItem({ s }: { s: SaleFull }) {
  return (
    <View style={styles.histRow}>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText size="body" weight="semibold" color="text">
          {s.referenceNumber}
        </AppText>
        <AppText size="caption" color="muted">
          {s.saleDate?.slice(0, 10)} · {s.items.map((i) => `${i.label} × ${i.quantity}`).join(', ')}
        </AppText>
      </View>
      <AppText size="body" weight="bold" color="text">
        {fmtFcfa(s.totalAmountFcfa)}
      </AppText>
    </View>
  );
}

export default function ClientsScreen() {
  const { farms, farmId } = useAuth();
  const queryClient = useQueryClient();

  const customersQuery = useQuery({ queryKey: ['customers', farmId], queryFn: () => fetchCustomers(farmId) });

  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statsQuery = useQuery({
    queryKey: ['customer-stats', farmId, openId ?? ''],
    queryFn: () => fetchCustomerStats(farmId, openId!),
    enabled: openId !== null,
  });
  const historyQuery = useQuery({
    queryKey: ['customer-history', farmId, openId ?? ''],
    queryFn: () => fetchCustomerHistory(farmId, openId!),
    enabled: openId !== null,
  });

  const add = async () => {
    if (!name.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await createCustomer(farmId, {
        fullName: name.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
      });
      setName('');
      setPhone('');
      setCity('');
      await invalidateFarmQueries(queryClient, { farmId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création du client.');
    } finally {
      setBusy(false);
    }
  };

  const customers = customersQuery.data ?? [];
  const stats = statsQuery.data;
  const history = historyQuery.data ?? [];

  return (
    <Screen header={<ScreenHeader title="Clients & crédit" subtitle={farms[0]?.name ?? 'Ferme'} back right={<UserRound size={18} color={color.ink[300]} />} />}>

      {customersQuery.isLoading ? (
        <Spinner label="Chargement des clients…" />
      ) : (
        <>
          <Card tone="default" style={styles.formCard}>
            <AppText size="label" color="muted" style={{ marginBottom: 4 }}>
              NOUVEAU CLIENT
            </AppText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nom complet (restaurant, revendeur…)"
              placeholderTextColor={color.ink[300]}
              style={styles.input}
              editable={!busy}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Téléphone"
              placeholderTextColor={color.ink[300]}
              keyboardType="phone-pad"
              style={styles.input}
              editable={!busy}
            />
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Ville (optionnel)"
              placeholderTextColor={color.ink[300]}
              style={styles.input}
              editable={!busy}
            />
            {error ? (
              <AppText size="small" color="danger">
                {error}
              </AppText>
            ) : null}
            <Button label="Créer la fiche" tone="brand" icon={UserPlus} onPress={() => void add()} disabled={busy || !name.trim()} loading={busy} />
          </Card>

          <SectionHeader title={`Clients (${customers.length})`} subtitle="Fiches, soldes & segments" />
          <View style={{ gap: 10 }}>
            {customers.length === 0 ? (
              <AppText size="caption" color="muted">
                Aucun client enregistré. Le nom/mobile saisi au POS crée la fiche automatiquement.
              </AppText>
            ) : (
              customers.map((c) => {
                const open = openId === c.id;
                const due = c.balance?.outstandingFcfa ?? 0;
                return (
                  <Card key={c.id} tone={open ? 'brand' : 'default'} style={styles.card}>
                    <Pressable onPress={() => setOpenId(open ? null : c.id)} accessibilityRole="button">
                      <View style={styles.head}>
                        <View style={styles.avatar}>
                          <AppText size="body" weight="bold" color="surface">
                            {initials(c.fullName)}
                          </AppText>
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={styles.rowBetween}>
                            <AppText size="body" weight="semibold" color="text" style={{ flex: 1 }}>
                              {c.fullName}
                            </AppText>
                            <SegmentChip s={c.segment} />
                          </View>
                          <AppText size="caption" color="muted">
                            {[c.phone, c.city].filter(Boolean).join(' · ') || 'Aucun contact'}
                          </AppText>
                          <AppText size="bodyM" weight="semibold" color={due > 0 ? 'danger' : 'success'}>
                            {due > 0 ? `Dû : ${fmtFcfa(due)}` : 'Soldé ✓'}
                          </AppText>
                        </View>
                        {open ? <ChevronDown size={16} color={color.ink[300]} /> : <ChevronRight size={16} color={color.ink[300]} />}
                      </View>
                    </Pressable>

                    {open ? (
                      <View style={styles.detail}>
                        <View style={{ gap: 2 }}>
                          <RowRow label="Total facturé" value={fmtFcfa(c.balance?.totalInvoicedFcfa ?? 0)} />
                          <RowRow label="Encaissé" value={fmtFcfa(c.balance?.paidFcfa ?? 0)} />
                          <RowRow label="À recouvrer" value={fmtFcfa(due)} warn={due > 0} />
                        </View>
                        {statsQuery.isLoading ? (
                          <Spinner label="Calcul des stats…" />
                        ) : stats ? (
                          <View style={styles.statsRow}>
                            <Stat label="Visites" value={String(stats.visits)} />
                            <Stat label="Total dépensé" value={fmtFcfa(stats.totalSpentFcfa)} />
                            <Stat label="Panier moyen" value={fmtFcfa(stats.avgBasketFcfa)} />
                          </View>
                        ) : null}
                        {stats && stats.favorites.length > 0 ? (
                          <AppText size="caption" color="muted">
                            Aime : {stats.favorites.map((f) => f.label).join(', ')}
                          </AppText>
                        ) : null}
                        <SectionHeader title="Historique" />
                        {historyQuery.isLoading ? (
                          <Spinner label="Lecture de l’historique…" />
                        ) : history.length === 0 ? (
                          <AppText size="caption" color="muted">
                            Aucun achat pour l’instant.
                          </AppText>
                        ) : (
                          history.map((s) => <HistoryItem key={s.id} s={s} />)
                        )}
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </View>

          <AppText size="caption" color="faint" style={styles.footer}>
            Le solde = total des ventes non annulées − paiements confirmés. Les segments (Nouveau / Régulier / Top) sont calculés par le serveur.
          </AppText>
        </>
      )}
    </Screen>
  );
}

function RowRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.rowBetween}>
      <AppText size="small" color="muted">
        {label}
      </AppText>
      <AppText size="small" weight="semibold" color={warn ? 'warn' : 'text'}>
        {value}
      </AppText>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText size="bodyM" weight="bold" color="text">
        {value}
      </AppText>
      <AppText size="caption" color="muted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: {
    gap: 10,
    padding: 14,
  },
  card: {
    gap: 10,
    padding: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detail: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 10,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: color.ink[800],
    backgroundColor: color.surface,
  },
  footer: {
    textAlign: 'center',
    marginTop: 20,
  },
});