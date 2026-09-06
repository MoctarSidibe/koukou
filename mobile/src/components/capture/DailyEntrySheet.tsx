import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, Feather, Scale, Skull, Wine } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { Segmented } from '../ui/Segmented';
import { Stepper } from '../ui/Stepper';
import { useAuth } from '@/auth/AuthContext';
import { fetchBatches, fetchFeedStock } from '@/api';
import { invalidateFarmQueries } from '@/api/invalidate';
import { FEED_PHASE_LABELS } from '@/api/format';
import { buildDailyEntryPayload, type DailyEntryValues } from '@/api/mutations';
import type { FeedPhase } from '@/api/types';
import { queueDailyEntry } from '@/offline';
import { color, palette, radii, spacing } from '@/constants/theme';

interface DailyEntrySheetProps {
  initialBatchId?: string;
  onClose: () => void;
}

const baseline: DailyEntryValues = {
  deaths: 0,
  feedKg: 0,
  feedSacs: 0,
  waterL: 0,
  weightG: 0,
  eggs: 0,
  eggsCracked: 0,
  feedPhase: null,
  inputLotId: null,
};

const FEED_PHASES: FeedPhase[] = [
  'POUSSIN',
  'DEMARRAGE',
  'CROISSANCE',
  'PRE_PONTE',
  'PONTE_PHASE_1',
  'PONTE_PHASE_2',
  'PONTE_PHASE_3',
  'FINITION',
  'PERSONNALISE',
];

