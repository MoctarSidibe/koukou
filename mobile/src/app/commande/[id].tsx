import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Printer, Store, Ticket as TicketCheck, Truck, Wallet, X } from 'lucide-react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { orderCanalLabel, orderStatusLabel, orderStatusTone, productLabel } from '@/components/orders/labels';
import { useAuth } from '@/auth/AuthContext';
import { fetchOrder, fetchPointsOfSale } from '@/api';
import { downloadPdf } from '@/api/pdf';
import { invalidateFarmQueries } from '@/api/invalidate';
import { canManageFarm } from '@/api/roles';
import { cancelOrderQueued, deliverOrderQueued, recordOrderPaymentQueued } from '@/offline/engine';
import type { OrderFull } from '@/api/types';
import { color, palette, radii, spacing, fmt, fmtFcfa } from '@/constants/theme';

function OrderItems({ order }: { order: OrderFull }) {
  return (
    <Card tone="default" style={{ gap: 8 }}>
      <AppText size="label" color="muted">
        ARTICLES
      </AppText>
      {order.items.map((i) => (
        <View key={i.saleItemId || `${i.productType}-${i.label}-${i.quantity}`} style={styles.itemRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText size="body" weight="semibold" color="text" numberOfLines={1}>
              {i.label || productLabel(i.productType)}
            </AppText>
            <AppText size="small" color="muted">
              {fmt(i.quantity)} {i.unit} × {fmt(i.unitPriceFcfa)} FCFA
            </AppText>
          </View>
          <AppText size="body" weight="bold" color="text">
            {fmt(i.amountFcfa)} FCFA
          </AppText>
        </View>
      ))}
      <View style={[styles.divider, { marginVertical: 6 }]} />
      <View style={styles.totalRow}>
        <AppText size="body" color="muted">
          Total
        </AppText>
        <AppText size="h3" weight="bold" color="accent">
          {fmtFcfa(order.totalAmountFcfa)}
        </AppText>
      </View>
      <View style={styles.totalRow}>
        <AppText size="body" color="muted">
          Acomptes versés
        </AppText>
        <AppText size="body" weight="semibold" color="text">
          {fmtFcfa(order.depositFcfa)}
        </AppText>
      </View>
      <View style={styles.totalRow}>
        <AppText size="body" color="muted">
          Reste dû
        </AppText>
        <AppText size="h3" weight="bold" color={order.totalAmountFcfa - order.depositFcfa > 0 ? 'brand' : 'green'}>
          {fmtFcfa(Math.max(order.totalAmountFcfa - order.depositFcfa, 0))}
        </AppText>
      </View>
    </Card>
  );
}

function DepositSheet({ order, onClose }: { order: OrderFull; onClose: () => void }) {
  const { farmId } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = Math.max(order.totalAmountFcfa - order.depositFcfa, 0);

  const submit = async () => {
    if (amount <= 0 || amount > remaining) {
      setError(`Montant entre 1 et ${fmt(remaining)} FCFA.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await recordOrderPaymentQueued(farmId, order.id, amount);
      invalidateFarmQueries(queryClient, { farmId });
      await queryClient.invalidateQueries({ queryKey: ['order', farmId, order.id] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l’encaissement.');
      setBusy(false);
    }
  };

  return (
    <Sheet visible onClose={onClose} title="Encaisser un acompte" subtitle={`Reste dû : ${fmtFcfa(remaining)}`} icon={<Wallet size={22} color={color.brand[600]} />}>
      <View style={{ gap: spacing.lg }}>
        <TextInput
          value={amount > 0 ? String(amount) : ''}
          onChangeText={(t) => {
            const n = parseInt(t.replace(/\D/g, ''), 10);
            setAmount(Number.isFinite(n) ? n : 0);
          }}
          placeholder="Montant (FCFA)"
          placeholderTextColor={color.ink[300]}
          keyboardType="number-pad"
          style={styles.input}
        />
        <View style={styles.rowWrap}>
          {[remaining >= 1000 ? Math.round(remaining / 2 / 100) * 100 : remaining, remaining / 2, remaining]
            .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
            .map((v) => (
              <Pressable key={v} onPress={() => setAmount(Math.round(v))} accessibilityRole="button">
                <Chip label={fmt(Math.round(v)) + ' FCFA'} tone="brand" selected={Math.abs(amount - v) < 50} />
              </Pressable>
            ))}
        </View>
        {error ? (
          <AppText size="small" color="danger">
            {error}
          </AppText>
        ) : null}
        <Button label={`Encaisser ${fmt(amount)} FCFA`} tone="brand" loading={busy} disabled={amount <= 0} onPress={() => void submit()} />
      </View>
    </Sheet>
  );
}

export default function CommandeDetailScreen() {
  const { farmId, user } = useAuth();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const canManage = canManageFarm(user.role);

  const orderQuery = useQuery({ queryKey: ['order', farmId, id], queryFn: () => fetchOrder(farmId, id) });
  const pdvQuery = useQuery({ queryKey: ['points-of-sale', farmId], queryFn: () => fetchPointsOfSale(farmId), enabled: !!orderQuery.data?.pointOfSaleId });

  const [depositOpen, setDepositOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (orderQuery.isLoading || !orderQuery.data) {
    return (
      <Screen header={<ScreenHeader title="Commande" subtitle="" back />}>
        <Spinner label="Chargement de la commande…" />
      </Screen>
    );
  }
  const order = orderQuery.data;
  const pdv = (pdvQuery.data ?? []).find((p) => p.id === order.pointOfSaleId);

  const pulldown = async () => {
    await invalidateFarmQueries(queryClient, { farmId });
    await orderQuery.refetch();
  };

  const doCancel = () => {
    Alert.alert('Annuler la commande', `${order.referenceNumber} sera passée « Annulée ». Confirmer ?`, [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Annuler',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          cancelOrderQueued(farmId, order.id, 'Annulée sur demande de la ferme')
            .then(async () => {
              await invalidateFarmQueries(queryClient, { farmId });
              await orderQuery.refetch();
            })
            .catch((e) => Alert.alert('Annulation impossible', e instanceof Error ? e.message : 'Erreur inattendue.'))
            .finally(() => setBusy(false));
        },
      },
    ]);
  };

  const doDeliver = () => {
    if (order.status !== 'CONFIRMED') {
      Alert.alert('Impossible', 'Encoder un acompte (→ Confirmer) avant de livrer.');
      return;
    }
    Alert.alert('Livrer la commande', 'Le cheptel sera décrémenté et le bon de commande PDF généré. Confirmer ?', [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Livrer',
        onPress: () => {
          setBusy(true);
          deliverOrderQueued(farmId, order.id)
            .then(async () => {
              await invalidateFarmQueries(queryClient, { farmId });
              await orderQuery.refetch();
              Alert.alert('Commande livrée', `${order.referenceNumber} : cheptel mis à jour et bon de commande généré.`);
            })
            .catch((e) => Alert.alert('Livraison impossible', e instanceof Error ? e.message : 'Erreur inattendue.'))
            .finally(() => setBusy(false));
        },
      },
    ]);
  };

  const doPdf = () => {
    downloadPdf(`/farms/${farmId}/orders/${order.id}/bon-de-commande`, `${order.referenceNumber}.pdf`)
      .then(() => Alert.alert('Bon de commande', `« ${order.referenceNumber}.pdf » enregistré sur votre appareil.`))
      .catch((e) => Alert.alert('Téléchargement impossible', e instanceof Error ? e.message : 'Erreur inattendue.'));
  };

  const remaining = Math.max(order.totalAmountFcfa - order.depositFcfa, 0);
  const canLivrer = order.status === 'CONFIRMED';
  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';

  return (
    <Screen header={<ScreenHeader title="Commande" subtitle={order.referenceNumber} back />} bottomPad={128} refreshing={orderQuery.isFetching} onRefresh={() => void pulldown()}>
      <View style={{ gap: spacing.lg }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppText size="body" weight="bold" color="text">
                {order.customer?.fullName ?? 'Client non renseigné'}
              </AppText>
              <AppText size="small" color="muted">
                {order.customer?.phone ?? 'Sans téléphone'}
              </AppText>
            </View>
            <Chip label={orderStatusLabel(order.status)} tone={orderStatusTone(order.status)} />
          </View>
          <View style={[styles.divider, { marginVertical: 12 }]} />
          <View style={{ gap: 8 }}>
            <InfoRow icon={<TicketCheck size={15} color={color.ink[400]} />} label="Canal" value={orderCanalLabel(order.canal)} />
            <InfoRow icon={<Truck size={15} color={color.ink[400]} />} label="Retrait" value={pdv ? `${pdv.name} (point de vente)` : order.address ?? 'À la ferme'} />
            <InfoRow icon={<Store size={15} color={color.ink[400]} />} label="Lot" value={order.batch?.batchName ?? 'Œufs (stock)'} />
            <InfoRow
              icon={<MapPin size={15} color={color.ink[400]} />}
              label="Prévu"
              value={order.expectedDate ? order.expectedDate.split('-').reverse().join('/') : 'À convenir'}
            />
            <InfoRow icon={<X size={15} color={color.ink[400]} />} label="Créée" value={new Date(order.createdAt).toLocaleDateString('fr-FR')} />
            {order.cancelledReason ? <InfoRow icon={<X size={15} color={color.red[500]} />} label="Motif" value={order.cancelledReason} /> : null}
          </View>
        </Card>

        <OrderItems order={order} />

        <View style={{ gap: spacing.sm }}>
          {order.status === 'PENDING' ? (
            <Button label={`Encaisser un acompte · reste ${fmtFcfa(remaining)}`} tone="brand" disabled={busy || remaining <= 0} onPress={() => setDepositOpen(true)} />
          ) : null}
          {canLivrer ? (
            <Button label={`Livrer la commande · reste ${fmtFcfa(remaining)}`} tone="accent" loading={busy} onPress={doDeliver} />
          ) : null}
          {order.status === 'LIVRE' || order.status === 'CANCELLED' ? (
            <Button label="Télécharger le bon de commande PDF" tone="ghost" icon={Printer} onPress={doPdf} />
          ) : null}
          {canManage && canCancel ? (
            <Button label="Annuler la commande" tone="danger" disabled={busy} onPress={doCancel} />
          ) : null}
        </View>
      </View>

      {depositOpen ? <DepositSheet order={order} onClose={() => setDepositOpen(false)} /> : null}
    </Screen>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon}
      <AppText size="small" color="muted">
        {label} :
      </AppText>
      <AppText size="small" weight="semibold" color="text" numberOfLines={2} style={{ flex: 1 }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '700',
    color: color.ink[800],
    backgroundColor: color.surface,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.border,
  },
});