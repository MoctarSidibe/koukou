import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MapPin, Plus, Settings2, ShoppingCart, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { PosLineSheet } from '@/components/pos/PosLineSheet';
import { PosRegisterSheet } from '@/components/pos/PosRegisterSheet';
import { buildPosSaleItems, findPromotion, lineAmount, totalsFor } from '@/components/pos/helpers';
import type { PosLine } from '@/components/pos/types';
import { useAuth } from '@/auth/AuthContext';
import { fetchBatches, fetchPointsOfSale, fetchPromotions, fetchSlaughterOrders } from '@/api';
import { invalidateFarmQueries } from '@/api/invalidate';
import { SPECIES_ICONS, speciesLabel } from '@/api/format';
import { todayStr, type InvoiceFields } from '@/api/mutations';
import type { BatchWithMetrics } from '@/api/types';
import { queueSale, useOfflineQueue } from '@/offline';
import { color, palette, radii, spacing, fmt, fmtFcfa } from '@/constants/theme';

function lotTitle(b: BatchWithMetrics): string {
  return b.customSpecies ?? speciesLabel(b.species);
}

export default function PosScreen() {
  const router = useRouter();
  const { farmId } = useAuth();
  const queryClient = useQueryClient();
  const { batch } = useLocalSearchParams<{ batch?: string }>();
  const autoOpenDone = useRef(false);

  const batchesQuery = useQuery({ queryKey: ['batches', farmId], queryFn: () => fetchBatches(farmId) });
  const pdvQuery = useQuery({ queryKey: ['points-of-sale', farmId], queryFn: () => fetchPointsOfSale(farmId) });
  const slaughterQuery = useQuery({ queryKey: ['slaughter-orders', farmId], queryFn: () => fetchSlaughterOrders(farmId) });
  const promotionsQuery = useQuery({ queryKey: ['promotions', farmId], queryFn: () => fetchPromotions(farmId) });
  const queue = useOfflineQueue(farmId);

  const [pdvId, setPdvId] = useState('');
  const [lines, setLines] = useState<PosLine[]>([]);
  const [lineSheetOpen, setLineSheetOpen] = useState(false);
  const [editing, setEditing] = useState<PosLine | undefined>(undefined);
  const [presetBatchId, setPresetBatchId] = useState<string | undefined>(undefined);
  const [registerOpen, setRegisterOpen] = useState(false);

  const lots = (batchesQuery.data ?? []).filter(
    (b) => b.quantityAlive > 0 && (b.status === 'EN_VENTE' || b.status === 'ACTIF'),
  );
  const pdvs = pdvQuery.data ?? [];
  const activePdvs = pdvs.filter((p) => p.isActive);
  const pdv = activePdvs.find((p) => p.id === pdvId) ?? pdvs.find((p) => p.isDefault) ?? activePdvs[0] ?? pdvs[0];
  const pools = (slaughterQuery.data ?? []).filter(
    (p) => p.status === 'PROCESSED' && p.slaughterType === 'ABATTU' && (p.carcassesAvailable ?? 0) > 0,
  );
  const poolTotal = pools.reduce((a, p) => a + (p.carcassesAvailable ?? 0), 0);
  const loading = batchesQuery.isLoading || pdvQuery.isLoading;

  const totals = totalsFor(lines, null);

  useEffect(() => {
    if (autoOpenDone.current || !batch) return;
    const target = lots.find((b) => b.id === batch);
    if (!target) return;
    autoOpenDone.current = true;
    openNew(target);
  }, [batch, lots, loading]);

  const openNew = (batch?: BatchWithMetrics) => {
    setEditing(undefined);
    setPresetBatchId(batch?.id);
    setLineSheetOpen(true);
  };

  const openEdit = (line: PosLine) => {
    setEditing(line);
    setPresetBatchId(undefined);
    setLineSheetOpen(true);
  };

  const saveLine = (line: PosLine) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.uid === line.uid);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = line;
        return next;
      }
      return [...prev, line];
    });
  };

  const handleSell = async (input: { invoice?: InvoiceFields; promoCode?: string; pointOfSaleId?: string }) => {
    const items = buildPosSaleItems(lines);
    const subTotal = totalsFor(lines, null).subtotalFcfa;
    const promo = input.promoCode?.trim() ? findPromotion(promotionsQuery.data ?? [], input.promoCode, subTotal) : null;
    const total = totalsFor(lines, promo).totalFcfa;
    const invoice: InvoiceFields | undefined = (() => {
      const base = input.invoice ?? {};
      if (promo) return { ...base, promoCode: promo.code };
      return Object.keys(base).length > 0 ? base : undefined;
    })();
    const result = await queueSale(farmId, todayStr(), items, total, invoice, input.pointOfSaleId);
    if (result.status === 'sent') {
      invalidateFarmQueries(queryClient, { farmId });
    }
    return result;
  };

  // Edge 'bottom' : évite que la barre de panier passe sous la barre système
  // Android (3 boutons) en mode edge-to-edge.
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {router.canGoBack() ? (
            <Pressable onPress={() => router.back()} style={styles.settingsBtn} accessibilityRole="button">
              <ChevronLeft size={22} color={color.ink[700]} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            <AppText size="h2" weight="bold" color="text">
              Encaisser
            </AppText>
            <AppText size="caption" color="muted">
              POS · espèces {queue.pending.length > 0 ? `· ${fmt(queue.pending.length)} en attente` : ''}
            </AppText>
          </View>
          <Pressable onPress={() => router.push('/points-vente')} style={styles.settingsBtn} accessibilityRole="button">
            <Settings2 size={20} color={color.ink[600]} />
          </Pressable>
        </View>

        <View style={styles.pdvRow}>
          <MapPin size={14} color={color.brand[600]} />
          <View style={styles.pdvChips}>
            {activePdvs.map((p) => (
              <Pressable key={p.id} onPress={() => setPdvId(p.id)} accessibilityRole="button">
                <Chip
                  label={`${p.kind === 'FERME' ? '🏡' : '🏪'} ${p.name}`}
                  tone={p.kind === 'FERME' ? 'brand' : 'accent'}
                  selected={pdv?.id === p.id}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Spinner />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.sectionTitle}>
            <AppText size="label" color="muted">
              LOTS À VENDRE
            </AppText>
            {poolTotal > 0 ? (
              <Chip label={`${fmt(poolTotal)} carcasses abattoir`} tone="amber" />
            ) : null}
          </View>

          <View style={styles.lotGrid}>
            {lots.map((b) => {
              const ready = b.status === 'EN_VENTE' || b.metrics.readyForSale;
              return (
                <Card key={b.id} onPress={() => openNew(b)} style={styles.lotCard}>
                  <View style={styles.lotHead}>
                    <Chip
                      label={`${SPECIES_ICONS[b.species] ?? ''} ${lotTitle(b)}`}
                      tone={b.type === 'CHAIR' ? 'brand' : 'green'}
                    />
                    <Chip label={ready ? 'Prêt' : 'Jeune'} tone={ready ? 'green' : 'neutral'} />
                  </View>
                  <AppText size="body" weight="semibold" color="text" numberOfLines={1}>
                    {b.batchName ?? 'Lot'}
                  </AppText>
                  <AppText size="small" color="muted">
                    J{b.metrics.ageDays} · {b.breedName ?? '—'} · {b.type === 'CHAIR' ? 'Chair' : 'Pondeuse'}
                  </AppText>
                  <View style={styles.lotFooter}>
                    <AppText size="h3" weight="bold" color="text">
                      {fmt(b.quantityAlive)}
                      <AppText size="caption" weight="medium" color="muted">
                        {' '}vivants
                      </AppText>
                    </AppText>
                    <ChevronRight size={18} color={color.ink[300]} />
                  </View>
                </Card>
              );
            })}
            {lots.length === 0 ? (
              <Card tone="default" style={{ width: '100%' }}>
                <EmptyState
                  emoji="🐔"
                  title="Aucun lot vendable"
                  description="Créez ou réactivez un lot avec des oiseaux vivants pour commencer à encaisser."
                />
              </Card>
            ) : null}
          </View>

          {pools.length > 0 ? (
            <Card tone="warn" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <AppText size="body" weight="bold" color="text">
                  Carcasses fraîches disponibles
                </AppText>
                <AppText size="small" color="muted">
                  {fmt(poolTotal)} pièces issues de l’abattoir — à vendre en pièce ou au kilo.
                </AppText>
              </View>
              <Button label="Vendre" tone="accent" size="md" block={false} onPress={() => { setEditing(undefined); setPresetBatchId(undefined); setLineSheetOpen(true); }} />
            </Card>
          ) : null}

          {lines.length > 0 ? (
            <>
              <View style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
                <AppText size="label" color="muted">
                  PANIER · {fmt(lines.length)} ARTICLE{lines.length > 1 ? 'S' : ''}
                </AppText>
              </View>
              <View style={{ gap: spacing.sm }}>
                {lines.map((l) => (
                  <Card key={l.uid} onPress={() => openEdit(l)} style={styles.cartCard}>
                    <View style={{ flex: 1 }}>
                      <AppText size="body" weight="semibold" color="text" numberOfLines={1}>
                        {l.label}
                      </AppText>
                      <AppText size="small" color="muted" numberOfLines={1}>
                        {l.batchId ? lots.find((b) => b.id === l.batchId)?.batchName ?? 'Lot' : ''} · {fmt(l.qty)} × {fmt(l.unitPriceFcfa)}
                      </AppText>
                    </View>
                    <AppText size="body" weight="bold" color="accent">
                      {fmt(lineAmount(l))} FCFA
                    </AppText>
                    <Pressable
                      onPress={() => setLines((prev) => prev.filter((x) => x.uid !== l.uid))}
                      hitSlop={8}
                      style={styles.deleteBtn}
                      accessibilityRole="button">
                      <Trash2 size={18} color={color.red[500]} />
                    </Pressable>
                  </Card>
                ))}
              </View>
            </>
          ) : null}
        </View>
      )}

      <View style={styles.bottomBar}>
        <View style={{ flex: 1 }}>
          <AppText size="caption" color="muted">
            TOTAL PANIER
          </AppText>
          <AppText size="h3" weight="bold" color={lines.length > 0 ? 'text' : 'faint'} numberOfLines={1} adjustsFontSizeToFit>
            {lines.length > 0 ? fmtFcfa(totals.totalFcfa) : '0 FCFA'}
          </AppText>
        </View>
        <View style={{ width: 190 }}>
          <Button
            label="Encaisser"
            tone="accent"
            icon={ShoppingCart}
            disabled={lines.length === 0}
            onPress={() => setRegisterOpen(true)}
          />
        </View>
      </View>

      {!loading ? (
        <Pressable style={styles.fab} onPress={() => openNew()} accessibilityRole="button">
          <Plus size={26} color={color.surface} />
        </Pressable>
      ) : null}

      <PosLineSheet
        visible={lineSheetOpen}
        lots={lots}
        pools={pools}
        committed={lines}
        initial={editing}
        presetBatchId={presetBatchId}
        onSave={saveLine}
        onClose={() => {
          setLineSheetOpen(false);
          setEditing(undefined);
          setPresetBatchId(undefined);
        }}
      />
      <PosRegisterSheet
        visible={registerOpen}
        lines={lines}
        promotions={promotionsQuery.data ?? []}
        pdvName={pdv?.name ?? 'Ferme'}
        pointOfSaleId={pdv?.id}
        onSell={handleSell}
        onSettled={() => setLines([])}
        onClose={() => setRegisterOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pdvChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  lotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  lotCard: {
    width: '48%',
    flexGrow: 1,
    gap: 4,
  },
  lotHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  lotFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: color.red[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    backgroundColor: palette.surface,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    top: 128,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: color.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.brand[950],
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
});