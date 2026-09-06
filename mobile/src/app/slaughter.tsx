import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX, Check, FileText, Printer, Scale, Send } from 'lucide-react-native';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { Stepper } from '@/components/ui/Stepper';
import { SlaughterStats } from '@/components/slaughter/SlaughterStats';
import { useAuth } from '@/auth/AuthContext';
import { fetchBatches, fetchSlaughterOrders } from '@/api';
import { invalidateFarmQueries } from '@/api/invalidate';
import { downloadPdf } from '@/api/pdf';
import { canManageFarm } from '@/api/roles';
import {
  cancelSlaughterOrder,
  createSlaughterOrder,
  processSlaughterOrder,
  sendSlaughterOrder,
  todayStr,
} from '@/api/mutations';
import type { ProductionBatch, SlaughterDestination, SlaughterOrder, SlaughterStatus, SlaughterType } from '@/api/types';
import { color, palette } from '@/constants/theme';

const STATUS_LABEL: Record<SlaughterStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  PROCESSED: 'Traité',
  CANCELLED: 'Annulé',
};

const TYPE_LABEL: Record<SlaughterType, string> = {
  ABATTU: 'Abattu',
  VIVANT: 'Vivant (transporté)',
};

const DEST_LABEL: Record<SlaughterDestination, string> = {
  INTERNE: 'Interne · abattoir ferme',
  EXTERNE: 'Externe · abattoir partenaire',
};

function toneFor(status: SlaughterStatus) {
  if (status === 'PROCESSED') return 'green' as const;
  if (status === 'SENT') return 'brand' as const;
  if (status === 'CANCELLED') return 'red' as const;
  return 'neutral' as const;
}