export function DailyEntrySheet({ initialBatchId, onClose }: DailyEntrySheetProps) {
  const { mode, farmId } = useAuth();
  const queryClient = useQueryClient();

  const batchesQuery = useQuery({ queryKey: ['batches', farmId], queryFn: () => fetchBatches(farmId) });
  const batches = (batchesQuery.data ?? []).filter((b) => b.status !== 'CLOTURE');

  const feedStockQuery = useQuery({
    queryKey: ['feed-stock', farmId],
    queryFn: () => fetchFeedStock(farmId),
    staleTime: 60_000,
  });
  const feedStock = feedStockQuery.data;

  const [lotId, setLotId] = useState(initialBatchId ?? '');
  const lot = batches.find((b) => b.id === lotId) ?? batches[0];
  const isLayer = lot?.type === 'PONDEUSE';

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<DailyEntryValues>(baseline);
  const [modeFeed, setModeFeed] = useState<'kg' | 'sacs'>('kg');
  const [saved, setSaved] = useState(false);
  const [queued, setQueued] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultFeedPhase = (b: typeof lot): FeedPhase => (b?.type === 'PONDEUSE' ? 'PONTE_PHASE_1' : 'DEMARRAGE');

  const suggestedLotFor = (t: FeedPhase): string | null => {
    const found = feedStock?.byType.find((x) => x.feedPhase === t);
    return found?.suggestedLotId ?? null;
  };

  const feedPhase: FeedPhase = values.feedPhase ?? defaultFeedPhase(lot);
  const suggestedFeedLotId = suggestedLotFor(feedPhase);
  const chosenFeedLotId = values.inputLotId === undefined ? suggestedFeedLotId : values.inputLotId;

  const feedLotsOfType = (feedStock?.lots ?? [])
    .filter((l) => l.feedPhase === feedPhase && l.availableKg > 0)
    .sort((a, b) => {
      if (a.id === suggestedFeedLotId) return -1;
      if (b.id === suggestedFeedLotId) return 1;
      return b.availableKg - a.availableKg;
    });

  const chooseFeedType = (t: FeedPhase) => {
    setValues((v) => ({ ...v, feedPhase: t, inputLotId: undefined }));
    setError(null);
  };

  const chooseFeedLot = (id: string | null) => {
    setValues((v) => ({ ...v, inputLotId: id }));
    setError(null);
  };

  const pickBatch = (b: { id: string; type?: string }) => {
    setLotId(b.id);
    setValues((v) => ({ ...v, feedPhase: b.type === 'PONDEUSE' ? 'PONTE_PHASE_1' : 'DEMARRAGE', inputLotId: undefined }));
  };

  const steps = useMemo(() => {
    const hint = (s: string) => (mode === 'demo' ? s : undefined);
    const list = [
      { key: 'deaths', label: 'Morts', icon: Skull, hint: hint('Hier : 3') },
      { key: 'feed', label: 'Aliments', icon: Feather, hint: hint('Hier : 180 kg') },
      { key: 'water', label: 'Eau', icon: Wine, hint: hint('Hier : 480 L') },
      { key: 'weight', label: 'Poids moyen', icon: Scale, hint: hint('Il y a 7 j : 1 820 g') },
    ];
    if (isLayer) list.push({ key: 'eggs', label: 'Ponte', icon: CheckCircle2, hint: hint('Hier : 390 œufs') });
    return list;
  }, [isLayer, mode]);

  const isLast = step === steps.length - 1;

  const set = (key: keyof DailyEntryValues) => (n: number) => {
    setValues((v) => ({ ...v, [key]: n }));
    setError(null);
  };

  const success = (queued: boolean) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setQueued(queued);
    setSaved(true);
    setTimeout(onClose, 1100);
  };

  const save = async () => {
    if (!lot) return;
    const prepared: DailyEntryValues = {
      ...values,
      feedPhase,
      inputLotId: chosenFeedLotId,
    };
    const payload = buildDailyEntryPayload(prepared, { isLayer, feedMode: modeFeed });
    if (mode === 'live' && Object.keys(payload).length <= 1) {
      setError('Rien à enregistrer : saisissez au moins une valeur.');
      return;
    }
    if (mode === 'live') {
      setSaving(true);
      setError(null);
      try {
        const result = await queueDailyEntry(farmId, lot.id, payload);
        if (result.status === 'sent') invalidateFarmQueries(queryClient, { farmId, batchId: lot.id });
        success(result.status === 'queued');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde.');
        setSaving(false);
        return;
      }
    } else {
      success(false);
    }
  };

  if (saved) {
    return (
      <View style={styles.savedWrap}>
        <Check size={54} color={palette.green[600]} strokeWidth={3} />
        <AppText size="h3" weight="bold" color="text">
          Saisie enregistrée
        </AppText>
        <AppText size="caption" color="muted">
          {mode === 'live'
            ? queued
              ? 'Mise en attente · sera synchronisée le retour en ligne'
              : 'Envoyée au serveur et analysée.'
            : 'En attente de synchronisation'}
        </AppText>
      </View>
    );
  }

  const current = steps[step];

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
      <View style={{ gap: spacing.lg }}>
        <View style={styles.lotsRow}>
          {(batches.length > 0 ? batches : []).map((b) => (
            <Pressable key={b.id} onPress={() => pickBatch(b)} accessibilityRole="button">
              <Chip label={b.batchName ?? b.id} tone="brand" selected={lot?.id === b.id} style={styles.lotChip} />
            </Pressable>
          ))}
          {batches.length === 0 ? (
            <AppText size="caption" color="muted">
              Aucun lot actif.
            </AppText>
          ) : null}
        </View>

        <View style={styles.progressRow}>
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <View key={s.key} style={styles.stepItem}>
                <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
                  {i < step ? <Check size={11} color={color.surface} /> : null}
                </View>
                <View style={styles.stepIcon}>
                  <Icon size={14} color={i === step ? color.brand[600] : palette.ink[400]} />
                </View>
              </View>
            );
          })}
        </View>

        <Card tone="brand" style={{ gap: 4 }}>
          <AppText size="h3" weight="bold" color="text">
            {current.label}
          </AppText>
          <AppText size="caption" color="muted">
            {current.hint}
          </AppText>
        </Card>

        {current.key === 'deaths' && (
          <Stepper value={values.deaths} onChange={set('deaths')} step={1} quickSteps={[1, 5, 10]} min={0} max={100} big />
        )}

        {current.key === 'feed' && (
          <View style={{ gap: spacing.lg }}>
            <Segmented
              options={FEED_PHASES.map((t) => ({ key: t, label: FEED_PHASE_LABELS[t] }))}
              value={feedPhase}
              onChange={chooseFeedType}
            />

            <View style={{ gap: 6 }}>
              <AppText size="small" weight="semibold" color="muted">
                Lot de provende ({FEED_PHASE_LABELS[feedPhase]} · suggestion FEFO en premier)
              </AppText>
              <View style={styles.lotsRow}>
                <Pressable onPress={() => chooseFeedLot(null)} accessibilityRole="button">
                  <Chip
                    label="Ferme entière"
                    tone="neutral"
                    selected={chosenFeedLotId === null}
                    style={styles.lotChip}
                  />
                </Pressable>
                {feedLotsOfType.map((l) => {
                  const label = `${l.productName} · ${Math.round(l.availableKg)} kg`;
                  const suggested = l.id === suggestedFeedLotId;
                  return (
                    <Pressable key={l.id} onPress={() => chooseFeedLot(l.id)} accessibilityRole="button">
                      <Chip
                        label={suggested ? `${label} ✓` : label}
                        tone={chosenFeedLotId === l.id ? 'accent' : 'brand'}
                        selected={chosenFeedLotId === l.id}
                        style={styles.lotChip}
                      />
                    </Pressable>
                  );
                })}
                {feedLotsOfType.length === 0 ? (
                  <AppText size="caption" color="muted">
                    Aucun lot de {FEED_PHASE_LABELS[feedPhase].toLowerCase()} en stock — la déduction se fera au niveau ferme.
                  </AppText>
                ) : null}
              </View>
            </View>

            <Segmented
              options={[
                { key: 'kg', label: 'kg' },
                { key: 'sacs', label: 'sacs' },
              ]}
              value={modeFeed}
              onChange={setModeFeed}
            />
            <Stepper
              value={modeFeed === 'kg' ? values.feedKg : values.feedSacs}
              onChange={(n) => (modeFeed === 'kg' ? set('feedKg')(n) : set('feedSacs')(n))}
              step={modeFeed === 'kg' ? 5 : 1}
              quickSteps={modeFeed === 'kg' ? [5, 25, 50, 100] : [1, 2, 5]}
              min={0}
              max={modeFeed === 'kg' ? 5000 : 100}
              suffix={modeFeed === 'kg' ? 'kg' : 'sacs'}
              big
            />
          </View>
        )}

        {current.key === 'water' && (
          <Stepper value={values.waterL} onChange={set('waterL')} step={5} quickSteps={[10, 50, 100, 200]} min={0} max={2000} suffix="L" big />
        )}

        {current.key === 'weight' && (
          <Stepper value={values.weightG} onChange={set('weightG')} step={10} quickSteps={[50, 100, 500]} min={0} max={5000} suffix="g" big />
        )}

        {current.key === 'eggs' && (
          <View style={{ gap: spacing.lg }}>
            <Stepper value={values.eggs} onChange={set('eggs')} step={5} quickSteps={[10, 50, 100]} min={0} max={2000} suffix="œufs" />
            <Stepper value={values.eggsCracked} onChange={set('eggsCracked')} step={1} quickSteps={[1, 5, 10]} min={0} max={200} suffix="fêlés" />
          </View>
        )}

        {error ? (
          <AppText size="small" color="danger">
            {error}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          {step > 0 && (
            <Button label="Retour" tone="ghost" size="md" block={false} onPress={() => setStep((s) => s - 1)} />
          )}
          <View style={{ flex: 1 }}>
            <Button
              label={isLast ? 'Enregistrer' : 'Continuer'}
              tone="accent"
              loading={saving}
              onPress={() => (isLast ? void save() : setStep((s) => s + 1))}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lotChip: {},
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  stepItem: {
    alignItems: 'center',
    gap: 2,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  stepDotActive: {
    borderColor: color.brand[600],
    backgroundColor: color.brand[600],
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  savedWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.huge,
  },
});