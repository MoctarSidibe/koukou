import React, { useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  DollarSign,
  Droplets,
  Egg,
  FileText,
  HeartPulse,
  Info,
  Layers,
  Percent,
  Pill,
  Scale,
  Stethoscope,
  Syringe,
  Target,
  TrendingDown,
  TrendingUp,
  Warehouse,
  Weight,
  Wheat,
} from 'lucide-react-native';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { MetricTile } from '@/components/ui/MetricTile';
import { Segmented } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { LineChart } from '@/components/ui/LineChart';
import { FCRGauge } from '@/components/ui/FCRGauge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Button } from '@/components/ui/Button';
import { AlertCard } from '@/components/AlertCard';
import { useQuickCapture } from '@/components/capture/QuickCaptureProvider';
import { useAuth } from '@/auth/AuthContext';
import { color, palette, radii, fmt, fmtFcfa } from '@/constants/theme';
import { SPECIES_IMAGES } from '@/constants/speciesImages';
import {
  fetchAdvisory,
  fetchBatch,
  fetchBatchHealth,
  fetchBreedStandards,
  fetchCurve,
  fetchDashboard,
  fetchFeedStock,
  fetchHealthEvents,
  fetchPondage,
  fetchProphylaxis,
  fetchRentabiliteBatch,
  fetchTreatments,
} from '@/api';
import { downloadPdf } from '@/api/pdf';
import type {
  BatchPnl,
  BatchWithMetrics,
  BreedStandard,
  BreedStatus,
  CurveWeek,
  FeedLotStock,
  HealthEvent,
  PondageSummary,
  ProphylaxisEvent,
  TreatmentRecord,
} from '@/api/types';
import { SPECIES_LABELS } from '@/api/format';

// ── Tabs ──
type MainTab = 'overview' | 'curves' | 'history' | 'health';
const MAIN_TABS: { key: MainTab; label: string; icon: typeof Clock }[] = [
  { key: 'overview', label: 'Vue', icon: Layers },
  { key: 'curves', label: 'Courbes', icon: Activity },
  { key: 'history', label: 'Historique', icon: Clock },
  { key: 'health', label: 'Sanitaire', icon: HeartPulse },
];

// ── Date range presets ──
type DatePreset = '7d' | '30d' | 'all' | 'custom';
const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: 'all', label: 'Tout' },
  { key: 'custom', label: 'Choisir…' },
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── History filter ──
type HistoryFilter = 'all' | 'entries' | 'treatments' | 'health';
const HISTORY_FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'entries', label: 'Saisies' },
  { key: 'treatments', label: 'Soins' },
  { key: 'health', label: 'Santé' },
];

// ── Legend ──
const LEGEND: { key: string; label: string; explain: string }[] = [
  { key: 'ic', label: 'Indice de Consommation (IC)', explain: "kg d'aliment consommé pour produire 1 kg de poids vif. Plus il est bas, plus le lot est efficace." },
  { key: 'gmq', label: 'Gain Moyen Quotidien (GMQ)', explain: 'Grammes pris par oiseau et par jour. Il mesure la vitesse de croissance.' },
  { key: 'ipe', label: 'Indice de Performance Européen (IPE)', explain: 'Score global combinant viabilité, croissance et IC.' },
  { key: 'viab', label: 'Viabilité', explain: "Pourcentage d'oiseaux toujours vivants par rapport au départ." },
  { key: 'ponte', label: 'Taux de ponte', explain: 'Œufs pondus par poule et par jour, en pourcentage.' },
];

