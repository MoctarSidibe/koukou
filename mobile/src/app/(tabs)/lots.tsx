import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Activity,
  AlertTriangle,
  Bird,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock,
  Coins,
  Droplets,
  Egg,
  HeartPulse,
  Info,
  Layers,
  ListOrdered,
  PackageCheck,
  Plus,
  Receipt,
  Scale,
  SortAsc,
  SortDesc,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Wallet,
  Warehouse,
  Wheat,
} from 'lucide-react-native';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { MetricTile } from '@/components/ui/MetricTile';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { PeriodBar, periodWindow, toDateStr, type PeriodBarHandle, type PeriodWindow } from '@/components/ui/PeriodBar';
import { color, fmt, palette, radii } from '@/constants/theme';
import { useAuth } from '@/auth/AuthContext';
import { useLiveMinute } from '@/hooks/useLiveMinute';
import { fetchBatches, fetchBatchHealth, fetchBuildings, fetchExpenses, fetchOrders, fetchRentabiliteBatch, fetchRentabiliteOverview, fetchSales } from '@/api';
import type { BatchHealth, BatchPnl, BatchStatus, BatchType, BatchWithMetrics, Expense, OrderCanal, OrderFull, OrderStatus, ReadyReason, SaleSummary } from '@/api/types';
import { SPECIES_ICONS, speciesLabel } from '@/api/format';
import { CreateLotSheet } from '@/components/CreateLotSheet';
import { useCreateCenter } from '@/components/create/CreateCenter';

// ── Filters ──
type FilterType = 'all' | 'active' | 'selling' | 'chair' | 'layer';
const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'selling', label: 'En vente' },
  { key: 'chair', label: 'Chair' },
  { key: 'layer', label: 'Pondeuses' },
];

// ── Sort ──
type SortKey = 'name' | 'age' | 'mortality' | 'fcr' | 'liveCount' | 'health';
type SortDir = 'asc' | 'desc';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Nom' },
  { key: 'age', label: 'Âge' },
  { key: 'mortality', label: 'Mortalité' },
  { key: 'fcr', label: 'IC' },
  { key: 'liveCount', label: 'Vivants' },
  { key: 'health', label: 'Santé' },
];

// ── Breed cycle lengths (days) ──
const CHAIR_CYCLE_DAYS = 84; // ~12 weeks
const LAYER_CYCLE_DAYS = 504; // ~72 weeks
const FINANCE_WINDOW_DAYS = 30; // fenêtre financière par défaut

// ── Production stage (stade) thresholds ──
const CHAIR_READY_DAYS = 35; // matches backend VENTE_AGE_MIN_DAYS
const LAYER_DEMARRAGE_DAYS = 56; // ~8 weeks poussinière
const LAYER_PONTE_DAYS = 134; // ~19 weeks
const LAYER_REFORME_DAYS = 420; // ~60 weeks

type StageTone = 'brand' | 'accent' | 'green' | 'amber';
function batchStage(b: { type: BatchType; status: BatchStatus; metrics: { ageDays: number } }): { label: string; tone: StageTone } {
  if (b.status === 'EN_VENTE') return { label: 'Prêt à la vente', tone: 'green' };
  const age = b.metrics.ageDays;
  if (b.type === 'PONDEUSE') {
    if (age <= LAYER_DEMARRAGE_DAYS) return { label: 'Démarrage', tone: 'brand' };
    if (age < LAYER_PONTE_DAYS) return { label: 'Croissance', tone: 'brand' };
    if (age < LAYER_REFORME_DAYS) return { label: 'Ponte', tone: 'accent' };
    return { label: 'Réforme', tone: 'amber' };
  }
  if (age < 14) return { label: 'Démarrage', tone: 'brand' };
  if (age < 28) return { label: 'Croissance', tone: 'brand' };
  if (age < CHAIR_READY_DAYS) return { label: 'Finition', tone: 'accent' };
  return { label: 'Prêt à la vente', tone: 'green' };
}

// ── Helpers (module scope — no Date.now/Math.random inside render) ──
function dateFr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${Number(d)}/${Number(m)}/${y}` : iso;
}

function compactFcfa(n: number): string {
  if (n >= 1_000_000) {
    const v = (n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
    return `${v}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return n.toLocaleString('fr-FR');
}

function recentSales(s?: SaleSummary[]): SaleSummary[] {
  return [...(s ?? [])].sort((a, b) => b.saleDate.localeCompare(a.saleDate)).slice(0, 5);
}

function recentExpenses(e?: Expense[]): Expense[] {
  return [...(e ?? [])].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)).slice(0, 5);
}

function openOrders(o?: OrderFull[]): OrderFull[] {
  return (o ?? []).filter((x) => x.status === 'PENDING' || x.status === 'CONFIRMED');
}

function toFmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fenêtre précédente de même longueur (jour-à-jour pour une vue "Jour", période-à-période sinon). */
function shiftWindow(fromISO: string | undefined, toISO: string | undefined): { from: string | undefined; to: string | undefined } {
  if (!fromISO || !toISO) return { from: undefined, to: undefined };
  const [fy, fm, fd] = fromISO.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = toISO.slice(0, 10).split('-').map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(from.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000);
  return { from: toFmtDate(prevFrom), to: toFmtDate(prevTo) };
}

function deltaPct(cur: number | undefined, prev: number | undefined): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'À confirmer',
  CONFIRMED: 'Confirmée',
  LIVRE: 'Livrée',
  CANCELLED: 'Annulée',
};

const CANAL_LABELS: Record<OrderCanal, string> = {
  FERME: 'Ferme',
  LIVRAISON: 'Livraison',
  PRECOMMANDE: 'Précommande',
};

