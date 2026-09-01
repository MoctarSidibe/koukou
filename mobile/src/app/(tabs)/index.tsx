import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Alert } from 'react-native';
import { Bird, AlertTriangle, Wheat, Egg, Banknote, BarChart3, MapPin, ShieldCheck, Activity, TrendingUp, Scale, Thermometer, Users, Medal, Maximize2, Store, ChevronDown, Droplets, Building, ArrowRight, Stethoscope } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';

import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { MetricTile } from '@/components/ui/MetricTile';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Spinner } from '@/components/ui/Spinner';
import { LotCard } from '@/components/LotCard';
import { EggStockCard, buildEggDailyData } from '@/components/EggStockCard';
import { Button } from '@/components/ui/Button';
import { useQuickCapture } from '@/components/capture/QuickCaptureProvider';
import { useAuth } from '@/auth/AuthContext';
import { givenName } from '@/api/format';
import { color, emoji, fmt, fmtFcfa, gradeColor, palette, radii } from '@/constants/theme';import { fetchAdvisory, fetchDashboard, fetchBatches, fetchSlaughterOrders } from '@/api';
import { MetricInfoSheet } from '@/components/MetricInfoSheet';
import type { MetricKey } from '@/components/MetricInfoSheet';
import type { HealthGrade } from '@/api/types';


