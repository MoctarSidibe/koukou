import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { ArrowRightLeft, RotateCcw, Store } from 'lucide-react-native';

import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { EmptyState } from '../ui/EmptyState';
import { NumberInput } from '../ui/NumberInput';
import { Sheet } from '../ui/Sheet';
import { SPECIES_ICONS, speciesLabel } from '@/api/format';
import { cancelCarcassTransferQueued, createCarcassTransferQueued } from '@/offline';
import type { CarcassTransfer, PointOfSale, SlaughterOrder } from '@/api/types';
import { color, radii, spacing, fmt } from '@/constants/theme';

import { transferRemaining } from './catalog';

interface TransferSheetProps {
  visible: boolean;
  farmId: string;
  /** Ordres d'abattage PROCESSED (ABATTU) avec carcasses disponibles. */
  pools: SlaughterOrder[];
  /** Boutiques actives destinataires du transfert. */
  boutiques: PointOfSale[];
  /** Tous les transferts connus (liste des réserves + restes). */
  transfers: CarcassTransfer[];
  onChanged: () => void;
  onClose: () => void;
}

export function TransferSheet({ visible, farmId, pools, boutiques, transfers, onChanged, onClose }: TransferSheetProps) {
  const [orderId, setOrderId] = useState('');
  const [boutiqueId, setBoutiqueId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const eligiblePools = pools.filter((p) => (p.carcassesAvailable ?? 0) > 0);
  const activeTransfers = transfers.filter(
    (t) => t.status === 'TRANSFERRED' && transferRemaining(t.quantity, t.quantitySold) > 0,
  );

  const order = eligiblePools.find((p) => p.id === orderId);

  useEffect(() => {
    if (!visible) return;
    setOrderId('');
    setBoutiqueId(boutiques.length === 1 ? boutiques[0].id : '');
    setQuantity(0);
    setBusy(false);
    setError(null);
    setDoneMsg(null);
  }, [visible, boutiques]);

  const maxQuantity = order ? (order.carcassesAvailable ?? 0) : 0;

  const create = async () => {
    if (!order) {
      setError('Sélectionnez un ordre d’abattage avec des carcasses disponibles.');
      return;
    }
    if (!boutiqueId) {
      setError('Sélectionnez la boutique destinataire.');
      return;
    }
    if (quantity <= 0 || quantity > maxQuantity) {
      setError(`Quantité invalide (1 à ${fmt(maxQuantity)} carcasses).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createCarcassTransferQueued(farmId, {
        slaughterOrderId: order.id,
        pointOfSaleId: boutiqueId,
        quantity,
      });
      setDoneMsg(
        result.status === 'sent'
          ? 'Transfert enregistré · carcasses réservées en boutique.'
          : 'Hors ligne : transfert mis en file d’attente.',
      );
      onChanged();
      setQuantity(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du transfert.');
    } finally {
      setBusy(false);
    }
  };

  const cancelTransfer = (transfer: CarcassTransfer) => {
    const remaining = transferRemaining(transfer.quantity, transfer.quantitySold);
    Alert.alert(
      'Annuler ce transfert ?',
      `${fmt(remaining)} carcasse(s) non vendue(s) retourneront au stock de l’abattoir.`,
      [
        { text: 'Retour' },
        {
          text: 'Annuler le transfert',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await cancelCarcassTransferQueued(farmId, transfer.id);
                onChanged();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Erreur lors de l’annulation.');
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Transférer des carcasses"
      subtitle="Ferme → boutique · réserve vendable sur le point de vente"
      icon={<ArrowRightLeft size={22} color={color.brand[600]} />}
      accentColor={color.brand[400]}>
      <View style={{ gap: spacing.lg }}>
        <Card tone="default" style={{ gap: spacing.sm }}>
          <AppText size="label" color="muted">
            1 · ORDRE D’ABATTAGE SOURCE {order ? `· ${fmt(maxQuantity)} disponible(s)` : ''}
          </AppText>
          <View style={styles.rowWrap}>
            {eligiblePools.map((p) => (
              <Pressable key={p.id} onPress={() => setOrderId(p.id)} accessibilityRole="button">
                <Chip
                  label={`${SPECIES_ICONS[p.batch.species] ?? ''} ${p.batch.batchName ?? 'Lot'} · ${fmt(p.carcassesAvailable ?? 0)}`}
                  tone="amber"
                  selected={p.id === orderId}
                />
              </Pressable>
            ))}
            {eligiblePools.length === 0 ? (
              <AppText size="caption" color="muted">
                Aucune carcasse à l’abattoir pour le moment.
              </AppText>
            ) : null}
          </View>

          <AppText size="label" color="muted" style={{ marginTop: spacing.sm }}>
            2 · BOUTIQUE DESTINATAIRE
          </AppText>
          <View style={styles.rowWrap}>
            {boutiques.map((b) => (
              <Pressable key={b.id} onPress={() => setBoutiqueId(b.id)} accessibilityRole="button">
                <Chip label={`🏪 ${b.name}`} tone="accent" selected={b.id === boutiqueId} />
              </Pressable>
            ))}
            {boutiques.length === 0 ? (
              <AppText size="caption" color="muted">
                Créez d’abord une boutique active (gestion des points de vente).
              </AppText>
            ) : null}
          </View>

          <AppText size="label" color="muted" style={{ marginTop: spacing.sm }}>
            3 · QUANTITÉ (CARCASSES)
          </AppText>
          <NumberInput
            value={quantity > 0 ? String(quantity) : ''}
            onChangeText={(t) => {
              setQuantity(Math.min(parseInt(t, 10) || 0, Math.max(maxQuantity, 1)));
              setError(null);
            }}
            suffix="carc."
            placeholder="0"
          />

          {error ? (
            <AppText size="small" color="danger">
              {error}
            </AppText>
          ) : null}
          {doneMsg ? (
            <AppText size="small" color="success">
              {doneMsg}
            </AppText>
          ) : null}

          <Button
            label="Transférer"
            tone="brand"
            icon={Store}
            loading={busy}
            disabled={busy || !order || !boutiqueId || quantity <= 0}
            onPress={() => void create()}
          />
          <AppText size="caption" color="muted">
            La carcasse quitte le pool de l’abattoir et devient une réserve vendable sur la boutique.
          </AppText>
        </Card>

        <View>
          <View style={styles.sectionRow}>
            <AppText size="label" color="muted">
              RÉSERVES ACTIVES EN BOUTIQUE · {fmt(activeTransfers.length)}
            </AppText>
          </View>
          {activeTransfers.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              {activeTransfers.map((t) => {
                const remaining = transferRemaining(t.quantity, t.quantitySold);
                return (
                  <Card key={t.id} tone="warn" style={styles.transferRow}>
                    <View style={styles.transferInfo}>
                      <AppText size="body" weight="semibold" color="text" numberOfLines={1}>
                        {t.slaughterOrder.batch.batchName ?? t.batchId} → {t.pointOfSale.name}
                      </AppText>
                      <AppText size="caption" color="muted" numberOfLines={1}>
                        {t.slaughterOrder.referenceNumber} · {SPECIES_ICONS[t.slaughterOrder.batch.species] ?? ''}{' '}
                        {speciesLabel(t.slaughterOrder.batch.species)} · {fmt(remaining)}/{fmt(t.quantity)} carc.
                      </AppText>
                    </View>
                    <Pressable
                      onPress={() => cancelTransfer(t)}
                      hitSlop={8}
                      style={styles.cancelBtn}
                      accessibilityRole="button">
                      <RotateCcw size={16} color={color.red[600]} />
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          ) : (
            <Card tone="default">
              <EmptyState
                emoji="📦"
                title="Aucune réserve active"
                description="Transférez des carcasses depuis l’abattoir pour les vendre en boutique."
              />
            </Card>
          )}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  transferInfo: {
    flex: 1,
    gap: 2,
  },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: color.red[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
});