const CARE_LABEL: Record<string, string> = {
  VACCIN: 'Vaccin', MEDICAMENT: 'Médicament', VITAMINE: 'Vitamine', ANTIBIOTIQUE: 'Antibiotique', AUTRE: 'Autre',
};
const HEALTH_KIND_LABEL: Record<string, string> = {
  MALADIE: 'Maladie', MORTALITE: 'Mortalité', REFORME: 'Abattage', SYMPTOME: 'Symptôme', VISITE_VETO: 'Visite veto', AUTRE: 'Autre',
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function LotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const batchId = String(id ?? '');
  const { openDaily, openSale } = useQuickCapture();
  const { mode, farmId } = useAuth();

  // ── Queries ──
  const batchQ = useQuery({ queryKey: ['batch', farmId, batchId], queryFn: () => fetchBatch(farmId, batchId), enabled: !!batchId });
  const curveQ = useQuery({ queryKey: ['curve', farmId, batchId], queryFn: () => fetchCurve(farmId, batchId), enabled: !!batchId });
  const advisoryQ = useQuery({ queryKey: ['advisory', farmId], queryFn: () => fetchAdvisory(farmId) });
  const healthQ = useQuery({ queryKey: ['batch-health', farmId, batchId], queryFn: () => fetchBatchHealth(farmId, batchId), enabled: !!batchId });
  const treatmentsQ = useQuery({ queryKey: ['treatments', farmId, batchId], queryFn: () => fetchTreatments(farmId, batchId), enabled: !!batchId });
  const prophylaxisQ = useQuery({ queryKey: ['prophylaxis', farmId, batchId], queryFn: () => fetchProphylaxis(farmId, batchId), enabled: !!batchId });
  const healthEventsQ = useQuery({ queryKey: ['health-events', farmId, batchId], queryFn: () => fetchHealthEvents(farmId, batchId), enabled: !!batchId });

  // ── New queries for lot metrics ──
  const rentabQ = useQuery({ queryKey: ['rentabilite-batch', farmId, batchId], queryFn: () => fetchRentabiliteBatch(farmId, batchId), enabled: !!batchId });
  const feedStockQ = useQuery({ queryKey: ['feed-stock', farmId], queryFn: () => fetchFeedStock(farmId) });
  const dashboardQ = useQuery({ queryKey: ['dashboard', farmId], queryFn: () => fetchDashboard(farmId) });

  // ── State ──
  const [mainTab, setMainTab] = useState<MainTab>('overview');
  const [curveTab, setCurveTab] = useState<'weight' | 'fcr' | 'water' | 'mortality' | 'eggs'>('weight');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState<Date>(daysAgo(30));
  const [customTo, setCustomTo] = useState<Date>(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const b = batchQ.data;
  const m = b?.metrics;
  const isLayer = b?.type === 'PONDEUSE';

  const pondageQ = useQuery({ queryKey: ['pondage', farmId, batchId], queryFn: () => fetchPondage(farmId, batchId), enabled: !!batchId && isLayer });

  // ── Derived lot metrics ──
  const breedStatus: BreedStatus | null = useMemo(() => {
    const row = dashboardQ.data?.healthOverview?.find((r) => r.batchId === batchId);
    return row?.breedStatus ?? null;
  }, [dashboardQ.data, batchId]);

  const breedIdForStandards = breedStatus?.breedId ?? null;
  const standardsQ = useQuery({
    queryKey: ['breed-standards', breedIdForStandards],
    queryFn: () => fetchBreedStandards(breedIdForStandards!),
    enabled: !!breedIdForStandards,
  });

  // ── Cycle progress (week X / Y from breed standards) ──
  const cycleInfo = useMemo(() => {
    const std: BreedStandard[] = standardsQ.data ?? [];
    const age = m?.ageDays ?? 0;
    const totalWeeks = std.length > 0 ? Math.max(...std.map((s) => s.week)) : isLayer ? 72 : 12;
    const currentWeek = Math.min(Math.max(Math.ceil(age / 7), 1), totalWeeks);
    const pct = Math.min(100, (age / (totalWeeks * 7)) * 100);
    return { currentWeek, totalWeeks, pct };
  }, [standardsQ.data, m?.ageDays, isLayer]);

  const lotFeedLots: FeedLotStock[] = useMemo(() => {
    return (feedStockQ.data?.lots ?? []).filter((l) => l.batchId === batchId);
  }, [feedStockQ.data, batchId]);

  const pnl: BatchPnl | null = rentabQ.data ?? null;
  const pondage: PondageSummary | null = pondageQ.data ?? null;

  // ── Water consumption (from weekly curve data) ──
  const waterSummary = useMemo(() => {
    const weeks = curveQ.data?.weekly ?? [];
    const totalWater = weeks.reduce((s, w) => s + (w.waterL || 0), 0);
    const current = weeks[0];
    const previous = weeks[1];
    let deltaPct: number | null = null;
    if (current && previous && previous.waterL > 0) {
      deltaPct = ((current.waterL - previous.waterL) / previous.waterL) * 100;
    }
    return { totalWater, currentWeekL: current?.waterL ?? 0, deltaPct };
  }, [curveQ.data]);

  // ── Date filtering ──
  const dateRange = useMemo(() => {
    if (datePreset === '7d') return { from: daysAgo(7), to: new Date() };
    if (datePreset === '30d') return { from: daysAgo(30), to: new Date() };
    if (datePreset === 'custom') return { from: customFrom, to: customTo };
    return { from: null, to: null }; // 'all'
  }, [datePreset, customFrom, customTo]);

  const fmtDateShort = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  // ── Filtered curve data ──
  const filteredWeekly = useMemo(() => {
    const weeks = curveQ.data?.weekly ?? [];
    if (!dateRange.from) return weeks;
    return weeks.filter((w) => {
      const d = new Date(w.weekStart);
      return d >= dateRange.from! && d <= dateRange.to!;
    });
  }, [curveQ.data, dateRange]);

  const labelDay = (ws: string) => ws.slice(5).replace('-', '/');

  const weightPoints = useMemo(() => filteredWeekly.filter((w) => w.avgWeightKg != null).map((w) => ({ x: labelDay(w.weekStart), y: w.avgWeightKg! })), [filteredWeekly]);
  const fcrPoints = useMemo(() => filteredWeekly.filter((w) => w.fcrCumulative != null).map((w) => ({ x: labelDay(w.weekStart), y: w.fcrCumulative! })), [filteredWeekly]);
  const waterPoints = useMemo(() => filteredWeekly.filter((w) => w.waterL > 0).map((w) => ({ x: labelDay(w.weekStart), y: w.waterL })), [filteredWeekly]);
  const mortalityPoints = useMemo(() => filteredWeekly.filter((w) => w.deaths >= 0).map((w) => ({ x: labelDay(w.weekStart), y: w.deaths })), [filteredWeekly]);
  const eggsPoints = useMemo(() => {
    if (!isLayer) return [];
    return filteredWeekly.map((w) => ({ x: labelDay(w.weekStart), y: w.waterL > 0 ? w.waterL : 0 })); // placeholder
  }, [filteredWeekly, isLayer]);

  // ── Latest avg weight (kg), for the overview tile / mini-chart ──
  const avgWeightKg = useMemo(() => {
    const pts = weightPoints;
    return pts.length > 0 ? pts[0].y : null;
  }, [weightPoints]);

  // ── Lay-rate points (pondeuse) for the overview mini-chart ──
  const layRatePoints = useMemo(() => {
    if (!isLayer) return [];
    return (pondageQ.data?.weekly ?? [])
      .filter((w) => w.layRatePercent != null)
      .map((w) => ({ x: w.weekStart.slice(5).replace('-', '/'), y: w.layRatePercent! }));
  }, [pondageQ.data, isLayer]);

  // ── History items (merged timeline) ──
  const historyItems = useMemo(() => {
    const items: { date: string; kind: string; label: string; detail: string; icon: typeof Clock; tone: string }[] = [];

    // Treatments
    for (const t of treatmentsQ.data ?? []) {
      items.push({
        date: t.administeredAt?.slice(0, 10) ?? '',
        kind: 'treatment',
        label: t.productName,
        detail: `${CARE_LABEL[t.careType] ?? t.careType}${t.dosage ? ` · ${t.dosage}` : ''}`,
        icon: Syringe,
        tone: 'brand',
      });
    }

    // Prophylaxis events (completed)
    for (const p of prophylaxisQ.data ?? []) {
      if (p.status === 'FAIT') {
        items.push({
          date: p.completedAt?.slice(0, 10) ?? p.scheduledDate,
          kind: 'prophylaxis',
          label: p.name,
          detail: `${CARE_LABEL[p.careType] ?? p.careType} · ${p.scheduledDate}`,
          icon: Pill,
          tone: 'green',
        });
      } else if (p.status === 'EN_RETARD') {
        items.push({
          date: p.scheduledDate,
          kind: 'prophylaxis_late',
          label: `${p.name} (en retard)`,
          detail: `${CARE_LABEL[p.careType] ?? p.careType} · prévu le ${p.scheduledDate}`,
          icon: AlertTriangle,
          tone: 'red',
        });
      }
    }

    // Health events
    for (const e of healthEventsQ.data ?? []) {
      items.push({
        date: e.occurredAt?.slice(0, 10) ?? '',
        kind: 'health',
        label: e.title,
        detail: `${HEALTH_KIND_LABEL[e.kind] ?? e.kind}${e.quantity ? ` · ${e.quantity} oiseaux` : ''}`,
        icon: Stethoscope,
        tone: e.severity === 'ROUGE' ? 'red' : e.severity === 'JAUNE' ? 'amber' : 'green',
      });
    }

    items.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
    return items;
  }, [treatmentsQ.data, prophylaxisQ.data, healthEventsQ.data]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return historyItems;
    if (historyFilter === 'treatments') return historyItems.filter((h) => h.kind === 'treatment' || h.kind === 'prophylaxis' || h.kind === 'prophylaxis_late');
    if (historyFilter === 'health') return historyItems.filter((h) => h.kind === 'health');
    return historyItems; // entries placeholder
  }, [historyItems, historyFilter]);

  // ── Lot alerts ──
  const lotAlerts = useMemo(() => (advisoryQ.data?.alerts ?? []).filter((a) => a.batchId === batchId), [advisoryQ.data, batchId]);

  // ── PDF ──
  const downloadPasseport = async () => {
    if (mode === 'demo') { Alert.alert('Disponible en mode connecté', 'Connectez-vous pour télécharger.'); return; }
    setPdfBusy(true);
    try {
      await downloadPdf(`/farms/${farmId}/batches/${batchId}/passeport`, `passeport-${batchId}.pdf`);
      Alert.alert('Passeport sanitaire', 'PDF prêt.');
    } catch (e) { Alert.alert('Erreur', e instanceof Error ? e.message : 'Inattendue.'); }
    finally { setPdfBusy(false); }
  };

  // ── Loading / Error ──
  if (!b) {
    return (
      <Screen>
        <ScreenHeader title="Lot" back />
        {batchQ.isLoading ? <Spinner label="Chargement du lot…" /> : <AppText size="body" color="muted">Lot introuvable.</AppText>}
      </Screen>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <Screen bottomPad={140}>
      {/* ── HEADER ── */}
      <ScreenHeader
        title={b.batchName ?? 'Lot'}
        subtitle={`${b.breedName ?? ''} · ${b.species && b.species !== 'POULET' ? `${b.species === 'AUTRE' && b.customSpecies ? b.customSpecies : SPECIES_LABELS[b.species]} · ` : ''}${isLayer ? 'pondeuse' : 'chair'} · J${m?.ageDays ?? 0}`}
        back
        right={<Chip label={b.status === 'EN_VENTE' ? 'En vente' : 'Actif'} tone={b.status === 'EN_VENTE' ? 'green' : 'brand'} />}
      />

      {/* ── HERO ── */}
      <Card tone="brand" style={styles.heroCard}>
        <View style={styles.heroSplit}>
          {b?.species && SPECIES_IMAGES[b.species] ? (
            <View style={styles.heroImageWrap}>
              <Image source={SPECIES_IMAGES[b.species]} style={styles.heroImage} resizeMode="cover" />
              <View style={styles.heroAgeBadge}>
                <AppText size="small" weight="bold" color="#FFFFFF">J{m?.ageDays ?? 0}</AppText>
              </View>
            </View>
          ) : null}
          <View style={styles.heroStats}>
            <View style={styles.heroMainRow}>
              <HeroStat value={fmt(m?.liveCount ?? 0)} label="vivants" />
              <HeroStat value={`${(m?.mortalityPercent ?? 0).toLocaleString('fr-FR')} %`} label="mortalité" tone={(m?.mortalityPercent ?? 0) > 1.5 ? 'danger' : 'text'} />
            </View>
            <View style={styles.heroSubRow}>
              {isLayer ? (
                <HeroStat value={`${m?.layRatePercent ?? 0} %`} label="ponte" small />
              ) : (
                <>
                  <HeroStat value={`${(m?.fcr ?? 0).toLocaleString('fr-FR')}`} label="IC" small />
                  <HeroStat value={m?.gmqGramsPerDay ? `${m.gmqGramsPerDay}` : '—'} label="GMQ g/j" small />
                </>
              )}
            </View>
          </View>
        </View>
        <AppText size="caption" color="muted" style={styles.heroSub}>
          Début : {b.integrationDate} · {fmt(b.quantityAtStart)} sujets
        </AppText>
        {healthQ.data && (
          <View style={styles.healthStrip}>
            <View style={styles.healthScorePill}>
              <HeartPulse size={13} color={healthQ.data.healthScore >= 80 ? palette.green[600] : healthQ.data.healthScore >= 60 ? palette.amber[500] : palette.red[500]} />
              <AppText size="small" weight="bold" color="text">Santé {healthQ.data.healthScore}/100</AppText>
            </View>
            {healthQ.data.tips[0] ? (
              <View style={styles.healthTipChip}>
                {healthQ.data.tips[0].level === 'ROUGE' ? <AlertTriangle size={13} color={palette.red[500]} /> : healthQ.data.tips[0].level === 'JAUNE' ? <Info size={13} color={palette.amber[500]} /> : <Check size={13} color={palette.green[500]} />}
                <AppText size="small" color="muted" numberOfLines={2} style={{ flex: 1 }}>{healthQ.data.tips[0].text}</AppText>
              </View>
            ) : null}
          </View>
        )}
      </Card>

      {/* ── CYCLE PROGRESS ── */}
      <View style={styles.cycleCard}>
        <View style={styles.cycleHeader}>
          <AppText size="small" weight="semibold" color="brand">Semaine {cycleInfo.currentWeek}/{cycleInfo.totalWeeks}</AppText>
          <AppText size="small" color="muted">{cycleInfo.pct.toFixed(0)} % du cycle</AppText>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${cycleInfo.pct}%`, backgroundColor: isLayer ? palette.accent[500] : palette.brand[600] }]} />
        </View>
      </View>

      {/* ── MAIN TABS ── */}
      <View style={styles.tabRow}>
        {MAIN_TABS.map((t) => {
          const active = mainTab === t.key;
          const Icon = t.icon;
          return (
            <Pressable key={t.key} onPress={() => setMainTab(t.key)} style={[styles.tabBtn, active && styles.tabBtnActive]} accessibilityRole="tab">
              <Icon size={16} color={active ? palette.brand[600] : color.ink[400]} />
              <AppText size="small" weight={active ? 'bold' : 'medium'} color={active ? 'brand' : 'muted'}>{t.label}</AppText>
            </Pressable>
          );
        })}
      </View>

      {/* ══════════════════ TAB: OVERVIEW ══════════════════ */}
      {mainTab === 'overview' && (
        <>
          {/* Metric tiles */}
          <View style={styles.metricGrid}>
            <MetricTile label="IC" value={(m?.fcr ?? 0).toLocaleString('fr-FR')} icon={Scale} tone={(m?.fcr ?? 0) <= 2.0 ? 'green' : (m?.fcr ?? 0) <= 2.5 ? 'amber' : 'red'} threeCol />
            {!isLayer && <MetricTile label="GMQ" value={m?.gmqGramsPerDay ? `${m.gmqGramsPerDay} g` : '—'} icon={TrendingUp} tone="brand" threeCol />}
            <MetricTile label="IPE" value={(m?.ipe ?? 0).toLocaleString('fr-FR')} icon={Activity} tone="accent" threeCol />
            <MetricTile label="Viabilité" value={`${(m?.viabilityPercent ?? 100).toLocaleString('fr-FR')} %`} icon={HeartPulse} tone={(m?.viabilityPercent ?? 100) >= 95 ? 'green' : 'amber'} threeCol />
            {!isLayer && <MetricTile label="Poids moyen" value={avgWeightKg != null ? `${avgWeightKg.toFixed(1)} kg` : '—'} icon={Weight} tone="brand" threeCol />}
            {isLayer && <MetricTile label="Ponte" value={`${m?.layRatePercent ?? 0} %`} icon={Percent} tone="accent" threeCol />}
            {isLayer && <MetricTile label="Œufs" value={m?.eggsCollectedTotal ? fmt(m.eggsCollectedTotal) : '—'} icon={Egg} tone="accent" threeCol />}
            {isLayer && <MetricTile label="Plateaux" value={healthQ.data?.trays != null ? fmt(healthQ.data.trays) : '—'} icon={Egg} tone="accent" threeCol />}
            <MetricTile label="Aliment" value={m?.totalFeedKg ? `${m.totalFeedKg.toLocaleString('fr-FR')} kg` : '—'} icon={Wheat} tone="default" threeCol />
            <MetricTile label="Eau" value={healthQ.data?.waterLPerBird ? `${healthQ.data.waterLPerBird} L/oj` : '—'} icon={Droplets} tone="brand" threeCol />
            <MetricTile label="Densité" value={m?.densityPerM2 ? `${m.densityPerM2.toFixed(1)}/m²` : '—'} icon={Layers} tone="default" threeCol />
          </View>

          {/* Mini trend preview — weight (chair) / lay rate (pondeuse) */}
          {(weightPoints.length >= 2 || layRatePoints.length >= 2) && (
            <Card style={styles.miniChartCard}>
              <View style={styles.healthHeader}>
                {isLayer ? <Egg size={16} color={palette.accent[500]} /> : <Weight size={16} color={palette.brand[600]} />}
                <AppText size="body" weight="bold" color="brand">{isLayer ? 'Ponte par semaine' : 'Poids moyen par semaine'}</AppText>
                {!isLayer && avgWeightKg != null && (
                  <AppText size="small" weight="bold" color="brand" style={{ marginLeft: 'auto' }}>{avgWeightKg.toFixed(1)} kg</AppText>
                )}
              </View>
              <LineChart points={isLayer ? layRatePoints : weightPoints} height={110} stroke={isLayer ? palette.accent[500] : palette.brand[600]} unit={isLayer ? 'taux de ponte %' : 'poids (kg)'} format={(v) => (isLayer ? `${v.toFixed(0)}%` : v.toFixed(1))} />
            </Card>
          )}

          {/* Consommation d'eau — compact */}
          {(waterSummary.totalWater > 0 || healthQ.data?.waterLPerBird != null) && (
            <Card style={{ gap: 8 }}>
              <View style={styles.healthHeader}>
                <Droplets size={16} color={palette.brand[500]} />
                <AppText size="body" weight="bold" color="brand">{'Consommation d\u2019eau'}</AppText>
              </View>
              <View style={styles.waterStatRow}>
                <View style={styles.waterStat}>
                  <AppText size="small" color="muted">Total</AppText>
                  <AppText size="body" weight="bold" color="text" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{waterSummary.totalWater > 0 ? `${fmt(Math.round(waterSummary.totalWater))} L` : '—'}</AppText>
                </View>
                <View style={styles.waterStat}>
                  <AppText size="small" color="muted">L/oiseau/j</AppText>
                  <AppText size="body" weight="bold" color="text">{healthQ.data?.waterLPerBird != null ? `${healthQ.data.waterLPerBird} L` : '—'}</AppText>
                </View>
                <View style={styles.waterStat}>
                  <AppText size="small" color="muted">Tendance</AppText>
                  <AppText size="body" weight="bold" color={waterSummary.deltaPct == null ? 'text' : waterSummary.deltaPct > 25 ? 'danger' : waterSummary.deltaPct > 10 ? 'amber' : waterSummary.deltaPct < -5 ? 'success' : 'text'}>
                    {waterSummary.deltaPct != null ? `${waterSummary.deltaPct > 0 ? '+' : ''}${waterSummary.deltaPct.toFixed(1)} %` : '—'}
                  </AppText>
                </View>
              </View>
            </Card>
          )}

          {/* FCR Gauge (chair only) — compact */}
          {!isLayer && (
            <Card style={styles.fcrCard}>
              <FCRGauge value={m?.fcr ?? null} size={92} />
              <View style={styles.fcrLabel}>
                <AppText size="small" color="muted">IC global</AppText>
                <AppText size="h3" weight="bold" color="text">{(m?.fcr ?? 0).toLocaleString('fr-FR')}</AppText>
              </View>
            </Card>
          )}

          {/* Health tips */}
          {healthQ.data && (
            <Card style={{ gap: 8 }}>
              <View style={styles.healthHeader}>
                <HeartPulse size={16} color={palette.brand[600]} />
                <AppText size="body" weight="bold" color="brand">Conseils & alertes</AppText>
              </View>
              {healthQ.data.tips.slice(0, 3).map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  {tip.level === 'ROUGE' ? <AlertTriangle size={14} color={palette.red[500]} /> : tip.level === 'JAUNE' ? <Info size={14} color={palette.amber[500]} /> : <Check size={14} color={palette.green[500]} />}
                  <AppText size="small" color="muted" style={{ flex: 1 }}>{tip.text}</AppText>
                </View>
              ))}
            </Card>
          )}

          {/* Breed status — comparison vs target */}
          {breedStatus && (
            <Card style={{ gap: 8 }}>
              <View style={styles.healthHeader}>
                <Target size={16} color={palette.brand[600]} />
                <AppText size="body" weight="bold" color="brand">Référence souche — Semaine {breedStatus.week}</AppText>
              </View>
              {breedStatus.actualAvgWeightKg != null && breedStatus.targetAvgWeightKg != null && (
                <View style={styles.tipRow}>
                  <AppText size="small" color="muted" style={{ flex: 1 }}>Poids (réel {breedStatus.actualAvgWeightKg} kg / cible {breedStatus.targetAvgWeightKg} kg)</AppText>
                  <AppText size="body" weight="bold" color={breedStatus.avgWeightDeviationPct != null && breedStatus.avgWeightDeviationPct < 0 ? 'danger' : 'success'}>
                    {breedStatus.avgWeightDeviationPct != null ? `${breedStatus.avgWeightDeviationPct > 0 ? '+' : ''}${breedStatus.avgWeightDeviationPct.toFixed(1)} %` : '—'}
                  </AppText>
                </View>
              )}
              {breedStatus.actualFcr != null && breedStatus.targetFcr != null && (
                <View style={styles.tipRow}>
                  <AppText size="small" color="muted" style={{ flex: 1 }}>IC (réel {breedStatus.actualFcr} / cible {breedStatus.targetFcr})</AppText>
                  <AppText size="body" weight="bold" color={breedStatus.fcrDeviationPct != null && breedStatus.fcrDeviationPct > 0 ? 'danger' : 'success'}>
                    {breedStatus.fcrDeviationPct != null ? `${breedStatus.fcrDeviationPct > 0 ? '+' : ''}${breedStatus.fcrDeviationPct.toFixed(1)} %` : '—'}
                  </AppText>
                </View>
              )}
              {isLayer && breedStatus.actualLayRatePercent != null && breedStatus.targetLayRatePercent != null && (
                <View style={styles.tipRow}>
                  <AppText size="small" color="muted" style={{ flex: 1 }}>Ponte (réel {breedStatus.actualLayRatePercent} % / cible {breedStatus.targetLayRatePercent} %)</AppText>
                  <AppText size="body" weight="bold" color={breedStatus.layRateDeviationPct != null && breedStatus.layRateDeviationPct < 0 ? 'danger' : 'success'}>
                    {breedStatus.layRateDeviationPct != null ? `${breedStatus.layRateDeviationPct > 0 ? '+' : ''}${breedStatus.layRateDeviationPct.toFixed(1)} %` : '—'}
                  </AppText>
                </View>
              )}
            </Card>
          )}

          {/* Rentabilité — P&L (topline + condensed) */}
          {pnl && (
            <Card style={{ gap: 10 }}>
              <View style={styles.healthHeader}>
                <DollarSign size={16} color={palette.accent[500]} />
                <AppText size="body" weight="bold" color="brand">Rentabilité</AppText>
              </View>
              <View style={styles.pnlTopline}>
                <View style={styles.pnlNet}>
                  <AppText size="small" color="muted">Net</AppText>
                  <AppText size="h3" weight="bold" color={pnl.netFcfa >= 0 ? 'success' : 'danger'}>{fmtFcfa(pnl.netFcfa)}</AppText>
                </View>
                <View style={styles.pnlNet}>
                  <AppText size="small" color="muted">Marge</AppText>
                  <AppText size="body" weight="bold" color={pnl.marginPct != null && pnl.marginPct < 0 ? 'danger' : 'text'}>
                    {pnl.marginPct != null ? `${pnl.marginPct.toFixed(1)} %` : '—'}
                  </AppText>
                </View>
              </View>
              <View style={styles.pnlGrid}>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Revenu</AppText>
                  <AppText size="body" weight="bold" color="text">{fmtFcfa(pnl.revenueFcfa)}</AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Coût/kg</AppText>
                  <AppText size="body" weight="bold" color="text">{pnl.costPerKgFcfa != null ? fmtFcfa(pnl.costPerKgFcfa) : '—'}</AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Vendus</AppText>
                  <AppText size="body" weight="bold" color="text">{fmt(pnl.birdsSold + pnl.eggsSold)}</AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Kg vendus</AppText>
                  <AppText size="body" weight="bold" color="text">{pnl.kgSold > 0 ? `${pnl.kgSold.toLocaleString('fr-FR')} kg` : '—'}</AppText>
                </View>
              </View>
            </Card>
          )}

          {/* Pondage — egg quality (PONDEUSE only) */}
          {pondage && isLayer && (
            <Card style={{ gap: 8 }}>
              <View style={styles.healthHeader}>
                <Egg size={16} color={palette.accent[500]} />
                <AppText size="body" weight="bold" color="brand">Pondage</AppText>
              </View>
              <View style={styles.healthGrid}>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Collectés</AppText>
                  <AppText size="body" weight="bold" color="text">{fmt(pondage.totals.collected)}</AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Commercialisables</AppText>
                  <AppText size="body" weight="bold" color="success">{fmt(pondage.totals.sellable)}</AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Fêlés</AppText>
                  <AppText size="body" weight="bold" color="amber">{fmt(pondage.totals.cracked)}</AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Petits</AppText>
                  <AppText size="body" weight="bold" color="muted">{fmt(pondage.totals.small)}</AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Tx commercialisable</AppText>
                  <AppText size="body" weight="bold" color="text">{pondage.sellableRatioPercent != null ? `${pondage.sellableRatioPercent.toFixed(1)} %` : '—'}</AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Œufs/poule</AppText>
                  <AppText size="body" weight="bold" color="text">{pondage.eggsPerHen != null ? pondage.eggsPerHen : '—'}</AppText>
                </View>
              </View>
            </Card>
          )}

          {/* Feed stock — per lot */}
          {lotFeedLots.length > 0 && (
            <Card style={{ gap: 8 }}>
              <View style={styles.healthHeader}>
                <Warehouse size={16} color={palette.brand[600]} />
                <AppText size="body" weight="bold" color="brand">Stock aliment lot</AppText>
              </View>
              {lotFeedLots.map((lot) => (
                <View key={lot.id} style={styles.tipRow}>
                  <AppText size="small" color="muted" style={{ flex: 1 }}>
                    {lot.productName}{lot.feedPhase ? ` · ${lot.feedPhase.replaceAll('_', ' ')}` : ''}
                  </AppText>
                  <AppText size="body" weight="bold" color="text">{fmt(lot.availableKg)} kg</AppText>
                </View>
              ))}
            </Card>
          )}
        </>
      )}

      {/* ══════════════════ TAB: CURVES ══════════════════ */}
      {mainTab === 'curves' && (
        <>
          {/* Date range picker */}
          <View style={styles.dateRow}>
            <CalendarDays size={14} color={color.ink[400]} />
            <View style={styles.presetRow}>
              {DATE_PRESETS.map((p) => (
                <Pressable key={p.key} onPress={() => setDatePreset(p.key)} style={[styles.presetBtn, datePreset === p.key && styles.presetBtnActive]}>
                  <AppText size="small" weight={datePreset === p.key ? 'bold' : 'medium'} color={datePreset === p.key ? 'brand' : 'muted'}>{p.label}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
          {datePreset === 'custom' && (
            <View style={styles.customDateRow}>
              <Pressable onPress={() => setShowFromPicker(true)} style={styles.dateBtn}>
                <AppText size="small" color="text">Du : {fmtDateShort(customFrom)}</AppText>
              </Pressable>
              <Pressable onPress={() => setShowToPicker(true)} style={styles.dateBtn}>
                <AppText size="small" color="text">Au : {fmtDateShort(customTo)}</AppText>
              </Pressable>
              {showFromPicker && <DateTimePicker value={customFrom} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_e, d) => { if (Platform.OS === 'android') setShowFromPicker(false); if (d) setCustomFrom(d); }} maximumDate={new Date()} locale="fr-FR" />}
              {showToPicker && <DateTimePicker value={customTo} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_e, d) => { if (Platform.OS === 'android') setShowToPicker(false); if (d) setCustomTo(d); }} maximumDate={new Date()} locale="fr-FR" />}
            </View>
          )}

          {/* Curve selector */}
          <Card style={{ gap: 10 }}>
            <Segmented
              options={[
                { key: 'weight', label: 'Poids' },
                { key: 'fcr', label: 'IC' },
                { key: 'water', label: 'Eau' },
                { key: 'mortality', label: 'Mortalité' },
                ...(isLayer ? [{ key: 'eggs' as const, label: 'Œufs' }] : []),
              ]}
              value={curveTab}
              onChange={setCurveTab}
            />
            {curveTab === 'weight' && <LineChart points={weightPoints} stroke={color.brand[600]} unit="kg" format={(v) => (v * 1000).toFixed(0)} />}
            {curveTab === 'fcr' && <LineChart points={fcrPoints} stroke={color.accent[600]} unit="kg aliment / kg poids" format={(v) => v.toLocaleString('fr-FR')} />}
            {curveTab === 'water' && <LineChart points={waterPoints} stroke={color.brand[500]} unit="L / semaine" format={(v) => v.toLocaleString('fr-FR')} />}
            {curveTab === 'mortality' && <LineChart points={mortalityPoints} stroke={palette.red[500]} unit="morts / semaine" format={(v) => v.toLocaleString('fr-FR')} />}
            {curveTab === 'eggs' && isLayer && <LineChart points={eggsPoints} stroke={color.accent[500]} unit="œufs" format={(v) => v.toLocaleString('fr-FR')} />}
          </Card>

          {/* Metrics legend */}
          <SectionHeader title="Métriques" subtitle="Touchez ℹ pour comprendre" />
          <Card padding={false} style={styles.legend}>
            {LEGEND.filter((l) => !(!isLayer && l.key === 'ponte')).map((l, i, arr) => {
              const value = l.key === 'ic' ? (m?.fcr ?? 0).toLocaleString('fr-FR')
                : l.key === 'gmq' ? (m?.gmqGramsPerDay ? `${m.gmqGramsPerDay} g/j` : '—')
                : l.key === 'ipe' ? (m?.ipe ?? 0).toLocaleString('fr-FR')
                : l.key === 'viab' ? `${(m?.viabilityPercent ?? 100).toLocaleString('fr-FR')} %`
                : `${m?.layRatePercent ?? 0} %`;
              const open = expanded === l.key;
              return (
                <View key={l.key} style={[styles.legendRow, i < arr.length - 1 && styles.legendBorder]}>
                  <Pressable style={styles.legendMain} onPress={() => setExpanded(open ? null : l.key)} accessibilityRole="button">
                    <View style={{ flex: 1 }}>
                      <AppText size="body" weight="medium" color="text">{l.label}</AppText>
                      {open && <AppText size="small" color="muted" style={{ marginTop: 4 }}>{l.explain}</AppText>}
                    </View>
                    <AppText size="body" weight="bold" color="brand">{value}</AppText>
                    <Info size={16} color={color.ink[400]} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        </>
      )}

      {/* ══════════════════ TAB: HISTORY ══════════════════ */}
      {mainTab === 'history' && (
        <>
          {/* Date range picker (same as curves) */}
          <View style={styles.dateRow}>
            <CalendarDays size={14} color={color.ink[400]} />
            <View style={styles.presetRow}>
              {DATE_PRESETS.map((p) => (
                <Pressable key={p.key} onPress={() => setDatePreset(p.key)} style={[styles.presetBtn, datePreset === p.key && styles.presetBtnActive]}>
                  <AppText size="small" weight={datePreset === p.key ? 'bold' : 'medium'} color={datePreset === p.key ? 'brand' : 'muted'}>{p.label}</AppText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* History filter */}
          <View style={styles.filterRow}>
            {HISTORY_FILTERS.map((f) => {
              const active = historyFilter === f.key;
              return (
                <Pressable key={f.key} onPress={() => setHistoryFilter(f.key)} style={[styles.filterBtn, active && styles.filterBtnActive]}>
                  <AppText size="small" weight={active ? 'bold' : 'medium'} color={active ? 'brand' : 'muted'}>{f.label}</AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Timeline */}
          {filteredHistory.length === 0 ? (
            <Card style={{ alignItems: 'center', padding: 20 }}>
              <AppText size="body" color="muted">Aucun événement sur cette période.</AppText>
            </Card>
          ) : (
            <View style={styles.timeline}>
              {filteredHistory.map((item, i) => {
                const Icon = item.icon;
                return (
                  <View key={`${item.date}-${item.kind}-${i}`} style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: item.tone === 'red' ? palette.red[500] : item.tone === 'amber' ? palette.amber[500] : item.tone === 'green' ? palette.green[500] : palette.brand[500] }]} />
                    {i < filteredHistory.length - 1 && <View style={styles.timelineLine} />}
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <Icon size={14} color={item.tone === 'red' ? palette.red[500] : item.tone === 'amber' ? palette.amber[500] : item.tone === 'green' ? palette.green[500] : palette.brand[600]} />
                        <AppText size="body" weight="semibold" color="text" style={{ flex: 1 }}>{item.label}</AppText>
                        <AppText size="small" color="faint">{item.date}</AppText>
                      </View>
                      <AppText size="small" color="muted">{item.detail}</AppText>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* ══════════════════ TAB: HEALTH ══════════════════ */}
      {mainTab === 'health' && (
        <>
          {/* Health score card */}
          {healthQ.data && (
            <Card style={{ gap: 8 }}>
              <View style={styles.healthHeader}>
                <HeartPulse size={16} color={palette.brand[600]} />
                <AppText size="body" weight="bold" color="brand">Score santé : {healthQ.data.healthScore}/100</AppText>
              </View>
              <View style={styles.healthGrid}>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Mortalité</AppText>
                  <AppText size="body" weight="bold" color={healthQ.data.mortalityPercent > 1.5 ? 'danger' : 'text'}>
                    {healthQ.data.mortalityPercent.toLocaleString('fr-FR')} %
                  </AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">Viabilité</AppText>
                  <AppText size="body" weight="bold" color="text">
                    {healthQ.data.viabilityPercent.toLocaleString('fr-FR')} %
                  </AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="small" color="muted">IC</AppText>
                  <AppText size="body" weight="bold" color="text">
                    {healthQ.data.fcr?.toLocaleString('fr-FR') ?? '—'}
                  </AppText>
                </View>
                {isLayer && (
                  <View style={styles.healthStat}>
                    <AppText size="small" color="muted">Ponte</AppText>
                    <AppText size="body" weight="bold" color="text">
                      {healthQ.data.layRatePercent?.toLocaleString('fr-FR') ?? '—'} %
                    </AppText>
                  </View>
                )}
              </View>
            </Card>
          )}

          {/* Health events */}
          <SectionHeader title="Événements sanitaires" subtitle={`${healthEventsQ.data?.length ?? 0} événement(s)`} />
          {(healthEventsQ.data ?? []).length === 0 ? (
            <Card style={{ alignItems: 'center', padding: 16 }}>
              <AppText size="body" color="muted">Aucun événement sanitaire enregistré.</AppText>
            </Card>
          ) : (
            (healthEventsQ.data ?? []).slice(0, 10).map((e) => (
              <Card key={e.id} tone={e.status === 'RESOLU' ? 'plain' : 'alert'} style={{ gap: 4 }}>
                <View style={styles.eventHeader}>
                  <Stethoscope size={14} color={e.severity === 'ROUGE' ? palette.red[500] : e.severity === 'JAUNE' ? palette.amber[500] : palette.green[500]} />
                  <AppText size="body" weight="semibold" color="text" style={{ flex: 1 }}>{e.title}</AppText>
                  <Chip label={HEALTH_KIND_LABEL[e.kind] ?? e.kind} tone={e.severity === 'ROUGE' ? 'red' : e.severity === 'JAUNE' ? 'amber' : 'green'} />
                </View>
                <AppText size="small" color="muted">
                  {e.occurredAt?.slice(0, 10)}{e.quantity ? ` · ${e.quantity} oiseaux` : ''}{e.status === 'RESOLU' ? ' · Résolu' : ''}
                </AppText>
                {e.treatmentGiven && <AppText size="small" color="brand">Traitement : {e.treatmentGiven}</AppText>}
              </Card>
            ))
          )}

          {/* Upcoming prophylaxis */}
          <SectionHeader title="Calendrier prophylaxie" subtitle={`${prophylaxisQ.data?.length ?? 0} événement(s)`} />
          {(prophylaxisQ.data ?? []).filter((p) => p.status !== 'ANNULE').slice(0, 8).map((p) => (
            <Card key={p.id} tone={p.status === 'FAIT' ? 'green' : p.status === 'EN_RETARD' ? 'warn' : 'default'} style={{ gap: 4 }}>
              <View style={styles.eventHeader}>
                <Pill size={14} color={p.status === 'FAIT' ? palette.green[500] : p.status === 'EN_RETARD' ? palette.red[500] : palette.brand[600]} />
                <AppText size="body" weight="semibold" color="text" style={{ flex: 1 }}>{p.name}</AppText>
                <Chip
                  label={p.status === 'FAIT' ? 'Fait' : p.status === 'EN_RETARD' ? 'En retard' : 'Programmé'}
                  tone={p.status === 'FAIT' ? 'green' : p.status === 'EN_RETARD' ? 'red' : 'brand'}
                />
              </View>
              <AppText size="small" color="muted">
                {CARE_LABEL[p.careType] ?? p.careType}{p.dosage ? ` · ${p.dosage}` : ''} · {p.scheduledDate}
              </AppText>
            </Card>
          ))}
        </>
      )}

      {/* ── ALERTS ── */}
      {lotAlerts.length > 0 && mainTab === 'overview' && (
        <>
          <SectionHeader title="Alertes" subtitle={`${lotAlerts.length} signalement(s)`} />
          <View style={{ gap: 10 }}>
            {lotAlerts.map((a) => <AlertCard key={a.id} alert={a} onAcknowledge={() => void advisoryQ.refetch()} />)}
          </View>
        </>
      )}

      {/* ── CTA ── */}
      <View style={styles.ctaRow}>
        <View style={{ flex: 1 }}>
          <Button label="Saisir le jour" tone="brand" onPress={() => openDaily(batchId)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Encaisser" tone="accent" onPress={() => openSale(batchId)} />
        </View>
      </View>

      <View style={styles.pdfRow}>
        <Button label="Passeport sanitaire (PDF)" tone="ghost" icon={FileText} onPress={() => void downloadPasseport()} disabled={pdfBusy} loading={pdfBusy} />
      </View>
    </Screen>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function HeroStat({ value, label, tone = 'text', small = false }: { value: string; label: string; tone?: string; small?: boolean }) {
  return (
    <View style={styles.heroStat}>
      <AppText size="h2" weight="bold" color={tone} style={small ? styles.heroValueSmall : styles.heroValue}>{value}</AppText>
      <AppText size="small" color="muted">{label}</AppText>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // Hero
  heroCard: { gap: 6 },
  heroSplit: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  heroImageWrap: { width: 92, borderRadius: radii.lg, overflow: 'hidden' },
  heroImage: { width: 92, height: 92, borderRadius: radii.lg },
  heroAgeBadge: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(12,35,49,0.72)', borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  heroStats: { flex: 1, gap: 8, justifyContent: 'center' },
  heroMainRow: { flexDirection: 'row', gap: 12 },
  heroSubRow: { flexDirection: 'row', gap: 12 },
  heroStat: { flex: 1, gap: 1 },
  heroValue: { fontSize: 21, lineHeight: 24 },
  heroValueSmall: { fontSize: 17, lineHeight: 20 },
  heroSub: { marginTop: 4 },
  healthStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.brand[100] },
  healthScorePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: palette.surface },
  healthTipChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Cycle progress
  cycleCard: { gap: 6 },
  cycleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: palette.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  // Mini chart
  miniChartCard: { gap: 10 },

  // Water compact
  waterStatRow: { flexDirection: 'row', gap: 12 },
  waterStat: { flex: 1, gap: 2 },

  // FCR compact
  fcrCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  fcrLabel: { gap: 2 },

  // P&L
  pnlTopline: { flexDirection: 'row', alignItems: 'flex-end', gap: 20 },
  pnlNet: { flex: 1, gap: 2 },
  pnlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, borderTopWidth: 1, borderTopColor: color.border, paddingTop: 10 },

  // Main tabs
  tabRow: { flexDirection: 'row', gap: 4, marginTop: 12, marginBottom: 8 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: radii.md, backgroundColor: palette.surfaceAlt },
  tabBtnActive: { backgroundColor: palette.brand[50], borderWidth: 1, borderColor: palette.brand[200] },

  // Metrics grid
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },

  // Date picker
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  presetRow: { flex: 1, flexDirection: 'row', gap: 4 },
  presetBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.md, backgroundColor: palette.surfaceAlt },
  presetBtnActive: { backgroundColor: palette.brand[50], borderWidth: 1, borderColor: palette.brand[200] },
  customDateRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dateBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: color.border },

  // History filter
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: palette.surfaceAlt },
  filterBtnActive: { backgroundColor: palette.brand[600] },

  // Timeline
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', position: 'relative', paddingLeft: 20, paddingBottom: 16 },
  timelineDot: { position: 'absolute', left: 0, top: 4, width: 10, height: 10, borderRadius: 5 },
  timelineLine: { position: 'absolute', left: 4, top: 14, bottom: 0, width: 2, backgroundColor: palette.border },
  timelineContent: { flex: 1, gap: 2 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Health
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  healthStat: { flexBasis: '45%', gap: 2 },

  // Tips
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Events
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Legend
  legend: { overflow: 'hidden' },
  legendRow: { paddingHorizontal: 14 },
  legendBorder: { borderBottomWidth: 1, borderBottomColor: color.border },
  legendMain: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },

  // CTA
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  pdfRow: { marginTop: 10 },
});