export default function AccueilScreen() {
  const router = useRouter();
  const { openDaily, openFeed, openSale } = useQuickCapture();
  const { user, farms, farmId } = useAuth();
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [healthExpanded, setHealthExpanded] = useState(false);
  const [metricInfo, setMetricInfo] = useState<MetricKey | null>(null);



  const dashboard = useQuery({ queryKey: ['dashboard', farmId], queryFn: () => fetchDashboard(farmId) });
  const advisory = useQuery({ queryKey: ['advisory', farmId], queryFn: () => fetchAdvisory(farmId) });
  const batchesQuery = useQuery({ queryKey: ['batches', farmId], queryFn: () => fetchBatches(farmId) });
  const slaughterQuery = useQuery({ queryKey: ['slaughter-orders', farmId], queryFn: () => fetchSlaughterOrders(farmId) });
  const slaughterOrders = slaughterQuery.data ?? [];
  const slaughterProcessed = slaughterOrders.filter((o) => o.status === 'PROCESSED');
  const totalBirdsSlaughtered = slaughterProcessed.reduce((s, o) => s + o.birdCount, 0);
  const totalWeightKg = slaughterProcessed.reduce((s, o) => s + (o.totalWeightKg ?? 0), 0);
  const avgRendement = slaughterProcessed.filter((o) => o.rendementPercent != null).length > 0
    ? slaughterProcessed.filter((o) => o.rendementPercent != null).reduce((s, o) => s + (o.rendementPercent ?? 0), 0) / slaughterProcessed.filter((o) => o.rendementPercent != null).length
    : null;


  const farm = farms.length > 0 ? farms[0] : null;
  const d = dashboard.data;
  const topAction = advisory.data?.actions[0];

  const loading = dashboard.isLoading || advisory.isLoading;

  // --- Compute weighted averages from active batches ---
  const batches = batchesQuery.data ?? [];
  const activeBatches = batches.filter((b) => b.status !== 'CLOTURE');
  const totalLive = activeBatches.reduce((s, b) => s + b.metrics.liveCount, 0);
  const avgFcr = totalLive > 0
    ? activeBatches.reduce((s, b) => s + (b.metrics.fcr ?? 0) * b.metrics.liveCount, 0) / totalLive
    : null;
  const avgGmq = totalLive > 0
    ? activeBatches.reduce((s, b) => s + (b.metrics.gmqGramsPerDay ?? 0) * b.metrics.liveCount, 0) / totalLive
    : null;
  const avgIpe = totalLive > 0
    ? activeBatches.reduce((s, b) => s + (b.metrics.ipe ?? 0) * b.metrics.liveCount, 0) / totalLive
    : null;
  // Taux de ponte only for laying batches
  const layerBatches = activeBatches.filter((b) => b.type === 'PONDEUSE' && b.metrics.layRatePercent != null);
  const layerLive = layerBatches.reduce((s, b) => s + b.metrics.liveCount, 0);
  const avgLayRate = layerLive > 0
    ? layerBatches.reduce((s, b) => s + (b.metrics.layRatePercent ?? 0) * b.metrics.liveCount, 0) / layerLive
    : null;
  // Taux de ponte by type
  const chairBatches = activeBatches.filter((b) => b.type === 'CHAIR');
  const chairLive = chairBatches.reduce((s, b) => s + b.metrics.liveCount, 0);
  const chairLayRate = chairLive > 0
    ? chairBatches.reduce((s, b) => s + (b.metrics.layRatePercent ?? 0) * b.metrics.liveCount, 0) / chairLive
    : null;
  const pondeuseBatches = activeBatches.filter((b) => b.type === 'PONDEUSE');
  const pondeuseLive = pondeuseBatches.reduce((s, b) => s + b.metrics.liveCount, 0);
  const pondeuseLayRate = pondeuseLive > 0
    ? pondeuseBatches.reduce((s, b) => s + (b.metrics.layRatePercent ?? 0) * b.metrics.liveCount, 0) / pondeuseLive
    : null;
  const avgViability = totalLive > 0
    ? activeBatches.reduce((s, b) => s + b.metrics.viabilityPercent * b.metrics.liveCount, 0) / totalLive
    : null;

  // --- Leaderboard top performer ---
  const topPerf = d?.leaderboard?.[0] ?? null;

  // --- Max density across active batches ---
  const maxDensity = activeBatches.reduce((max, b) => Math.max(max, b.metrics.densityPerM2 ?? 0), 0);

  // --- Best breed status deviation (closest to target) ---
  const breedEntries = (d?.healthOverview ?? []).filter((h) => h.breedStatus != null);
  const bestBreedEntry = breedEntries.length > 0
    ? breedEntries.reduce((best, h) => {
        const bs = h.breedStatus!;
        const dev = bs.fcrDeviationPct != null ? Math.abs(bs.fcrDeviationPct) : bs.layRateDeviationPct != null ? Math.abs(bs.layRateDeviationPct) : 999;
        const bestBs = best.breedStatus!;
        const bestDev = bestBs.fcrDeviationPct != null ? Math.abs(bestBs.fcrDeviationPct) : bestBs.layRateDeviationPct != null ? Math.abs(bestBs.layRateDeviationPct) : 999;
        return dev < bestDev ? h : best;
      })
    : null;

  // --- Egg daily data from layer batches ---
  const eggDailyData = d ? buildEggDailyData(totalLive, avgLayRate) : [];

  const refresh = () => {
    void Promise.all([dashboard.refetch(), advisory.refetch()]);
  };

  const runTopAction = () => {
    if (!topAction) return;
    const batchId = topAction.batchId ?? undefined;
    switch (topAction.kind) {
      case 'VENTE':
        openSale(batchId);
        return;
      case 'SAISIE':
        openDaily(batchId);
        return;
      case 'SOIN':
        router.push('/sanitary');
        return;
      case 'STOCK_PROVENDE':
        openFeed();
        return;
      default:
        router.push('/alerts');
    }
  };

  return (
    <Screen
      bottomPad={120}
      refreshing={dashboard.isFetching || advisory.isFetching}
      onRefresh={refresh}
      header={
        <>
          <View style={styles.topRow}>
            <View style={styles.avatar}>
              <Image
                source={require('@/assets/images/logo-nav.png')}
                style={styles.avatarLogo}
                contentFit='contain'
                accessibilityLabel='Logo KouKou'
              />
            </View>
            <View style={styles.greetCol}>
              <AppText size='body' weight='bold' color='text'>
                Bonjour, {givenName(user.fullName)}
              </AppText>
            </View>
            {(d?.alerts.rouge ?? 0) + (d?.alerts.jaune ?? 0) > 0 && (
              <Pressable onPress={() => router.push('/alerts')} accessibilityRole='button' style={styles.alertBtn}>
                <AlertTriangle size={18} color={palette.amber[500]} />
                <View style={styles.alertBadge}>
                  <AppText size='small' weight='bold' color='surface'>
                    {(d?.alerts.rouge ?? 0) + (d?.alerts.jaune ?? 0)}
                  </AppText>
                </View>
              </Pressable>
            )}
          </View>
          <View style={styles.metaRow}>
            <View style={styles.farmChipRow}>
              {farms.length > 0 ? (
                <>
                  <MapPin size={12} color={palette.ink[400]} />
                  <Pressable onPress={() => Alert.alert('Ferme actuelle', farm?.name ?? 'Aucune ferme', [{ text: 'OK', style: 'cancel' }])}>
                    <AppText size='small' color='muted' style={styles.chipText}>
                      {farm!.name} · {farm!.administrativeCity}
                    </AppText>
                    {farm!.isVerified ? <ShieldCheck size={12} color={palette.green[600]} /> : null}
                  </Pressable>
                </>
              ) : null}
            </View>
            {d?.weather ? (
              <View style={styles.weatherPill}>
                <View style={styles.weatherIconWrap}>
                  <AppText style={{ fontSize: 24 }}>{emoji(d.weather.condition ?? '')}</AppText>
                </View>
                <View style={{ maxWidth: 92 }}>
                  <AppText size='body' weight='bold' color='text' numberOfLines={1}>
                    {d.weather.temperatureC ?? '—'} °C
                  </AppText>
                  <AppText size='caption' color='muted' numberOfLines={1}>
                    {d.weather.condition ?? 'Prévision météo'}
                  </AppText>
                </View>
              </View>
            ) : null}
          </View>
        </>
      }
    >

      {dashboard.isError || advisory.isError ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          <AppText size='body' color='danger'>
            Impossible de charger les données de la ferme. Vérifiez la connexion au serveur.
          </AppText>
          <Button label='Réessayer' tone='brand' onPress={refresh} />
        </View>
      ) : loading || !d ? (
        <Spinner label='KouKou prépare votre ferme…' />
      ) : (
        <>
          {/* ── Top row: Encaissé + POS ── */}
          <View style={styles.metricGrid}>
            <MetricTile
              label={"Encaissé aujourd'hui"}
              value={fmtFcfa(d.collectedTodayFcfa)}
              sub={d.deltas.mortalityDelta !== 0 ? `Mortalité ${d.deltas.mortalityDelta > 0 ? '+' : ''}${(d.deltas.mortalityDelta * 100).toFixed(1)}% vs semaine` : undefined}
              tone='accent'
              icon={Banknote}
              compact
            />
            <MetricTile
              label='Point de vente'
              value='POS'
              sub='Ouvrir la caisse'
              tone='green'
              icon={Store}
              onPress={() => router.push('/caisse')}
              compact
              subHighlight
            />
          </View>
          {/* ── Health card ── */}
          <Pressable
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setHealthExpanded(!healthExpanded); }}
            style={({ pressed }) => [styles.healthCard, healthExpanded && styles.healthCardExpanded, pressed && styles.healthCardPressed]}
            accessibilityRole="button"
            accessibilityState={{ expanded: healthExpanded }}>
            <HealthRing score={d.health.score} grade={d.health.grade} />
            <View style={styles.healthMain}>
              <View style={styles.healthTitleRow}>
                <AppText size="body" weight="semibold" color="text">Santé</AppText>
                <AppText size="small" color="muted">{activeBatches.length} lot{activeBatches.length > 1 ? 's' : ''}</AppText>
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={(e) => { e.stopPropagation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push('/sanitary'); }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.healthDetailBtn, pressed && styles.healthDetailBtnPressed]}>
                  <Stethoscope size={12} color={color.brand[600]} />
                  <AppText size="small" weight="semibold" color="brand">Sanitaire</AppText>
                  <ArrowRight size={12} color={color.brand[600]} />
                </Pressable>
                <View style={[styles.healthToggle, healthExpanded && styles.healthToggleActive]}>
                  <AppText size="small" weight="bold" color={healthExpanded ? 'surface' : 'brand'}>
                    {healthExpanded ? '−' : '+'}
                  </AppText>
                </View>
              </View>
              <View style={styles.healthStats}>
                <View style={styles.healthStat}>
                  <AppText size="body" weight="bold" color="danger">{d.health.breakdown.rouge}</AppText>
                  <AppText size="small" color="muted">Rouge</AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="body" weight="bold" color="warn">{d.health.breakdown.jaune}</AppText>
                  <AppText size="small" color="muted">Jaune</AppText>
                </View>
                <View style={styles.healthStat}>
                  <AppText size="body" weight="bold" color={d.mortalityPercent != null && d.mortalityPercent > 5 ? 'danger' : 'text'}>
                    {d.mortalityPercent != null ? `${d.mortalityPercent.toFixed(1)}%` : '—'}
                  </AppText>
                  <AppText size="small" color="muted">Mortalité</AppText>
                </View>
              </View>
            </View>
          </Pressable>
          {healthExpanded && (
            <Card tone="default" style={styles.healthExpanded}>
              <View style={styles.healthExpandedRow}>
                <View style={styles.healthExpandedStat}>
                  <AppText size="small" color="muted">Consommation</AppText>
                  <AppText size="bodyM" weight="bold" color="text">
                    {(() => {
                      const totalFeed = activeBatches.reduce((s, b) => s + b.metrics.totalFeedKg, 0);
                      return totalLive > 0 ? `${Math.round(totalFeed / totalLive)} g` : '—';
                    })()}
                  </AppText>
                  <AppText size="small" color="faint">g/oiseau/jour</AppText>
                </View>
                <View style={styles.healthExpandedStat}>
                  <AppText size="small" color="muted">Viabilité</AppText>
                  <AppText size="bodyM" weight="bold" color={avgViability != null && avgViability >= 95 ? 'success' : 'text'}>
                    {avgViability != null ? `${avgViability.toFixed(0)}%` : '—'}
                  </AppText>
                  <AppText size="small" color="faint">moyenne</AppText>
                </View>
                <View style={styles.healthExpandedStat}>
                  <AppText size="small" color="muted">Ponte moy.</AppText>
                  <AppText size="bodyM" weight="bold" color="text">
                    {avgLayRate != null ? `${avgLayRate.toFixed(1)}%` : '—'}
                  </AppText>
                  <AppText size="small" color="faint">pondeuses</AppText>
                </View>
              </View>
              <View style={styles.healthExpandedRow}>
                <View style={styles.healthExpandedStat}>
                  <AppText size="small" color="muted">Maladies</AppText>
                  <AppText size="bodyM" weight="bold" color={d.health.breakdown.rouge > 0 ? 'danger' : 'text'}>
                    {d.health.breakdown.rouge}
                  </AppText>
                  <AppText size="small" color="faint">actives</AppText>
                </View>
                <View style={styles.healthExpandedStat}>
                  <AppText size="small" color="muted">Soins en retard</AppText>
                  <AppText size="bodyM" weight="bold" color={d.health.breakdown.jaune > 0 ? 'warn' : 'text'}>
                    {d.health.breakdown.jaune}
                  </AppText>
                  <AppText size="small" color="faint">prophylaxie</AppText>
                </View>
                <View style={styles.healthExpandedStat}>
                  <AppText size="small" color="muted">Densité max</AppText>
                  <AppText size="bodyM" weight="bold" color={maxDensity > 15 ? 'danger' : 'text'}>
                    {maxDensity > 0 ? `${maxDensity.toFixed(1)}` : '—'}
                  </AppText>
                  <AppText size="small" color="faint">oiseaux/m²</AppText>
                </View>
              </View>
            </Card>
          )}
          <SectionHeader
            title='Statistiques'
            right={
              <Pressable onPress={() => setStatsExpanded(!statsExpanded)} accessibilityRole='button' style={[styles.expandBtn, statsExpanded && styles.expandBtnActive]}>
                <AppText size='small' weight='semibold' color={statsExpanded ? 'surface' : 'brand'}>
                  {statsExpanded ? 'Moins' : 'Plus'}
                </AppText>
                <ChevronDown size={14} color={statsExpanded ? palette.brand[50] : palette.brand[600]} style={{ transform: [{ rotate: statsExpanded ? '180deg' : '0deg' }] }} />
              </Pressable>
            }
          />
          {/* ── Core: Cheptel + Lots (always visible) ── */}
          <View style={styles.metricGrid}>
            <MetricTile label='Cheptel vivant' value={fmt(d.liveStock)} sub={`${d.batches.actif} lot${d.batches.actif > 1 ? 's' : ''}`} tone='green' icon={Bird} onPress={() => router.push('/lots')} compact />
            <MetricTile label='Lots actifs' value={String(d.batches.actif)} sub={`${d.batches.total} total · ${d.batches.enVente} en vente`} tone='brand' icon={BarChart3} onPress={() => router.push('/lots')} compact />
          </View>
          {/* ── Performance row: IC, GMQ, IPE ── */}
          <View style={styles.metricGrid}>
            <MetricTile
              label='IC (FCR)'
              value={avgFcr != null && avgFcr > 0 ? avgFcr.toFixed(2) : '—'}
              sub={avgFcr != null && avgFcr > 2.2 ? '⚠ Élevé' : avgFcr != null && avgFcr < 1.8 ? 'Excellent' : 'Conforme'}
              tone={avgFcr != null && avgFcr > 2.2 ? 'red' : avgFcr != null && avgFcr < 1.8 ? 'green' : 'default'}
              icon={Activity}
              onPress={() => setMetricInfo('IC')}
              threeCol
            />
            <MetricTile
              label='GMQ (g/j)'
              value={avgGmq != null && avgGmq > 0 ? `${Math.round(avgGmq)}` : '—'}
              sub={avgGmq != null && avgGmq > 55 ? 'Croissance rapide' : avgGmq != null ? 'Croissance normale' : undefined}
              tone={avgGmq != null && avgGmq > 55 ? 'green' : 'default'}
              icon={TrendingUp}
              onPress={() => setMetricInfo('GMQ')}
              threeCol
            />
            <MetricTile
              label='IPE'
              value={avgIpe != null && avgIpe > 0 ? fmt(Math.round(avgIpe)) : '—'}
              sub={avgIpe != null && avgIpe > 350 ? '⚠ Coût élevé' : avgIpe != null ? 'Coût maîtrisé' : undefined}
              tone={avgIpe != null && avgIpe > 350 ? 'amber' : avgIpe != null ? 'green' : 'default'}
              icon={Scale}
              onPress={() => setMetricInfo('IPE')}
              threeCol
            />
          </View>
          {/* ── Expanded: Provende, Équipe, Bâtiments, Eau, Abattage ── */}
          {statsExpanded && (
            <Card tone='brand' style={styles.expandedCard}>
              <View style={styles.expandedHeader}>
                <AppText size='small' weight='semibold' color='brand'>Détails de la ferme</AppText>
              </View>
              <View style={[styles.metricGrid, { marginTop: 0 }]}>
                <MetricTile label='Autonomie provende' value={d.feedAutonomyDays != null ? `${d.feedAutonomyDays} j` : '—'} sub={d.feedAutonomyDays != null && d.feedAutonomyDays < 3 ? '⚠ Critique' : d.feedAutonomyDays != null && d.feedAutonomyDays < 5 ? 'Stock bas' : 'Suffisant'} tone={d.feedAutonomyDays != null && d.feedAutonomyDays < 3 ? 'red' : d.feedAutonomyDays != null && d.feedAutonomyDays < 5 ? 'amber' : 'green'} icon={Wheat} onPress={() => router.push('/provende')} compact />
                <MetricTile label='Équipe' value={String(d.teamCount)} sub={d.teamCount === 1 ? 'Éleveur' : `${d.teamCount} éleveurs`} tone='brand' icon={Users} compact />
                <MetricTile label='Bâtiments' value={String(d.buildingsCount ?? 0)} sub={d.farmDensityPerM2 != null ? `Densité ${d.farmDensityPerM2.toFixed(1)}/m²` : d.totalAreaM2 != null ? `${d.totalAreaM2} m² total` : 'Aucun bâtiment'} tone={d.farmDensityPerM2 != null && d.farmDensityPerM2 > 18 ? 'red' : d.farmDensityPerM2 != null && d.farmDensityPerM2 > 15 ? 'amber' : 'green'} icon={Building} compact />
                <MetricTile
                  label='Eau (jour)'
                  value={d.waterConsumptionTodayL != null ? `${Math.round(d.waterConsumptionTodayL)} L` : '—'}
                  sub={d.waterDropPercent != null ? (d.waterDropPercent > 25 ? '⚠ Chute critique' : d.waterDropPercent > 10 ? '⚠ Baisse' : d.waterDropPercent < -5 ? 'En hausse' : 'Stable') : 'Pas de données'}
                  tone={d.waterDropPercent != null && d.waterDropPercent > 25 ? 'red' : d.waterDropPercent != null && d.waterDropPercent > 10 ? 'amber' : 'green'}
                  icon={Droplets}
                  compact
                />
                <MetricTile label='Abattages' value={String(slaughterProcessed.length)} sub={totalBirdsSlaughtered > 0 ? `${fmt(totalBirdsSlaughtered)} oiseaux` : 'Aucun'} tone='accent' icon={Store} compact />
                <MetricTile label='Poids total' value={totalWeightKg > 0 ? `${Math.round(totalWeightKg)} kg` : '—'} sub={avgRendement != null ? `Rdt ${avgRendement.toFixed(0)}%` : 'Sans rendement'} tone='accent' icon={Scale} compact />
              </View>
            </Card>
          )}
          <EggStockCard
            availableEggs={d.eggStock.availableEggs}
            availableAlveoles={d.eggStock.availableAlveoles}
            layRatePercent={avgLayRate}
            chairLayRate={chairLayRate}
            pondeuseLayRate={pondeuseLayRate}
            dailyData={eggDailyData}
          />
          <SectionHeader title='Classement' subtitle='Meilleurs lots & suivi' />
          <View style={styles.metricGrid}>
            {topPerf && (
              <MetricTile
                label='🏆 Meilleur lot'
                value={topPerf.batchName ?? '—'}
                sub={topPerf.type === 'CHAIR' && topPerf.ipe != null ? `IPE ${fmt(Math.round(topPerf.ipe))}` : topPerf.layRatePercent != null ? `Ponte ${topPerf.layRatePercent.toFixed(0)}%` : `IC ${topPerf.fcr?.toFixed(2) ?? '—'}`}
                tone='green'
                icon={Medal}
                onPress={() => router.push(`/lot/${topPerf.batchId}`)}
              />
            )}
            {bestBreedEntry?.breedStatus && (
              <MetricTile
                label='Breed Intel'
                value={bestBreedEntry.breedStatus!.breedName}
                sub={bestBreedEntry.breedStatus!.fcrDeviationPct != null ? `IC ${bestBreedEntry.breedStatus!.fcrDeviationPct > 0 ? '+' : ''}${bestBreedEntry.breedStatus!.fcrDeviationPct.toFixed(1)}% vs cible` : bestBreedEntry.breedStatus!.layRateDeviationPct != null ? `Ponte ${bestBreedEntry.breedStatus!.layRateDeviationPct > 0 ? '+' : ''}${bestBreedEntry.breedStatus!.layRateDeviationPct.toFixed(1)}% vs cible` : 'Semaine ' + bestBreedEntry.breedStatus!.week}
                tone={bestBreedEntry.breedStatus!.fcrDeviationPct != null ? (bestBreedEntry.breedStatus!.fcrDeviationPct > 10 ? 'red' : bestBreedEntry.breedStatus!.fcrDeviationPct < -5 ? 'green' : 'amber') : bestBreedEntry.breedStatus!.layRateDeviationPct != null ? (bestBreedEntry.breedStatus!.layRateDeviationPct < -10 ? 'amber' : 'green') : 'default'}
                icon={BarChart3}
                onPress={() => router.push(`/lot/${bestBreedEntry.batchId}`)}
              />
            )}
          </View>
        </>
      )}
      <MetricInfoSheet metric={metricInfo} onClose={() => setMetricInfo(null)} />
    </Screen>
  );
}