export default function SlaughterScreen() {
  const { mode, farms, user, farmId } = useAuth();
  const canManage = canManageFarm(user.role);
  const queryClient = useQueryClient();

  const batchesQuery = useQuery({ queryKey: ['batches', farmId], queryFn: () => fetchBatches(farmId) });
  const ordersQuery = useQuery({ queryKey: ['slaughter-orders', farmId], queryFn: () => fetchSlaughterOrders(farmId) });
  const lots = (batchesQuery.data ?? []).filter((b) => b.status === 'ACTIF' || b.status === 'EN_VENTE');

  const [lotId, setLotId] = useState('');
  const lot = lots.find((b) => b.id === lotId) ?? lots[0];

  const [sType, setType] = useState<SlaughterType>('ABATTU');
  const [dest, setDest] = useState<SlaughterDestination>('EXTERNE');
  const [birds, setBirds] = useState(0);
  const [date, setDate] = useState(todayStr());
  const [abattoirCode, setAbattoirCode] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (order: SlaughterOrder) => {
    if (mode === 'demo') {
      Alert.alert('Disponible en mode connecté', 'Le bordereau PDF est généré par le serveur. Connectez-vous à votre ferme pour le télécharger.');
      return;
    }
    setBusy(order.id);
    try {
      await downloadPdf(`/farms/${farmId}/slaughter-orders/${order.id}/bordereau`, `${order.referenceNumber}.pdf`);
      Alert.alert('Bordereau téléchargé', `Partagez « ${order.referenceNumber}.pdf » avec l’abattoir.`);
    } catch (e) {
      Alert.alert('Téléchargement impossible', e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setBusy(null);
    }
  };

  const downloadPasseport = async (b: ProductionBatch) => {
    if (mode === 'demo') {
      Alert.alert('Disponible en mode connecté', 'Le passeport sanitaire PDF est généré par le serveur. Connectez-vous à votre ferme pour le télécharger.');
      return;
    }
    setBusy(b.id);
    try {
      await downloadPdf(`/farms/${farmId}/batches/${b.id}/passeport`, `passeport-${b.batchName ?? b.id}.pdf`);
      Alert.alert('Passeport sanitaire', `« passeport-${b.batchName ?? b.id}.pdf » enregistré : il certifie la conformité sanitaire du lot pour l’abattoir.`);
    } catch (e) {
      Alert.alert('Téléchargement impossible', e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setBusy(null);
    }
  };

  const invalidate = async () => {
    await invalidateFarmQueries(queryClient, { farmId, batchId: lot?.id });
  };

  const create = async () => {
    const lotNow = lot;
    if (!lotNow || birds <= 0) return;
    setError(null);
    setBusy('create');
    try {
      if (mode === 'live') {
        await createSlaughterOrder(farmId, {
          batchId: lotNow.id,
          slaughterType: sType,
          destination: dest,
          plannedDate: date || todayStr(),
          birdCount: birds,
          ...(abattoirCode.trim() ? { abattoirLotCode: abattoirCode.trim() } : {}),
          ...(notes.trim() ? { abattoirNotes: notes.trim() } : {}),
        });
      } else {
        await new Promise<void>((r) => setTimeout(r, 400));
      }
      setBirds(0);
      setAbattoirCode('');
      setNotes('');
      await invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création de l’ordre.');
    } finally {
      setBusy(null);
    }
  };

  const act = async (order: SlaughterOrder, action: 'send' | 'process' | 'cancel') => {
    setError(null);
    if (action === 'cancel') {
      Alert.alert('Annuler l’ordre', `${order.referenceNumber} sera annulé. Confirmer ?`, [
        { text: 'Non', style: 'cancel' },
        { text: 'Annuler', style: 'destructive', onPress: () => void run() },
      ]);
      return;
    }
    await run();
    async function run() {
      setBusy(order.id);
      try {
        if (mode === 'live') {
          if (action === 'send') {
            await sendSlaughterOrder(farmId, order.id, { abattoirLotCode: order.abattoirLotCode ?? undefined });
          } else if (action === 'process') {
            await processSlaughterOrder(farmId, order.id, { abattoirLotCode: order.abattoirLotCode ?? undefined });
          } else {
            await cancelSlaughterOrder(farmId, order.id, 'Annulé depuis le mobile');
          }
        } else {
          await new Promise<void>((r) => setTimeout(r, 400));
        }
        await invalidate();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur lors de l’opération sur l’ordre.');
      } finally {
        setBusy(null);
      }
    }
  };

  const orders = ordersQuery.data ?? [];

  return (
    <Screen>
      <ScreenHeader title="Abattage & passeport" subtitle={farms[0]?.name ?? 'Ferme'} back right={<Scale size={18} color={color.ink[300]} />} />

      {batchesQuery.isLoading ? (
        <Spinner label="Chargement des lots…" />
      ) : lots.length === 0 ? (
        <AppText size="caption" color="muted">
          Aucun lot actif.
        </AppText>
      ) : (
        <>
          {canManage ? (
            <>
              <View style={styles.lotHead}>
                <AppText size="label" color="muted">
                  LOT À ABATTRE
                </AppText>
                <Button label="Passeport sanitaire" tone="ghost" size="md" block={false} icon={Printer} onPress={() => lot && void downloadPasseport(lot)} disabled={busy !== null} loading={busy === lot?.id} />
              </View>
              <View style={styles.rowWrap}>
                {lots.map((b) => (
                  <Pressable key={b.id} onPress={() => setLotId(b.id)} accessibilityRole="button">
                    <Chip
                      label={`${b.batchName ?? b.id} · ${b.quantityAlive ?? 0}`}
                      tone={b.status === 'EN_VENTE' ? 'green' : 'brand'}
                      selected={lot?.id === b.id}
                      style={styles.chip}
                    />
                  </Pressable>
                ))}
              </View>

              <Card tone="default" style={styles.formCard}>
                <AppText size="label" color="muted" style={{ marginBottom: 4 }}>
                  NOUVEL ORDRE — {lot?.batchName ?? ''}
                </AppText>
                <Segmented
                  options={[
                    { key: 'ABATTU', label: 'Abattu' },
                    { key: 'VIVANT', label: 'Vivant' },
                  ]}
                  value={sType}
                  onChange={setType}
                />
                <Segmented
                  options={[
                    { key: 'EXTERNE', label: 'Externe' },
                    { key: 'INTERNE', label: 'Interne' },
                  ]}
                  value={dest}
                  onChange={setDest}
                />
                <Stepper
                  value={birds}
                  onChange={(n) => {
                    setBirds(n);
                    setError(null);
                  }}
                  step={1}
                  quickSteps={[5, 10, 25, 50]}
                  min={0}
                  max={lot?.quantityAlive ?? 0}
                  suffix="oiseaux"
                />
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder="Date prévue (AAAA-MM-JJ)"
                  placeholderTextColor={color.ink[300]}
                  autoCapitalize="none"
                  style={styles.input}
                  editable={busy === null}
                />
                {sType === 'ABATTU' && dest === 'EXTERNE' ? (
                  <>
                    <TextInput
                      value={abattoirCode}
                      onChangeText={setAbattoirCode}
                      placeholder="Code lot abattoir (optionnel, saisi manuellement)"
                      placeholderTextColor={color.ink[300]}
                      style={styles.input}
                      editable={busy === null}
                    />
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Instructions abattoir (optionnel)"
                      placeholderTextColor={color.ink[300]}
                      style={styles.input}
                      editable={busy === null}
                    />
                  </>
                ) : null}
                {error ? (
                  <AppText size="small" color="danger">
                    {error}
                  </AppText>
                ) : null}
                <Button label="Créer l’ordre" tone="accent" icon={FileText} onPress={() => void create()} disabled={busy !== null} loading={busy === 'create'} />
                <AppText size="caption" color="faint" style={{ textAlign: 'center' }}>
                  {mode === 'live' ? 'Envoi : les critères sanitaires du lot sont vérifiés côté serveur.' : 'Démo · opération simulée'}
                </AppText>
              </Card>
            </>
          ) : (
            <Card tone="default" style={styles.card}>
              <AppText size="label" color="muted" style={{ marginBottom: 6 }}>
                ORDRES D’ABATTAGE
              </AppText>
              <AppText size="body" color="muted">
                La création, l’envoi et le traitement des ordres sont réservés au propriétaire. Vous pouvez suivre les ordres en cours et télécharger les bordereaux PDF.
              </AppText>
            </Card>
          )}

          <SlaughterStats orders={orders} lot={lot} />

          <SectionHeader title="Ordres d’abattage" subtitle={orders.length > 0 ? `${orders.length} ordre(s)` : undefined} />
          <View style={{ gap: 10 }}>
            {ordersQuery.isLoading ? (
              <Spinner label="Lecture des ordres…" />
            ) : orders.length === 0 ? (
              <AppText size="caption" color="muted">
                Aucun ordre d’abattage pour l’instant.
              </AppText>
            ) : (
              orders.map((o) => {
                const done = o.status === 'PROCESSED';
                const cancelled = o.status === 'CANCELLED';
                return (
                  <Card key={o.id} tone={done ? 'green' : cancelled ? 'plain' : o.status === 'SENT' ? 'brand' : 'default'} style={styles.card}>
                    <View style={styles.head}>
                      <View style={styles.headBody}>
                        <AppText size="body" weight="bold" color="text">
                          {o.referenceNumber}
                        </AppText>
                        <AppText size="caption" color="muted">
                          {o.batch?.batchName ?? o.batchId} · {TYPE_LABEL[o.slaughterType] ?? o.slaughterType}
                        </AppText>
                        <AppText size="caption" color="muted">
                          {DEST_LABEL[o.destination] ?? o.destination} · {o.plannedDate?.slice(0, 10)}
                        </AppText>
                        <AppText size="caption" color="muted">
                          {o.birdCount} oiseaux
                          {o.totalWeightKg ? ` · ≈ ${o.totalWeightKg} kg vif` : ''}
                          {o.carcassWeightKg ? ` · ${o.carcassWeightKg} kg carcasse` : ''}
                          {o.rendementPercent ? ` · ${o.rendementPercent} %` : ''}
                        </AppText>
                        {o.internalBatchCode ? (
                          <AppText size="caption" color="muted">
                            Code interne : {o.internalBatchCode}
                          </AppText>
                        ) : null}
                        {o.abattoirLotCode ? (
                          <AppText size="caption" color="muted">
                            Code abattoir : {o.abattoirLotCode}
                          </AppText>
                        ) : null}
                        {o.abattoirNotes ? (
                          <AppText size="caption" color="faint">
                            {o.abattoirNotes}
                          </AppText>
                        ) : null}
                        {o.processedAt ? (
                          <AppText size="caption" color="success">
                            Traité le {o.processedAt.slice(0, 10)}
                          </AppText>
                        ) : null}
                      </View>
                      <Chip label={STATUS_LABEL[o.status] ?? o.status} tone={toneFor(o.status)} dot />
                    </View>
                    {o.destination === 'EXTERNE' ? (
                      <View style={styles.actions}>
                        <Button label="Bordereau PDF" tone="ghost" size="md" block={false} icon={FileText} onPress={() => void download(o)} disabled={busy !== null} loading={busy === o.id} />
                      </View>
                    ) : null}
                    {canManage && (o.status === 'DRAFT' || o.status === 'SENT') ? (
                      <View style={styles.actions}>
                        {o.status === 'DRAFT' ? (
                          <Button label="Envoyer" tone="brand" size="md" block={false} icon={Send} onPress={() => void act(o, 'send')} disabled={busy !== null} loading={busy === o.id} />
                        ) : (
                          <Button label="Traiter" tone="success" size="md" block={false} icon={Check} onPress={() => void act(o, 'process')} disabled={busy !== null} loading={busy === o.id} />
                        )}
                        <Button label="Annuler" tone="ghost" size="md" block={false} icon={CalendarX} onPress={() => void act(o, 'cancel')} disabled={busy !== null} />
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </View>
        </>
      )}
    </Screen>
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
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lotHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chip: {
    marginBottom: 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  headBody: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
});