const READY_REASON_LABELS: Record<ReadyReason, string> = {
  READY: 'Prêt à la vente',
  TOO_YOUNG: 'Trop jeune (âge minimum 35 jours)',
  FCR: 'Indice de consommation au-dessus du seuil de vente',
  SANITARY: 'Contre-indication sanitaire',
  N_A: 'Non applicable (pondeuses en ponte normale)',
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function LotsScreen() {
  const router = useRouter();
  const { farmId } = useAuth();
  const { openCreateBuilding } = useCreateCenter();
  const batches = useQuery({ queryKey: ['batches', farmId], queryFn: () => fetchBatches(farmId) });
  const buildings = useQuery({ queryKey: ['buildings', farmId], queryFn: () => fetchBuildings(farmId) });

  // ── State ──
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortKey, setSortKey] = useState<SortKey>('age');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showCreate, setShowCreate] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [expandedLot, setExpandedLot] = useState<string | null>(null);
  const [showFinance, setShowFinance] = useState(false);
  const [finMode, setFinMode] = useState<'jour' | 'periode'>('jour');
  const [finHelpOpen, setFinHelpOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodWindow>(() => periodWindow(FINANCE_WINDOW_DAYS));
  const chevAnim = useRef(new Animated.Value(0)).current;
  const firstWindowRef = useRef(true);
  const periodBarRef = useRef<PeriodBarHandle>(null);
  const finPendingRef = useRef(false);

  const handleFinModeChange = (m: 'jour' | 'periode') => {
    setFinMode(m);
    if (m === 'periode') {
      finPendingRef.current = true;
      periodBarRef.current?.openPicker();
    }
  };

  const handlePickerClose = () => {
    if (finPendingRef.current) {
      finPendingRef.current = false;
      setFinMode('jour');
    }
  };

  const handleFinanceApplied = (source: 'single' | 'range') => {
    finPendingRef.current = false;
    if (source === 'single') setFinMode('jour');
    else setFinMode('periode');
  };

  const toggleFinance = () => {
    Haptics.selectionAsync().catch(() => {});
    const next = !showFinance;
    setShowFinance(next);
    Animated.timing(chevAnim, {
      toValue: next ? 1 : 0,
      duration: 220,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const chevronRotate = chevAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const handlePeriodChange = (w: PeriodWindow) => {
    setPeriod(w);
    if (firstWindowRef.current) {
      firstWindowRef.current = false;
      return;
    }
    if (finMode === 'periode') {
      const todayStr = toDateStr(new Date());
      if (w.isFiltered && w.from != null && w.from === w.to && w.to === todayStr) {
        finPendingRef.current = false;
        setFinMode('jour');
      }
    }
  };

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setShowCreate(true);
  };

  const periodLabel = period.span === 'all'
    ? (period.isFiltered ? 'Tout historique' : 'Tout historique · en direct')
    : period.isFiltered
      ? `Du ${dateFr(period.from ?? '')} au ${dateFr(period.to ?? '')}`
      : `Du ${dateFr(period.from ?? '')} au ${dateFr(period.to ?? '')} · en direct`;
  const finLabel = finMode === 'jour'
    ? period.isFiltered
      ? `Jour du ${dateFr(period.to ?? '')}`
      : `Aujourd'hui · ${dateFr(period.to ?? '')}`
    : periodLabel;

  // ── Finance data (période ou jour actif) ──
  const finFrom = finMode === 'jour' ? period.to : period.from;
  const finTo = period.to;
  const pnl = useQuery({
    queryKey: ['rentabilite-overview', farmId, finMode, finFrom, finTo],
    queryFn: () => fetchRentabiliteOverview(farmId, finFrom, finTo),
    placeholderData: keepPreviousData,
  });
  const salesQ = useQuery({
    queryKey: ['sales', farmId, finMode, finFrom, finTo],
    queryFn: () => fetchSales(farmId, finFrom, finTo),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const expensesQ = useQuery({
    queryKey: ['expenses', farmId, finMode, finFrom, finTo],
    queryFn: () => fetchExpenses(farmId, finFrom, finTo),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const ordersQ = useQuery({ queryKey: ['orders', farmId], queryFn: () => fetchOrders(farmId), staleTime: 30_000 });

  // ── Comparaison à la fenêtre précédente (même longueur) ──
  const prevWin = useMemo(() => shiftWindow(finFrom ?? undefined, finTo), [finFrom, finTo]);
  const prevPnl = useQuery({
    queryKey: ['rentabilite-overview-prev', farmId, finMode, prevWin.from, prevWin.to],
    queryFn: () => fetchRentabiliteOverview(farmId, prevWin.from, prevWin.to),
    enabled: prevWin.from != null,
    placeholderData: keepPreviousData,
  });
  const dEncaissPct = deltaPct(pnl.data?.collectedFcfa, prevPnl.data?.collectedFcfa);
  const dNetPct = deltaPct(pnl.data?.netFcfa, prevPnl.data?.netFcfa);
  const hasCompare = prevPnl.data != null && (dEncaissPct != null || dNetPct != null);

  useLiveMinute(() => {
    if (period.isFiltered) return;
    void batches.refetch();
    void ordersQ.refetch();
    void pnl.refetch();
    void salesQ.refetch();
    void expensesQ.refetch();
  });

  // ── Filter & Sort ──
  const shown = useMemo(() => {
    let list = batches.data ?? [];
    if (filter === 'active') list = list.filter((b) => b.status === 'ACTIF');
    else if (filter === 'selling') list = list.filter((b) => b.status === 'EN_VENTE');
    else if (filter === 'chair') list = list.filter((b) => b.type === 'CHAIR');
    else if (filter === 'layer') list = list.filter((b) => b.type === 'PONDEUSE');

    list = [...list].sort((a, b) => {
      const mA = a.metrics;
      const mB = b.metrics;
      let cmp = 0;
      if (sortKey === 'name') cmp = (a.batchName ?? '').localeCompare(b.batchName ?? '');
      else if (sortKey === 'age') cmp = mA.ageDays - mB.ageDays;
      else if (sortKey === 'mortality') cmp = mA.mortalityPercent - mB.mortalityPercent;
      else if (sortKey === 'fcr') cmp = (mA.fcr ?? 0) - (mB.fcr ?? 0);
      else if (sortKey === 'liveCount') cmp = mA.liveCount - mB.liveCount;
      else if (sortKey === 'health') cmp = (mA.status === 'VERT' ? 3 : mA.status === 'JAUNE' ? 2 : 1) - (mB.status === 'VERT' ? 3 : mB.status === 'JAUNE' ? 2 : 1);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [batches.data, filter, sortKey, sortDir]);

  // ── Slim summary totals (Vue d'ensemble) ──
  const summary = useMemo(() => {
    const list = shown;
    if (list.length === 0) return null;
    const totalBirds = list.reduce((s, b) => s + b.metrics.liveCount, 0);
    const avgAgeDays = list.reduce((s, b) => s + b.metrics.ageDays, 0) / list.length;
    const chairBatches = list.filter((b) => b.type === 'CHAIR');
    const layerBatches = list.filter((b) => b.type === 'PONDEUSE');
    const avgFcr = chairBatches.length > 0 ? chairBatches.reduce((s, b) => s + (b.metrics.fcr ?? 0), 0) / chairBatches.length : null;
    const avgLayRate = layerBatches.length > 0 ? layerBatches.reduce((s, b) => s + (b.metrics.layRatePercent ?? 0), 0) / layerBatches.length : null;
    const activeCount = list.filter((b) => b.status === 'ACTIF').length;
    const sellingCount = list.filter((b) => b.status === 'EN_VENTE').length;
    const startedBirds = list.reduce((s, b) => s + b.quantityAtStart, 0);
    const totalDeaths = list.reduce((s, b) => s + b.metrics.totalDeaths, 0);
    const avgMortality = startedBirds > 0 ? (totalDeaths / startedBirds) * 100 : 0;
    const totalEggs = list.reduce((s, b) => s + (b.metrics.eggsCollectedTotal ?? 0), 0);
    const labelByKey = new Map<string, string>();
    const birdsByKey = new Map<string, number>();
    for (const b of list) {
      const key = `${b.species ?? 'POULET'}|${b.type}`;
      if (!labelByKey.has(key)) {
        const spec = speciesLabel(b.species ?? 'POULET');
        labelByKey.set(key, b.type === 'PONDEUSE' ? `${spec} pondeuses` : `${spec} chair`);
      }
      birdsByKey.set(key, (birdsByKey.get(key) ?? 0) + b.metrics.liveCount);
    }
    const speciesGroups = [...labelByKey.entries()].map(([key, label]) => ({ label, birds: birdsByKey.get(key) ?? 0 }));
    const chairBirds = chairBatches.reduce((s, b) => s + b.metrics.liveCount, 0);
    const layerBirds = layerBatches.reduce((s, b) => s + b.metrics.liveCount, 0);
    return { totalBirds, avgAgeDays, avgFcr, avgLayRate, count: list.length, activeCount, sellingCount, avgMortality, totalEggs, speciesGroups, chairBirds, layerBirds };
  }, [shown]);

  // ── Farm-wide stats (4 tiles, indépendants du filtre) ──
  const farmStats = useMemo(() => {
    const list = batches.data ?? [];
    const totalBirds = list.reduce((s, b) => s + b.metrics.liveCount, 0);
    const startedBirds = list.reduce((s, b) => s + b.quantityAtStart, 0);
    const totalDeaths = list.reduce((s, b) => s + b.metrics.totalDeaths, 0);
    const avgMortality = startedBirds > 0 ? (totalDeaths / startedBirds) * 100 : null;
    const totalEggs = list.reduce((s, b) => s + (b.metrics.eggsCollectedTotal ?? 0), 0);
    return { totalLots: list.length, totalBirds, avgMortality, totalEggs };
  }, [batches.data]);

  // Empty-state helpers
  const hasAnyBatch = (batches.data?.length ?? 0) > 0;
  const hasBuilding = (buildings.data?.length ?? 0) > 0;
  const filterLabel = FILTERS.find((f) => f.key === filter)?.label.toLowerCase() ?? 'filtre';

  return (
    <Screen bottomPad={120} refreshing={batches.isFetching} onRefresh={() => void batches.refetch()}>
      {/* ── HEADER ── */}
      <ScreenHeader
        title="Lots"
        subtitle={`${batches.data?.length ?? 0} lot(s) · suivi zootechnique`}
        left={<Image source={require('@/assets/images/logo-nav.png')} style={styles.headerLogo} accessibilityLabel="Logo KouKou" />}
        right={
          <Pressable onPress={openCreate} style={styles.createBtn} accessibilityRole='button'>
            <Plus size={18} color={palette.brand[50]} />
            <AppText size='small' weight='bold' color='surface'>Nouveau</AppText>
          </Pressable>
        }
      />

      {/* ── DATE BAR (Accueil style) : en direct par défaut, décalage par jour, picker date & heure ── */}
      <PeriodBar ref={periodBarRef} defaultSpan={FINANCE_WINDOW_DAYS} onChange={handlePeriodChange} onApplied={handleFinanceApplied} onPickerClose={handlePickerClose} />

      {/* ── STATS TILES (ferme) — au-dessus de la finance ── */}
      <View style={styles.metricGrid}>
        <MetricTile label="Total lots" value={fmt(farmStats.totalLots)} sub={farmStats.totalLots > 0 ? 'en suivi' : 'Aucun lot'} tone="brand" icon={Layers} threeCol style={styles.metricTileFour} labelLines={2} labelBelow />
        <MetricTile label="Volailles" value={fmt(farmStats.totalBirds)} sub="vivantes" tone="green" icon={Bird} threeCol style={styles.metricTileFour} labelLines={2} labelBelow />
        <MetricTile
          label="Mortalité"
          value={farmStats.avgMortality != null ? `${farmStats.avgMortality.toLocaleString('fr-FR')} %` : '—'}
          sub={farmStats.avgMortality != null ? 'moyenne' : 'n/d'}
          tone={farmStats.avgMortality != null && farmStats.avgMortality > 5 ? 'red' : farmStats.avgMortality != null && farmStats.avgMortality > 1 ? 'amber' : 'green'}
          icon={HeartPulse}
          threeCol
          style={styles.metricTileFour}
          labelLines={2}
          labelBelow
        />
        <MetricTile label="Œufs" value={farmStats.totalEggs > 0 ? fmt(farmStats.totalEggs) : '—'} sub="collectés" tone="accent" icon={Egg} threeCol style={styles.metricTileFour} labelLines={2} labelBelow />
      </View>

      {/* ── FINANCE (Aujourd'hui | Période : 4 cartes + détail) ── */}
      <Pressable
        onPress={toggleFinance}
        style={({ pressed }) => [styles.financeHead, pressed && styles.financeHeadPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: showFinance }}>
        <View style={styles.financeHeadIcon}>
          <Wallet size={15} color={palette.brand[600]} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText size="small" weight="bold" color="brand">Finance de la période</AppText>
          <AppText size="caption" color="faint">{finLabel}</AppText>
        </View>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setFinHelpOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Aide — comprendre la Finance"
          hitSlop={8}
          style={({ pressed }) => [styles.financeHelpBtn, pressed && styles.financeHelpBtnPressed]}>
          <Info size={14} color={palette.brand[600]} />
        </Pressable>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <ChevronDown size={16} color={palette.brand[600]} />
        </Animated.View>
      </Pressable>

      <View style={styles.financeModeRow}>
        <View style={styles.financeModeControl}>
          <Segmented
            options={[
              { key: 'jour', label: "Aujourd'hui", tint: palette.accent[500] },
              { key: 'periode', label: 'Période', tint: palette.brand[600] },
            ]}
            value={finMode}
            onChange={handleFinModeChange}
            haptic
          />
        </View>
      </View>

      <View style={styles.financeGrid}>
        <MetricTile
          label="Recettes"
          value={compactFcfa(pnl.data?.sales.totalFcfa ?? 0)}
          sub={`${pnl.data?.sales.count ?? 0} vente(s)`}
          tone="brand"
          icon={Wallet}
          compact
          style={styles.financeTileTwo}
          onPress={toggleFinance}
        />
        <MetricTile
          label="Encaissé"
          value={compactFcfa(pnl.data?.collectedFcfa ?? 0)}
          sub="encaissé"
          tone="green"
          icon={Coins}
          compact
          style={styles.financeTileTwo}
          onPress={toggleFinance}
        />
        {finMode === 'jour' ? (
          <MetricTile
            label="Dépenses"
            value={compactFcfa(pnl.data?.expenses.totalFcfa ?? 0)}
            sub={`${pnl.data?.expenses.count ?? 0} dépense(s)`}
            tone="amber"
            icon={Receipt}
            compact
            style={styles.financeTileTwo}
            onPress={toggleFinance}
          />
        ) : (
          <MetricTile
            label="Créances"
            value={compactFcfa(pnl.data?.outstandingFcfa ?? 0)}
            sub={(pnl.data?.outstandingFcfa ?? 0) > 0 ? 'reste à encaisser' : 'tout payé'}
            tone={(pnl.data?.outstandingFcfa ?? 0) > 0 ? 'amber' : 'green'}
            icon={TrendingDown}
            compact
            style={styles.financeTileTwo}
            onPress={toggleFinance}
          />
        )}
        <MetricTile
          label="Net"
          value={compactFcfa(pnl.data?.netFcfa ?? 0)}
          sub={(pnl.data?.netFcfa ?? 0) >= 0 ? 'bénéfice' : 'déficit'}
          tone={(pnl.data?.netFcfa ?? 0) >= 0 ? 'green' : 'red'}
          icon={(pnl.data?.netFcfa ?? 0) >= 0 ? TrendingUp : TrendingDown}
          compact
          style={styles.financeTileTwo}
          onPress={toggleFinance}
        />
      </View>

      {hasCompare && (
        <View style={styles.financeCompareRow}>
          <AppText size="caption" color="faint">vs période précédente</AppText>
          {dEncaissPct != null && (
            <View style={[styles.compareChip, dEncaissPct >= 0 ? styles.compareChipUp : styles.compareChipDown]}>
              {dEncaissPct >= 0 ? <TrendingUp size={11} color={palette.green[600]} /> : <TrendingDown size={11} color={palette.red[500]} />}
              <AppText size="caption" weight="bold" color={dEncaissPct >= 0 ? palette.green[600] : palette.red[500]}>
                {dEncaissPct > 0 ? '+' : ''}{dEncaissPct.toFixed(0)}% encaissé
              </AppText>
            </View>
          )}
          {dNetPct != null && (
            <View style={[styles.compareChip, dNetPct >= 0 ? styles.compareChipUp : styles.compareChipDown]}>
              {dNetPct >= 0 ? <TrendingUp size={11} color={palette.green[600]} /> : <TrendingDown size={11} color={palette.red[500]} />}
              <AppText size="caption" weight="bold" color={dNetPct >= 0 ? palette.green[600] : palette.red[500]}>
                {dNetPct > 0 ? '+' : ''}{dNetPct.toFixed(0)}% net
              </AppText>
            </View>
          )}
        </View>
      )}

      {showFinance && (
        <Card style={styles.financeDetails}>
          <FinanceBlock title="Top produits" icon={TrendingUp}>
            {(pnl.data?.breakdown.byProduct ?? []).slice(0, 3).map((p, i) => (
              <FinanceRow key={`${p.label}-${i}`} left={`${p.label} (${fmt(p.quantity)})`} right={compactFcfa(p.amountFcfa)} />
            ))}
            {(pnl.data?.breakdown.byProduct ?? []).length === 0 && <FinanceRow left="Aucun produit vendu sur la période" right="" />}
          </FinanceBlock>

          <FinanceBlock title="Top dépenses par poste" icon={Receipt}>
            {(pnl.data?.breakdown.byExpenseCategory ?? []).slice(0, 4).map((c, i) => (
              <FinanceRow key={`${c.label}-${i}`} left={c.label} right={compactFcfa(c.amountFcfa)} />
            ))}
            {(pnl.data?.breakdown.byExpenseCategory ?? []).length === 0 && <FinanceRow left="Aucun poste de dépense sur la période" right="" />}
          </FinanceBlock>

          <FinanceBlock title="Encaissements par moyen" icon={Coins}>
            {(pnl.data?.breakdown.byPaymentMethod ?? []).map((m2) => (
              <FinanceRow key={m2.method} left={m2.label} right={compactFcfa(m2.amountFcfa)} />
            ))}
            {(pnl.data?.breakdown.byPaymentMethod ?? []).length === 0 && <FinanceRow left="Aucun encaissement sur la période" right="" />}
          </FinanceBlock>

          <FinanceBlock title="Ventes récentes" icon={PackageCheck}>
            {recentSales(salesQ.data).map((s) => (
              <FinanceRow key={s.id} left={`${s.referenceNumber} · ${s.customer?.fullName ?? 'Comptoir'}`} caption={s.saleDate} right={compactFcfa(s.totalAmountFcfa)} />
            ))}
            {recentSales(salesQ.data).length === 0 && <FinanceRow left="Aucune vente sur la période" right="" />}
          </FinanceBlock>

          <FinanceBlock title="Dépenses récentes" icon={Receipt}>
            {recentExpenses(expensesQ.data).map((exp) => (
              <FinanceRow key={exp.id} left={exp.label ?? exp.category} caption={`${exp.category} · ${exp.expenseDate}`} right={compactFcfa(exp.amountFcfa)} />
            ))}
            {recentExpenses(expensesQ.data).length === 0 && <FinanceRow left="Aucune dépense sur la période" right="" />}
          </FinanceBlock>

          <FinanceBlock title="Commandes en cours" icon={ListOrdered}>
            {openOrders(ordersQ.data).map((o) => (
              <FinanceRow
                key={o.id}
                left={`${o.referenceNumber} · ${CANAL_LABELS[o.canal]}`}
                caption={`${STATUS_LABELS[o.status]}${o.depositFcfa > 0 ? ` · acompte ${compactFcfa(o.depositFcfa)}` : ''}`}
                right={compactFcfa(o.totalAmountFcfa)}
              />
            ))}
            {openOrders(ordersQ.data).length === 0 && <FinanceRow left="Aucune commande ouverte" right="" />}
          </FinanceBlock>

          <View style={styles.financeFootnote}>
            <AppText size="caption" color="faint">Encaissé = paiements confirmés sur la période · Net = CA facturé − dépenses</AppText>
          </View>
        </Card>
      )}

      {/* ── STATS · VUE D'ENSEMBLE (panneau distinct) ── */}
      <StatsPanel summary={summary} hasAnyBatch={hasAnyBatch} filterLabel={filterLabel} />

      <CreateLotSheet visible={showCreate} onClose={() => setShowCreate(false)} />

      {/* ── FILTERS + SORT ── */}
      <View style={styles.controlLabel}>
        <AppText size="small" weight="semibold" color="muted">Filtres</AppText>
      </View>
      <View style={styles.controlRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setFilter(f.key);
              }}
              style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}>
              <AppText size="small" weight={filter === f.key ? 'bold' : 'medium'} color={filter === f.key ? 'surface' : 'muted'}>{f.label}</AppText>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setShowSort(!showSort);
          }}
          style={styles.sortToggle}>
          {sortDir === 'desc' ? <SortDesc size={16} color={color.ink[500]} /> : <SortAsc size={16} color={color.ink[500]} />}
        </Pressable>
      </View>

      {showSort && (
        <Card style={{ gap: 6, marginBottom: 8, padding: 10 }}>
          <AppText size="small" weight="bold" color="brand">Trier par</AppText>
          <View style={styles.sortGrid}>
            {SORT_OPTIONS.map((s) => (
              <Pressable key={s.key} onPress={() => { Haptics.selectionAsync().catch(() => {}); if (sortKey === s.key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc'); else { setSortKey(s.key); setSortDir('desc'); } }}
                style={[styles.sortBtn, sortKey === s.key && styles.sortBtnActive]}>
                <AppText size="small" weight={sortKey === s.key ? 'bold' : 'medium'} color={sortKey === s.key ? 'brand' : 'muted'}>{s.label}</AppText>
                {sortKey === s.key && (sortDir === 'desc' ? <SortDesc size={12} color={palette.brand[600]} /> : <SortAsc size={12} color={palette.brand[600]} />)}
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {/* ── LOT LIST ── */}
      {batches.isLoading ? (
        <Spinner label="Chargement des lots…" />
      ) : !hasAnyBatch ? (
        <LotEmptyState
          hasBuilding={hasBuilding}
          buildingsLoading={buildings.isLoading}
          onCreateLot={openCreate}
          onCreateBuilding={openCreateBuilding}
        />
      ) : (
        <View style={{ gap: 10 }}>
          {shown.map((b) => (
            <LotCardWithHealth key={b.id} batch={b} farmId={farmId} onPress={() => router.push(`/lot/${b.id}`)}
              expanded={expandedLot === b.id} onToggle={() => setExpandedLot(expandedLot === b.id ? null : b.id)} />
          ))}
          {shown.length === 0 ? (
            <EmptyState
              emoji="🐔"
              title={`Aucun lot ${filter === 'all' ? 'enregistré' : filterLabel}`}
              description={filter === 'all' ? 'Créez un lot depuis le bouton +' : 'Retirez le filtre pour afficher tous les lots.'}
            />
          ) : null}
        </View>
      )}

      <FinanceInfoSheet visible={finHelpOpen} onClose={() => setFinHelpOpen(false)} />
    </Screen>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// EMPTY STATE (no lots yet)
// ═══════════════════════════════════════════════════════════════════════

function LotEmptyState({ hasBuilding, buildingsLoading, onCreateLot, onCreateBuilding }: {
  hasBuilding: boolean; buildingsLoading: boolean; onCreateLot: () => void; onCreateBuilding: () => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Card style={{ gap: 12, padding: 16, alignItems: 'center' }}>
        <View style={styles.emptyEmojiCircle}>
          <AppText style={styles.emptyEmoji}>🐔</AppText>
        </View>
        <AppText size="body" weight="bold" color="text" style={styles.emptyTitle}>
          Aucun lot enregistré
        </AppText>
        <AppText size="small" color="muted" style={styles.emptyDesc}>
          Créez votre premier lot pour suivre les effectifs, les métriques zootechniques et les alertes de la ferme.
        </AppText>

        <View style={styles.emptySteps}>
          <EmptyStep icon={Warehouse} done={hasBuilding} label="Bâtiment" desc={hasBuilding ? 'Bâtiment disponible' : 'Un bâtiment est requis avant de créer un lot'} />
          <EmptyStep icon={Bird} done={false} label="Lot" desc="Bande de poulets à suivre" />
          <EmptyStep icon={TrendingUp} label="Métriques" desc="IC, GMQ, mortalité, ponte, alertes" />
        </View>

        {!hasBuilding && !buildingsLoading && (
          <View style={styles.emptyWarn}>
            <AlertTriangle size={14} color={palette.amber[600]} />
            <AppText size="small" color="amber" style={{ flex: 1 }}>
              Aucun bâtiment enregistré. Créez-en un d{'\u2019'}abord — il est obligatoire pour démarrer un lot.
            </AppText>
          </View>
        )}

        {hasBuilding && (
          <Button label="Créer mon premier lot" tone="brand" size="lg" icon={Plus} onPress={onCreateLot} />
        )}
        {!hasBuilding && !buildingsLoading && (
          <Button label="Créer un bâtiment" tone="brand" size="lg" icon={Building2} onPress={onCreateBuilding} />
        )}
      </Card>
    </View>
  );
}

function EmptyStep({ icon: Icon, label, desc, done }: { icon: typeof Clock; label: string; desc: string; done?: boolean }) {
  return (
    <View style={styles.emptyStep}>
      <View style={[styles.emptyStepIcon, done && styles.emptyStepIconDone]}>
        <Icon size={16} color={done ? palette.green[600] : color.ink[500]} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText size="small" weight="semibold" color={done ? 'success' : 'text'}>
          {done ? `${label} ✓` : label}
        </AppText>
        <AppText size="small" color="faint">{desc}</AppText>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LOT CARD WITH HEALTH
// ═══════════════════════════════════════════════════════════════════════

function LotCardWithHealth({ batch, farmId, onPress, expanded, onToggle }: {
  batch: BatchWithMetrics; farmId: string; onPress: () => void; expanded: boolean; onToggle: () => void;
}) {
  const healthQ = useQuery({
    queryKey: ['batch-health', farmId, batch.id],
    queryFn: () => fetchBatchHealth(farmId, batch.id),
    staleTime: 60_000,
  });
  const pnlQ = useQuery({
    queryKey: ['rentabilite-batch', farmId, batch.id],
    queryFn: () => fetchRentabiliteBatch(farmId, batch.id),
    enabled: expanded,
    staleTime: 60_000,
  });
  return <LotCard batch={batch} health={healthQ.data} pnl={pnlQ.data} onPress={onPress} expanded={expanded} onToggle={onToggle} />;
}

// ═══════════════════════════════════════════════════════════════════════
// LOT CARD
// ═══════════════════════════════════════════════════════════════════════

function LotCard({ batch, health, pnl, onPress, expanded, onToggle }: {
  batch: BatchWithMetrics; health?: BatchHealth; pnl?: BatchPnl; onPress: () => void; expanded: boolean; onToggle: () => void;
}) {
  const m = batch.metrics;
  const isLayer = batch.type === 'PONDEUSE';
  const spec = batch.species ?? 'POULET';
  const customName = spec === 'AUTRE' && batch.customSpecies ? batch.customSpecies : null;
  const specShort = customName ?? speciesLabel(spec);
  const speciesIcon = SPECIES_ICONS[spec] ?? (isLayer ? '🥚' : '🐔');
  const badgeLabel = `${speciesIcon} ${specShort} · ${isLayer ? 'Pondeuse' : 'Chair'}`;
  const cycleDays = isLayer ? LAYER_CYCLE_DAYS : CHAIR_CYCLE_DAYS;
  const ageProgress = Math.min(100, (m.ageDays / cycleDays) * 100);
  const isNewLot = m.ageDays <= 14; // < 2 weeks -> "Nouveau"

  // Health score color
  const healthScore = health?.healthScore ?? null;
  const healthColor = healthScore != null ? (healthScore >= 80 ? palette.green[600] : healthScore >= 60 ? palette.amber[500] : palette.red[500]) : color.ink[300];

  // Status indicator
  const statusColor = m.status === 'VERT' ? palette.green[500] : m.status === 'JAUNE' ? palette.amber[500] : palette.red[500];

  // Readiness
  const readyTone = m.readyReason === 'READY' ? palette.green[600] : m.readyReason === 'SANITARY' ? palette.red[500] : m.readyReason === 'FCR' ? palette.amber[500] : color.ink[400];
  const readyLabel = READY_REASON_LABELS[m.readyReason];

  // Production stage
  const stage = batchStage(batch);

  return (
    <Card onPress={onPress} padding={false} style={styles.lotCard}>
      {/* ── TOP ROW: Status dot + Type badge + Name + Health score ── */}
      <View style={styles.lotTopRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={[styles.typeBadge, { backgroundColor: isLayer ? color.green[50] : color.brand[50] }]}>
          <AppText size="small" weight="bold" color={isLayer ? 'success' : 'brand'}>
            {badgeLabel}
          </AppText>
        </View>
        {isNewLot && (
          <View style={styles.newBadge}>
            <AppText size="small" weight="bold" color="accent">Nouveau</AppText>
          </View>
        )}
        {m.readyForSale && m.readyReason === 'READY' && (
          <View style={styles.readyBadge}>
            <AppText size="small" weight="bold" color="surface">Prêt ✓</AppText>
          </View>
        )}
        {m.readyReason === 'FCR' && (
          <View style={[styles.readyBadgeAlert, { backgroundColor: palette.amber[500] }]}>
            <AppText size="small" weight="bold" color="surface">IC élevé</AppText>
          </View>
        )}
        {m.readyReason === 'SANITARY' && (
          <View style={[styles.readyBadgeAlert, { backgroundColor: palette.red[500] }]}>
            <AppText size="small" weight="bold" color="surface">Sanitaire</AppText>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText size="body" weight="bold" color="text" numberOfLines={1}>{batch.batchName ?? 'Lot'}</AppText>
          <View style={styles.metaChips}>
            <MetaChip label={stage.label} tone={stage.tone} />
            {batch.breedName != null && <MetaChip label={batch.breedName} />}
            <MetaChip label={`J${m.ageDays}`} />
            {batch.status !== 'EN_VENTE' && <MetaChip label={batch.status === 'ACTIF' ? 'Actif' : batch.status} tone="muted" />}
          </View>
        </View>
        {healthScore != null && (
          <View style={[styles.healthBadge, { backgroundColor: healthColor + '18', borderColor: healthColor + '40' }]}>
            <HeartPulse size={12} color={healthColor} />
            <AppText size="small" weight="bold" color={healthColor}>{healthScore}</AppText>
          </View>
        )}
        {m.alerts > 0 && (
          <View style={styles.alertBadge}>
            <AlertTriangle size={12} color={palette.amber[600]} />
            <AppText size="small" weight="bold" color="amber">{m.alerts}</AppText>
          </View>
        )}
      </View>

      {/* ── PROGRESS BAR: Age vs Cycle ── */}
      <View style={styles.progressWrap}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${ageProgress}%`, backgroundColor: statusColor }]} />
        </View>
        <AppText size="small" color="faint">J{m.ageDays} / {cycleDays}j ({ageProgress.toFixed(0)}%)</AppText>
      </View>

      {/* ── PRIMARY METRICS ROW ── */}
      <View style={styles.metricRow}>
        <MetricBlock label="Vivants" value={fmt(m.liveCount)} icon={Bird} tone="brand" />
        <MetricBlock label="Mortalité" value={`${m.mortalityPercent.toLocaleString('fr-FR')} %`} icon={HeartPulse}
          tone={m.mortalityPercent > 1.5 ? 'red' : m.mortalityPercent > 0.8 ? 'amber' : 'green'} />
        {isLayer ? (
          <MetricBlock label="Ponte" value={m.layRatePercent != null ? `${m.layRatePercent.toLocaleString('fr-FR')} %` : '—'} icon={Egg} tone="accent" />
        ) : (
          <MetricBlock label="IC" value={m.fcr != null && m.fcr > 0 ? m.fcr.toLocaleString('fr-FR') : '—'} icon={Scale}
            tone={m.fcr != null && m.fcr > 0 ? (m.fcr <= 2.0 ? 'green' : m.fcr <= 2.5 ? 'amber' : 'red') : 'brand'} />
        )}
      </View>

      {/* ── SECONDARY METRICS ROW (always visible) ── */}
      <View style={styles.metricRow}>
        {isLayer ? (
          <>
            <MetricBlock label="Plateaux" value={health ? `${health.trays}` : '—'} icon={Egg} tone="accent" />
            <MetricBlock label="Œufs" value={m.eggsCollectedTotal > 0 ? fmt(m.eggsCollectedTotal) : '—'} icon={Egg} tone="brand" />
            <MetricBlock label="Alim/oiseau" value={health && health.feedPerBirdGrams > 0 ? `${health.feedPerBirdGrams} g/j` : '—'} icon={Wheat} tone="brand" />
          </>
        ) : (
          <>
            <MetricBlock label="Alim/oiseau" value={health && health.feedPerBirdGrams > 0 ? `${health.feedPerBirdGrams} g/j` : '—'} icon={Wheat} tone="brand" />
            <MetricBlock label="GMQ" value={m.gmqGramsPerDay ? `${m.gmqGramsPerDay} g` : '—'} icon={TrendingUp} tone="brand" />
          </>
        )}
      </View>

      {/* ── EXPANDED: Additional indicators ── */}
      {expanded && (
        <View style={styles.expandedSection}>
          <View style={styles.divider} />

          {/* Secondary metrics */}
          <View style={styles.secondaryGrid}>
            <SecondaryMetric label="IPE" value={m.ipe != null ? m.ipe.toLocaleString('fr-FR') : '—'} icon={Activity} />
            <SecondaryMetric label="Viabilité" value={`${m.viabilityPercent.toLocaleString('fr-FR')} %`} icon={HeartPulse} />
            <SecondaryMetric label="Aliment" value={m.totalFeedKg > 0 ? `${m.totalFeedKg.toLocaleString('fr-FR')} kg` : '—'} icon={Wheat} />
            <SecondaryMetric label="Densité" value={m.densityPerM2 ? `${m.densityPerM2.toFixed(1)}/m²` : '—'} icon={Layers} />
            <SecondaryMetric label="Pertes" value={m.totalWeightGainKg ? `${m.totalWeightGainKg.toLocaleString('fr-FR')} kg` : '—'} icon={TrendingDown} />
            {isLayer && <SecondaryMetric label="Œufs" value={m.eggsCollectedTotal ? fmt(m.eggsCollectedTotal) : '—'} icon={Egg} />}
          </View>

          {/* Health-specific metrics */}
          {health && (
            <>
              <View style={styles.divider} />
              <View style={styles.secondaryGrid}>
                <SecondaryMetric label="Eau/oiseau" value={health.waterLPerBird ? `${health.waterLPerBird} L/j` : '—'} icon={Droplets} />
                <SecondaryMetric label="Morts sem." value={`${m.totalDeaths}`} icon={HeartPulse} />
                {health.healthScore != null && (
                  <SecondaryMetric label="Score santé" value={`${health.healthScore}/100`} icon={Stethoscope} />
                )}
              </View>
            </>
          )}

          {/* Health tips */}
          {health && health.tips.length > 0 && (
            <>
              <View style={styles.divider} />
              {health.tips.slice(0, 2).map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  {tip.level === 'ROUGE' ? <AlertTriangle size={12} color={palette.red[500]} /> : tip.level === 'JAUNE' ? <Info size={12} color={palette.amber[500]} /> : null}
                  <AppText size="small" color={tip.level === 'ROUGE' ? 'danger' : tip.level === 'JAUNE' ? 'amber' : 'muted'} style={{ flex: 1 }}>{tip.text}</AppText>
                </View>
              ))}
            </>
          )}

          {/* Commercialisation signal */}
          <View style={styles.divider} />
          <View style={styles.readyLine}>
            <AppText size="small" weight="bold" color="brand">Commercialisation</AppText>
          </View>
          <View style={styles.tipRow}>
            {m.readyForSale && m.readyReason === 'READY'
              ? <PackageCheck size={12} color={palette.green[600]} />
              : m.readyReason === 'SANITARY'
                ? <AlertTriangle size={12} color={palette.red[500]} />
                : m.readyReason === 'FCR'
                  ? <Info size={12} color={palette.amber[500]} />
                  : <Clock size={12} color={color.ink[400]} />}
            <AppText size="small" weight="semibold" color={readyTone} style={{ flex: 1 }}>{readyLabel}</AppText>
          </View>
          {m.readyForSale && batch.readyForSaleAt && (
            <View style={styles.tipRow}>
              <CalendarDays size={12} color={palette.green[600]} />
              <AppText size="small" color="muted">Disponible depuis le {dateFr(batch.readyForSaleAt)}</AppText>
            </View>
          )}

          {/* Per-lot P&L */}
          {pnl && (
            <>
              <View style={styles.divider} />
              <View style={styles.pnlHeader}>
                <AppText size="small" weight="bold" color="brand">Résultat du lot</AppText>
                <AppText size="caption" color="faint">{fmt(pnl.birdsSold)} oiseau(x) · {fmt(pnl.kgSold)} kg · {fmt(pnl.eggsSold)} œuf(s)</AppText>
              </View>
              <View style={styles.financeStatRow}>
                <FinanceStat label="Revenus" value={compactFcfa(pnl.revenueFcfa)} />
                <FinanceStat label="Coûts" value={compactFcfa(pnl.expensesFcfa)} />
                <FinanceStat label="Net" value={compactFcfa(pnl.netFcfa)} positive={pnl.netFcfa >= 0} />
                {pnl.marginPct != null && <FinanceStat label="Marge" value={`${pnl.marginPct.toLocaleString('fr-FR')} %`} />}
              </View>
              {pnl.costPerKgFcfa != null && (
                <View style={styles.tipRow}>
                  <AppText size="small" color="faint">Coût de revient : {pnl.costPerKgFcfa.toLocaleString('fr-FR')} FCFA/kg</AppText>
                </View>
              )}
              {(pnl.enrichment.chickCostFcfa != null || pnl.enrichment.feedLotsCostFcfa != null) && (
                <View style={styles.tipRow}>
                  <AppText size="small" color="faint" style={{ flex: 1 }}>
                    Dont intrants : poussins {compactFcfa(pnl.enrichment.chickCostFcfa ?? 0)} · aliments {compactFcfa(pnl.enrichment.feedLotsCostFcfa ?? 0)}
                  </AppText>
                </View>
              )}
              {pnl.breakdown.byProduct.length > 0 && (
                <>
                  <View style={styles.divider} />
                  <AppText size="small" weight="bold" color="muted">Ventes par produit</AppText>
                  {pnl.breakdown.byProduct.map((p, i) => (
                    <FinanceRow key={`${p.label}-${i}`} left={`${p.label} (${fmt(p.quantity)})`} right={compactFcfa(p.amountFcfa)} />
                  ))}
                </>
              )}
              {pnl.breakdown.byExpenseCategory.length > 0 && (
                <>
                  <View style={styles.divider} />
                  <AppText size="small" weight="bold" color="muted">Dépenses par poste</AppText>
                  {pnl.breakdown.byExpenseCategory.map((c, i) => (
                    <FinanceRow key={`${c.label}-${i}`} left={c.label} right={compactFcfa(c.amountFcfa)} />
                  ))}
                </>
              )}
            </>
          )}
        </View>
      )}

      {/* ── BOTTOM: Expand toggle + density + feed ── */}
      <Pressable onPress={onToggle} style={styles.lotBottom}>
        <AppText size="small" color="faint">
          {m.densityPerM2 ? `${m.densityPerM2.toFixed(1)}/m²` : ''}
          {m.totalFeedKg > 0 ? ` · ${m.totalFeedKg.toLocaleString('fr-FR')} kg` : ''}
        </AppText>
        <AppText size="small" color="brand" weight="semibold">
          {expanded ? 'Moins ▲' : 'Plus ▼'}
        </AppText>
      </Pressable>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function MetaChip({ label, tone = 'brand' }: { label: string; tone?: 'brand' | 'accent' | 'green' | 'amber' | 'muted' }) {
  const dot = tone === 'accent' ? palette.accent[500] : tone === 'green' ? palette.green[600] : tone === 'amber' ? palette.amber[500] : tone === 'muted' ? color.ink[300] : palette.brand[500];
  return (
    <View style={styles.metaChip}>
      <View style={[styles.metaChipDot, { backgroundColor: dot }]} />
      <AppText size="small" weight="medium" color="muted">{label}</AppText>
    </View>
  );
}

function PanelCell({ value, label, icon: Icon, tone }: { value: string; label: string; icon: typeof Clock; tone: 'brand' | 'accent' | 'green' | 'red' | 'amber' | 'muted' }) {
  const fg = tone === 'accent' ? palette.accent[500] : tone === 'red' ? palette.red[500] : tone === 'amber' ? palette.amber[500] : tone === 'green' ? palette.green[600] : tone === 'muted' ? color.ink[400] : palette.brand[600];
  const bg = tone === 'accent' ? palette.accent[50] : tone === 'red' ? palette.red[50] : tone === 'amber' ? palette.amber[50] : tone === 'green' ? palette.green[50] : tone === 'muted' ? palette.ink[100] : palette.brand[50];
  return (
    <View style={styles.panelCell}>
      <View style={[styles.panelCellIcon, { backgroundColor: bg }]}>
        <Icon size={14} color={fg} />
      </View>
      <View style={styles.panelCellText}>
        <AppText size="body" weight="bold" color={fg} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</AppText>
        <AppText size="caption" color="muted" numberOfLines={1}>{label}</AppText>
      </View>
    </View>
  );
}

type OverviewSummary = {
  totalBirds: number;
  avgAgeDays: number;
  avgFcr: number | null;
  avgLayRate: number | null;
  count: number;
  activeCount: number;
  sellingCount: number;
  avgMortality: number;
  totalEggs: number;
  speciesGroups: { label: string; birds: number }[];
  chairBirds: number;
  layerBirds: number;
} | null;

function StatsPanel({ summary, hasAnyBatch, filterLabel }: { summary: OverviewSummary; hasAnyBatch: boolean; filterLabel: string }) {
  return (
    <Card tone="brand" style={styles.statsCard}>
      <View style={styles.financeHeaderRow}>
        <View style={styles.panelHeaderLeft}>
          <View style={styles.panelHeaderIcon}>
            <Activity size={14} color={palette.brand[600]} />
          </View>
          <AppText size="small" weight="bold" color="brand">Vue d’ensemble</AppText>
        </View>
        {summary != null && (
          <AppText size="caption" color="muted">{summary.count} lot(s) · {fmt(summary.totalBirds)} oiseau(x)</AppText>
        )}
      </View>

      {summary != null ? (
        <>
          <View style={styles.panelCellGrid}>
            <PanelCell value={fmt(summary.totalBirds)} label="Vivants" icon={Bird} tone="brand" />
            <PanelCell value={`${Math.round(summary.avgAgeDays)} j`} label="Âge moy." icon={Clock} tone="brand" />
            <PanelCell value={summary.chairBirds > 0 ? fmt(summary.chairBirds) : '—'} label="Chair" icon={Bird} tone="brand" />
            <PanelCell value={summary.layerBirds > 0 ? fmt(summary.layerBirds) : '—'} label="Ponte" icon={Egg} tone="accent" />
            <PanelCell
              value={summary.avgFcr != null ? summary.avgFcr.toLocaleString('fr-FR') : '—'}
              label="IC moy." icon={Scale}
              tone={summary.avgFcr != null ? (summary.avgFcr > 2.5 ? 'red' : summary.avgFcr > 2.0 ? 'amber' : 'green') : 'muted'}
            />
            {summary.avgLayRate != null && (
              <PanelCell value={`${summary.avgLayRate.toLocaleString('fr-FR')}%`} label="Ponte moy." icon={Egg} tone="accent" />
            )}
          </View>

          {summary.speciesGroups.length > 0 && (
            <View style={styles.speciesSection}>
              <AppText size="small" weight="bold" color="muted">Espèce</AppText>
              <View style={styles.speciesGrid}>
                {summary.speciesGroups.map((g) => (
                  <View key={g.label} style={styles.speciesCell}>
                    <AppText size="small" weight="semibold" color="text" numberOfLines={1}>{g.label}</AppText>
                    <AppText size="body" weight="bold" color={palette.brand[600]}>{fmt(g.birds)}</AppText>
                  </View>
                ))}
              </View>
            </View>
          )}
          <View style={styles.bandRow}>
            <BandChip label={`${summary.activeCount} actif(s)`} />
            {summary.sellingCount > 0 && <BandChip label={`${summary.sellingCount} en vente`} />}
            <BandChip label={`Mortalité ${summary.avgMortality.toLocaleString('fr-FR')}%`} />
            {summary.totalEggs > 0 && <BandChip label={`Œufs ${fmt(summary.totalEggs)}`} />}
          </View>
        </>
      ) : (
        <View style={styles.statsEmpty}>
          <AppText size="small" color="faint">
            {hasAnyBatch ? `Aucun lot dans le filtre « ${filterLabel} »` : 'Aucun lot créé pour l’instant'}
          </AppText>
          <AppText size="caption" color="faint">Les indicateurs moyens apparaîtront ici dès qu’un lot est suivi.</AppText>
        </View>
      )}
    </Card>
  );
}

function MetricBlock({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Clock; tone: string }) {
  const fg = tone === 'red' ? palette.red[500] : tone === 'amber' ? palette.amber[500] : tone === 'green' ? palette.green[600] : tone === 'accent' ? palette.accent[500] : palette.brand[600];
  const bg = tone === 'red' ? palette.red[50] : tone === 'amber' ? palette.amber[50] : tone === 'green' ? palette.green[50] : tone === 'accent' ? palette.accent[50] : palette.brand[50];
  return (
    <View style={[styles.metricBlock, { backgroundColor: bg }]}>
      <Icon size={14} color={fg} />
      <AppText size="body" weight="bold" color={fg}>{value}</AppText>
      <AppText size="small" color="muted">{label}</AppText>
    </View>
  );
}

function SecondaryMetric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <View style={styles.secondaryMetric}>
      <Icon size={12} color={color.ink[400]} />
      <View>
        <AppText size="small" weight="semibold" color="text">{value}</AppText>
        <AppText size="small" color="faint">{label}</AppText>
      </View>
    </View>
  );
}

function BandChip({ label }: { label: string }) {
  return (
    <View style={styles.bandChip}>
      <AppText size="caption" color="muted">{label}</AppText>
    </View>
  );
}

function FinanceStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const fg = positive == null ? color.ink[700] : positive ? palette.green[600] : palette.red[500];
  return (
    <View style={styles.financeStat}>
      <AppText size="body" weight="bold" color={fg}>{value}</AppText>
      <AppText size="caption" color="muted">{label}</AppText>
    </View>
  );
}

function FinanceRow({ left, right, caption }: { left: string; right: string; caption?: string }) {
  return (
    <View style={styles.financeItemRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText size="small" color="text" numberOfLines={1}>{left}</AppText>
        {caption ? <AppText size="caption" color="faint" numberOfLines={1}>{caption}</AppText> : null}
      </View>
      <AppText size="small" weight="bold" color="text">{right}</AppText>
    </View>
  );
}

function FinanceBlock({ title, icon: Icon, children }: { title: string; icon: typeof Wallet; children: React.ReactNode }) {
  return (
    <View style={styles.financeBlock}>
      <View style={styles.financeBlockTitle}>
        <Icon size={13} color={palette.brand[600]} />
        <AppText size="small" weight="bold" color="brand">{title}</AppText>
      </View>
      <View style={{ gap: 4 }}>{children}</View>
    </View>
  );
}

function FinanceInfoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title='Lire la Finance' onClose={onClose}>
      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <AppText size='label' weight='bold' color='brand'>Aujourd&apos;hui vs Période</AppText>
          <AppText size='body' color='muted'>
            Le mode « Aujourd&apos;hui » affiche les chiffres du jour affiché dans la barre de date en haut. Le mode « Période » totalise sur la fenêtre choisie (7, 30, 90 jours, ou un intervalle « Du … au … »).
          </AppText>
        </View>
        <View style={{ gap: 6 }}>
          <AppText size='label' weight='bold' color='brand'>Les indicateurs</AppText>
          <AppText size='small' color='text'>• Recettes : ventes facturées pour la période choisie.</AppText>
          <AppText size='small' color='text'>• Encaissé : argent réellement reçu en caisse.</AppText>
          <AppText size='small' color='text'>• Dépenses : charges engagées (aliment, soins, opérations…).</AppText>
          <AppText size='small' color='text'>• Créances : ventes non encore payées — toujours globales, quelle que soit la période (tout ce que vos clients vous doivent).</AppText>
          <AppText size='small' color='text'>• Net : Recettes − dépenses. Positif = bénéfice, négatif = déficit.</AppText>
        </View>
        <View style={{ gap: 6 }}>
          <AppText size='label' weight='bold' color='brand'>Comparaison</AppText>
          <AppText size='small' color='muted'>
            Les badges « vs période précédente » comparent la même fenêtre juste avant (hier en mode Aujourd&apos;hui, la fenêtre précédente de même longueur en mode Période).
          </AppText>
        </View>
      </View>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  headerLogo: {
    width: 38,
    height: 38,
  },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: palette.brand[600], borderRadius: radii.pill,
    paddingHorizontal: 12, paddingVertical: 6,
  },

  // Stats tiles (ferme)
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
    marginTop: 12,
  },
  metricTileFour: { flexBasis: '22%', flexGrow: 1, flexShrink: 1 },

  // Stats panel (Vue d'ensemble)
  statsCard: { gap: 10, marginTop: 16, marginBottom: 8 },
  statsEmpty: { alignItems: 'center', gap: 2, paddingVertical: 8 },
  panelHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  panelHeaderIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: palette.brand[50], alignItems: 'center', justifyContent: 'center' },
  panelCellGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  panelCell: { flexBasis: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  panelCellIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  panelCellText: { flex: 1, gap: 0, minWidth: 0 },
  bandRow: { flexBasis: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bandChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: palette.surfaceAlt },
  speciesSection: { gap: 6 },
  speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  speciesCell: { flexBasis: '46%', flexGrow: 1, gap: 1, minWidth: 0 },

  // Controls
  controlLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, marginBottom: 4 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  filterScrollView: { flex: 1 },
  filterScroll: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: palette.surfaceAlt },
  filterBtnActive: { backgroundColor: palette.brand[600] },
  sortToggle: { padding: 8, borderRadius: radii.md, backgroundColor: palette.surfaceAlt },

  // Sort
  sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.md, backgroundColor: palette.surfaceAlt },
  sortBtnActive: { backgroundColor: palette.brand[50], borderWidth: 1, borderColor: palette.brand[200] },

  // Lot card
  lotCard: { padding: 14, gap: 8 },
  lotTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  newBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: palette.accent[50], borderWidth: 1, borderColor: palette.accent[200] },
  metaChips: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: color.surfaceAlt },
  metaChipDot: { width: 5, height: 5, borderRadius: 3 },
  healthBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: palette.amber[50], borderWidth: 1, borderColor: palette.amber[200] },

  // Progress bar
  progressWrap: { gap: 3 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: palette.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  // Metrics
  metricRow: { flexDirection: 'row', gap: 6 },
  metricBlock: { flex: 1, alignItems: 'center', gap: 2, padding: 8, borderRadius: radii.md },

  // Expanded
  expandedSection: { gap: 8 },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: 2 },
  secondaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondaryMetric: { flexDirection: 'row', alignItems: 'center', gap: 4, flexBasis: '45%' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },

  // Finance section (4 cartes + détail)
  financeHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  financeHeadPressed: { opacity: 0.85 },
  financeHeadIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: palette.brand[50], alignItems: 'center', justifyContent: 'center' },
  financeHelpBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: palette.brand[50],
    borderWidth: 1, borderColor: palette.brand[200],
    alignItems: 'center', justifyContent: 'center',
  },
  financeHelpBtnPressed: { opacity: 0.7 },
  financeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  financeTileTwo: { flexBasis: '46%', flexGrow: 1, flexShrink: 1 },
  financeModeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6, marginBottom: 2 },
  financeModeControl: { width: 172 },
  financeCompareRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  compareChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radii.pill, borderWidth: 1,
  },
  compareChipUp: { backgroundColor: palette.green[50], borderColor: palette.green[200] },
  compareChipDown: { backgroundColor: palette.red[50], borderColor: palette.red[200] },
  financeDetails: { gap: 10, marginBottom: 8, padding: 12 },
  financeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  financeFootnote: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 8 },
  financeStatRow: { flexDirection: 'row', gap: 8 },
  financeStat: { flex: 1, alignItems: 'center', gap: 1, padding: 8, borderRadius: radii.md, backgroundColor: palette.surfaceAlt },
  financeBlock: { gap: 6 },
  financeBlockTitle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  financeItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Readiness
  readyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: palette.green[600] },
  readyBadgeAlert: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  readyLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pnlHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Bottom
  lotBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 8 },

  // Empty state
  emptyEmojiCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: palette.brand[50],
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: { textAlign: 'center' },
  emptyDesc: { textAlign: 'center', lineHeight: 18 },
  emptySteps: { alignSelf: 'stretch', gap: 8, marginTop: 4 },
  emptyStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyStepIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyStepIconDone: { backgroundColor: palette.green[50] },
  emptyWarn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: palette.amber[50],
    borderWidth: 1, borderColor: palette.amber[200],
    borderRadius: radii.md,
    padding: 10,
    alignSelf: 'stretch',
  },
});