function HealthRing({ score, grade }: { score: number; grade: HealthGrade }) {
  const size = 56;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const strokeDashoffset = circumference * (1 - pct / 100);
  const ringColor = gradeColor[grade];
  return (
    <View style={styles.ring}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <AppText size="small" weight="bold" style={{ color: ringColor, fontSize: 15, lineHeight: 18 }}>
          {pct}%
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    justifyContent: 'center',
  },
  avatarLogo: {
    width: 48,
    height: 48,
  },
  greetCol: {
    flex: 1,
    flexShrink: 1,
  },
  alertBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.amber[50],
    borderWidth: 1,
    borderColor: palette.amber[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.red[500],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  farmChipRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  chipText: {
    flexShrink: 1,
  },
  weatherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weatherIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(32, 96, 128, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  healthCard: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  healthCardExpanded: {
    backgroundColor: palette.brand[50],
    borderColor: palette.brand[200],
  },
  healthCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  healthDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: palette.brand[50],
  },
  healthDetailBtnPressed: {
    backgroundColor: palette.brand[100],
    transform: [{ scale: 0.95 }],
  },
  healthToggle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: palette.brand[300],
    backgroundColor: palette.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '0deg' }],
  },
  healthToggleActive: {
    backgroundColor: palette.brand[600],
    borderColor: palette.brand[600],
    transform: [{ rotate: '180deg' }],
  },
  healthExpanded: {
    marginTop: 6,
    padding: 12,
    gap: 10,
  },
  healthExpandedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  healthExpandedStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: palette.surfaceAlt,
  },
  ring: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthMain: {
    flex: 1,
    gap: 8,
  },
  healthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthStats: {
    flexDirection: 'row',
    gap: 4,
  },
  healthStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: palette.brand[50],
    borderWidth: 1,
    borderColor: palette.brand[200],
  },
  expandBtnActive: {
    backgroundColor: palette.brand[600],
    borderColor: palette.brand[600],
  },
  recoBox: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radii.md,
    padding: 10,
  },
  expandedCard: {
    marginTop: 10,
    padding: 12,
    gap: 10,
  },
  expandedHeader: {
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.brand[200],
  },
});