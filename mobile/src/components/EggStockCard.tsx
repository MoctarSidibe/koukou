import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ChevronDown, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from './ui/AppText';
import { Card } from './ui/Card';
import { color, palette, radii } from '@/constants/theme';

interface DailyCount {
  day: string;
  count: number;
}

interface EggStockCardProps {
  selectedDate: Date;
  availableEggs: number;
  availableAlveoles: number;
  layRatePercent: number | null;
  chairLayRate: number | null;
  pondeuseLayRate: number | null;
  dailyData: DailyCount[];
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const BAR_HEIGHT = 52;

function formatDateFull(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function EggStockCard({
  selectedDate,
  availableEggs,
  availableAlveoles,
  layRatePercent,
  chairLayRate,
  pondeuseLayRate,
  dailyData,
}: EggStockCardProps) {
  const [showTrays, setShowTrays] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const today = new Date();
  const isToday =
    selectedDate.toDateString() === today.toDateString();

  const displayValue = showTrays ? availableAlveoles : availableEggs;
  const displayUnit = showTrays ? 'alvéoles' : 'œufs';

  const maxCount = Math.max(...dailyData.map((d) => d.count), 1);
  const totalCount = dailyData.reduce((s, d) => s + d.count, 0);
  const avgCount = dailyData.length > 0 ? Math.round(totalCount / dailyData.length) : 0;

  return (
    <Card tone='default' style={styles.card}>
      {/* ── Header: icon + title + date ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={showTrays ? require('@/assets/images/alveole2.jpg') : require('@/assets/images/oeuf2.jpg')}
            style={styles.eggImage}
            resizeMode='contain'
          />
          <AppText size='body' weight='bold' color='text'>Œufs</AppText>
          <AppText size='small' color='faint'>· {formatDateShort(today)}</AppText>
        </View>
      </View>

      {/* ── Sub-header: date display + Œufs/Alvéoles toggle + Plus ── */}
      <View style={styles.subHeader}>
        <View style={styles.datePill}>
          <Calendar size={12} color={palette.brand[600]} />
          <AppText size='small' weight='semibold' color='brand'>
            {isToday ? 'Aujourd\'hui' : formatDateFull(selectedDate)}
          </AppText>
        </View>
        <View style={styles.subHeaderRight}>
          <View style={styles.toggle}>
            <Pressable
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setShowTrays(false); }}
              style={[styles.toggleBtn, !showTrays && styles.toggleActive]}
              accessibilityRole='button'>
              <AppText size='small' weight={!showTrays ? 'bold' : 'medium'} color={!showTrays ? 'surface' : 'muted'}>
                Œufs
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setShowTrays(true); }}
              style={[styles.toggleBtn, showTrays && styles.toggleActive]}
              accessibilityRole='button'>
              <AppText size='small' weight={showTrays ? 'bold' : 'medium'} color={showTrays ? 'surface' : 'muted'}>
                Alvéoles
              </AppText>
            </Pressable>
          </View>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setExpanded(!expanded); }} accessibilityRole='button' style={[styles.expandBtn, expanded && styles.expandBtnActive]}>
            <AppText size='small' weight='semibold' color={expanded ? 'surface' : 'brand'}>
              {expanded ? 'Moins' : 'Plus'}
            </AppText>
            <ChevronDown size={12} color={expanded ? palette.brand[50] : palette.brand[600]} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
          </Pressable>
        </View>
      </View>

      {/* ── Body: big number + mini metrics ── */}
      <View style={styles.bodyRow}>
        <View style={styles.bigBlock}>
          <View style={styles.valueRow}>
            <AppText size='h1' weight='bold' color={palette.brand[600]}>
              {displayValue.toLocaleString('fr-FR')}
            </AppText>
            <AppText size='body' weight='medium' color='muted'>
              {displayUnit}
            </AppText>
          </View>
          <AppText size='small' color='faint'>
            {showTrays
              ? `= ${(availableAlveoles * 30).toLocaleString('fr-FR')} œufs`
              : `= ${availableAlveoles} alvéole${availableAlveoles !== 1 ? 's' : ''}`}
          </AppText>
        </View>

        <View style={styles.miniMetricsPill}>
          <View style={styles.miniItem}>
            <AppText size='small' weight='bold' color='brand'>
              {layRatePercent != null ? `${layRatePercent.toFixed(0)}%` : '—'}
            </AppText>
            <AppText size='small' color='faint'>Ponte</AppText>
          </View>
          <View style={styles.miniDivider} />
          <View style={styles.miniItem}>
            <AppText size='small' weight='bold' color='text'>
              {fmtCompact(totalCount)}
            </AppText>
            <AppText size='small' color='faint'>total</AppText>
          </View>
          <View style={styles.miniDivider} />
          <View style={styles.miniItem}>
            <AppText size='small' weight='bold' color='text'>
              {avgCount}
            </AppText>
            <AppText size='small' color='faint'>/ jour</AppText>
          </View>
        </View>
      </View>

      {/* ── Expanded: lay rates + chart ── */}
      {expanded && (
        <View style={styles.expandedSection}>
          <View style={styles.chartDivider} />
          <View style={styles.layRateRow}>
            <View style={styles.layRateTile}>
              <AppText size='small' color='muted'>Ponte CHAIR</AppText>
              <AppText size='body' weight='bold' color={chairLayRate != null && chairLayRate > 0 ? 'text' : 'faint'}>
                {chairLayRate != null && chairLayRate > 0 ? `${chairLayRate.toFixed(0)}%` : '—'}
              </AppText>
              <AppText size='small' color='faint'>0% (non pondeur)</AppText>
            </View>
            <View style={styles.layRateDivider} />
            <View style={styles.layRateTile}>
              <AppText size='small' color='muted'>Ponte PONDEUSE</AppText>
              <AppText
                size='body'
                weight='bold'
                color={pondeuseLayRate != null && pondeuseLayRate >= 80 ? palette.green[600] : pondeuseLayRate != null ? palette.amber[600] : 'faint'}>
                {pondeuseLayRate != null ? `${pondeuseLayRate.toFixed(0)}%` : '—'}
              </AppText>
              <AppText size='small' color='faint'>
                {pondeuseLayRate != null && pondeuseLayRate >= 80 ? 'Soutenue' : pondeuseLayRate != null ? 'En montée' : 'Pas de données'}
              </AppText>
            </View>
          </View>
          <View style={styles.chartHeader}>
            <AppText size='small' weight='semibold' color='muted'>
              Récolte 7 jours
            </AppText>
            <AppText size='small' color='faint'>
              Total {fmtCompact(totalCount)}
            </AppText>
          </View>
          <View style={styles.chartRow}>
            {dailyData.map((d, i) => {
              const pct = maxCount > 0 ? d.count / maxCount : 0;
              const barH = Math.max(pct * BAR_HEIGHT, d.count > 0 ? 4 : 0);
              const isToday = i === dailyData.length - 1;
              const isMax = d.count === maxCount && d.count > 0;
              return (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barValWrap}>
                    <AppText
                      size='small'
                      weight={isToday ? 'bold' : 'medium'}
                      color={isToday ? 'brand' : isMax ? 'text' : 'faint'}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}>
                      {d.count > 0 ? fmtCompact(d.count) : ''}
                    </AppText>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: barH,
                          backgroundColor: isToday
                            ? palette.brand[500]
                            : isMax
                              ? palette.brand[300]
                              : palette.brand[100],
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.dayLabelWrap}>
                    <AppText
                      size='small'
                      weight={isToday ? 'bold' : 'medium'}
                      color={isToday ? 'brand' : 'faint'}>
                      {DAY_LABELS[i]}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </Card>
  );
}

/** Build 7-day mock data from lay rate and live count. */
export function buildEggDailyData(
  liveCount: number,
  layRatePct: number | null,
): DailyCount[] {
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const avg = layRatePct != null && layRatePct > 0
    ? Math.round((liveCount * layRatePct) / 100)
    : 0;
  const seed = [1.02, 0.98, 1.05, 1.0, 0.95, 0.78, 0.72];
  return dayNames.map((day, i) => ({
    day,
    count: avg > 0 ? Math.round(avg * seed[i]) : 0,
  }));
}

function fmtCompact(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('fr-FR');
}

const styles = StyleSheet.create({
  card: {
    padding: 10,
    paddingTop: 2,
    marginTop: 6,
    gap: 3,
  },
  /* ── Header ── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eggImage: { width: 44, height: 44 },
  /* ── Sub-header ── */
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  subHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: palette.brand[50],
    borderWidth: 1,
    borderColor: palette.brand[200],
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.pill,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  toggleActive: {
    backgroundColor: palette.brand[600],
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: palette.brand[50],
    borderWidth: 1,
    borderColor: palette.brand[200],
  },
  expandBtnActive: {
    backgroundColor: palette.brand[600],
    borderColor: palette.brand[600],
  },
  /* ── Body ── */
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bigBlock: {
    gap: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  miniItem: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  miniDivider: {
    width: 1,
    height: 20,
    backgroundColor: palette.brand[100],
  },
  miniMetricsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.brand[50],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.brand[100],
    paddingVertical: 5,
    paddingHorizontal: 3,
  },
  /* ── Lay rate row (expanded) ── */
  layRateRow: {
    flexDirection: 'row',
    gap: 0,
  },
  layRateTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 2,
  },
  layRateDivider: {
    width: 1,
    backgroundColor: color.border,
    marginVertical: 4,
  },
  /* ── Expanded section ── */
  expandedSection: {
    backgroundColor: palette.brand[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.brand[100],
    padding: 12,
    gap: 8,
    marginTop: 10,
  },
  chartDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  barValWrap: {
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barTrack: {
    width: 24,
    height: BAR_HEIGHT,
    borderRadius: 5,
    backgroundColor: palette.surfaceAlt,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  dayLabelWrap: {
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
});
