import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, ClipboardList, Plus, Trash2 } from 'lucide-react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { Stepper } from '@/components/ui/Stepper';
import { orderCanalLabel, orderStatusLabel, orderStatusTone, productLabel } from '@/components/orders/labels';
import { useAuth } from '@/auth/AuthContext';
import { fetchBatches, fetchOrders, fetchPointsOfSale } from '@/api';
import { invalidateFarmQueries } from '@/api/invalidate';
import { createOrder, DEFAULT_AVG_WEIGHT_KG, type SaleProductType, type SaleUnit } from '@/api/mutations';
import { canManageFarm } from '@/api/roles';
import type { OrderFull, OrderStatus } from '@/api/types';
import { color, palette, radii, spacing, fmt, fmtFcfa } from '@/constants/theme';

const FILTERS: { key: OrderStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'PENDING', label: 'En attente' },
  { key: 'CONFIRMED', label: 'Confirmées' },
  { key: 'LIVRE', label: 'Livrées' },
  { key: 'CANCELLED', label: 'Annulées' },
];

type OrderProductKey = 'PIECE' | 'KG' | 'ABATTU_PIECE' | 'ABATTU_KG' | 'OEUF';

interface DraftItem {
  productType: SaleProductType;
  label: string;
  quantity: number;
  unitPriceFcfa: number;
  batchId?: string;
  pieceCount?: number;
  unit: SaleUnit;
  amountFcfa: number;
}

const ORDER_PRODUCTS: { key: OrderProductKey; label: string; unit: string }[] = [
  { key: 'PIECE', label: 'Sur pied (pièce)', unit: 'pcs' },
  { key: 'KG', label: 'Sur pied (kg)', unit: 'oiseaux' },
  { key: 'OEUF', label: 'Œufs (alvéole)', unit: 'alv.' },
];

function nextExpectedDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

function CreateOrderSheet({ onClose }: { onClose: () => void }) {
  const { farmId } = useAuth();
  const queryClient = useQueryClient();
  const batchesQuery = useQuery({ queryKey: ['batches', farmId], queryFn: () => fetchBatches(farmId) });
  const pdvQuery = useQuery({ queryKey: ['points-of-sale', farmId], queryFn: () => fetchPointsOfSale(farmId) });

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [canal, setCanal] = useState<'FERME' | 'PRECOMMANDE'>('PRECOMMANDE');
  const [delivery, setDelivery] = useState<'FERME' | 'PDV'>('FERME');
  const [pdvId, setPdvId] = useState('');
  const [address, setAddress] = useState('');
  const [expectedDate, setExpectedDate] = useState<Date>(nextExpectedDate);
  const [showDate, setShowDate] = useState(false);
  const [deposit, setDeposit] = useState(0);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [product, setProduct] = useState<OrderProductKey>('PIECE');
  const [lotId, setLotId] = useState('');
  const [qty, setQty] = useState(0);
  const [price, setPrice] = useState(160000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sellable = (batchesQuery.data ?? []).filter(
    (b) => b.quantityAlive > 0 && (b.status === 'EN_VENTE' || b.status === 'ACTIF'),
  );
  const pdvs = (pdvQuery.data ?? []).filter((p) => p.isActive);

  const orderLotId = items.find((i) => i.batchId)?.batchId;
  const total = items.reduce((a, i) => a + i.amountFcfa, 0);

  const addItem = () => {
    if (qty <= 0) {
      setError('Indiquez une quantité.');
      return;
    }
    if (price <= 0) {
      setError('Indiquez un prix unitaire.');
      return;
    }
    if (product !== 'OEUF' && !lotId) {
      setError('Sélectionnez un lot.');
      return;
    }
    if (product !== 'OEUF' && orderLotId && orderLotId !== lotId) {
      setError('Une commande ne peut porter que sur un seul lot.');
      return;
    }
    const birdQty = product === 'KG' || product === 'ABATTU_KG' ? qty : qty;
    const kg = Math.round(birdQty * DEFAULT_AVG_WEIGHT_KG * 100) / 100;
    const isKg = product === 'KG' || product === 'ABATTU_KG';
    const draft: DraftItem = {
      productType:
        product === 'PIECE' ? 'POULET_PIECE' :
        product === 'KG' ? 'POULET_KG' :
        product === 'ABATTU_PIECE' ? 'ABATTU_PIECE' :
        product === 'ABATTU_KG' ? 'ABATTU_KG' : 'OEUFS',
      label: productLabel(product === 'PIECE' ? 'POULET_PIECE' : product === 'KG' ? 'POULET_KG' : product === 'ABATTU_PIECE' ? 'ABATTU_PIECE' : product === 'ABATTU_KG' ? 'ABATTU_KG' : 'OEUFS'),
      quantity: isKg ? kg : qty,
      unitPriceFcfa: price,
      ...(product === 'OEUF' ? {} : { batchId: lotId }),
      ...(isKg ? { pieceCount: qty } : {}),
      unit: (product === 'PIECE' || product === 'ABATTU_PIECE' ? 'PIECE' : isKg ? 'KG' : 'ALVEOLES') as SaleUnit,
      amountFcfa: isKg ? Math.round(kg * price) : qty * price,
    };
    setItems((prev) => [...prev, draft]);
    setQty(0);
    setError(null);
  };

  const submit = async () => {
    if (items.length === 0) {
      setError('Ajoutez au moins un article.');
      return;
    }
    if (deposit > total) {
      setError('L’acompte ne peut pas dépasser le total.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createOrder(farmId, {
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        canal,
        expectedDate: expectedDate.toISOString().slice(0, 10),
        ...(delivery === 'PDV' && pdvId ? { pointOfSaleId: pdvId } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        items: items.map((i) => ({
          productType: i.productType,
          label: i.label,
          quantity: i.quantity,
          unitPriceFcfa: i.unitPriceFcfa,
          batchId: i.batchId,
          pieceCount: i.pieceCount,
          unit: i.unit,
        })),
        ...(deposit > 0 ? { deposit: { amountFcfa: deposit } } : {}),
      });
      invalidateFarmQueries(queryClient, { farmId });
      onClose();
      void res;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création.');
      setBusy(false);
    }
  };

  const isKg = product === 'KG' || product === 'ABATTU_KG';
  const maxQty = product === 'OEUF' ? 200 : sellable.find((b) => b.id === lotId)?.quantityAlive ?? 1000;

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Nouvelle commande"
      subtitle="Bon de commande / précommande · réservation souple"
      icon={<ClipboardList size={22} color={color.brand[600]} />}>
      <View style={{ gap: spacing.lg }}>
        <View style={styles.twoCol}>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <AppText size="label" color="muted">
              CLIENT
            </AppText>
            <TextInput value={customerName} onChangeText={setCustomerName} placeholder="Nom" placeholderTextColor={color.ink[300]} style={styles.input} />
            <TextInput value={customerPhone} onChangeText={setCustomerPhone} placeholder="Téléphone" placeholderTextColor={color.ink[300]} keyboardType="phone-pad" style={styles.input} />
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText size="label" color="muted">
            CANAL
          </AppText>
          <Segmented<'FERME' | 'PRECOMMANDE'>
            value={canal}
            onChange={setCanal}
            options={[
              { key: 'FERME', label: 'Retrait ferme', tint: palette.brand[600] },
              { key: 'PRECOMMANDE', label: 'Précommande', tint: palette.accent[600] },
            ]}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText size="label" color="muted">
            RETRAIT / LIVRAISON
          </AppText>
          <Segmented<'FERME' | 'PDV'>
            value={delivery}
            onChange={(d) => { setDelivery(d); setError(null); }}
            options={[
              { key: 'FERME', label: 'À la ferme', tint: palette.brand[600] },
              { key: 'PDV', label: 'Point de vente', tint: palette.accent[600] },
            ]}
          />
          {delivery === 'PDV' ? (
            <View style={styles.rowWrap}>
              {pdvs.map((p) => (
                <Pressable key={p.id} onPress={() => setPdvId(p.id)} accessibilityRole="button">
                  <Chip label={p.name} tone="brand" selected={p.id === pdvId} />
                </Pressable>
              ))}
              {pdvs.length === 0 ? (
                <AppText size="caption" color="muted">
                  Aucun point de vente actif.
                </AppText>
              ) : null}
            </View>
          ) : null}
          <TextInput value={address} onChangeText={setAddress} placeholder="Adresse de livraison (optionnelle)" placeholderTextColor={color.ink[300]} style={styles.input} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText size="label" color="muted">
            RETRAIT PRÉVU LE
          </AppText>
          <Pressable onPress={() => setShowDate(true)} style={styles.dateBtn} accessibilityRole="button">
            <CalendarDays size={16} color={color.brand[600]} />
            <AppText size="body" weight="semibold" color="text">
              {expectedDate.toISOString().slice(0, 10).split('-').reverse().join('/')}
            </AppText>
          </Pressable>
          {showDate ? (
            <DateTimePicker
              value={expectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(_e: DateTimePickerEvent, d?: Date) => {
                if (Platform.OS === 'android') setShowDate(false);
                if (d) setExpectedDate(d);
              }}
              locale="fr-FR"
            />
          ) : null}
        </View>

        <Card tone="default" style={{ gap: spacing.sm }}>
          <AppText size="label" color="muted">
            ARTICLE À AJOUTER
          </AppText>
          <View style={styles.rowWrap}>
            {ORDER_PRODUCTS.map((p) => (
              <Pressable key={p.key} onPress={() => { setProduct(p.key); setError(null); }} accessibilityRole="button">
                <Chip label={p.label} tone="accent" selected={p.key === product} />
              </Pressable>
            ))}
          </View>
          {product !== 'OEUF' ? (
            <View>
              <AppText size="label" color="muted" style={{ marginTop: 4 }}>
                LOT
              </AppText>
              <View style={styles.rowWrap}>
                {sellable.map((b) => (
                  <Pressable key={b.id} onPress={() => { setLotId(b.id); setError(null); }} accessibilityRole="button">
                    <Chip label={`${b.batchName ?? b.id} · ${fmt(b.quantityAlive)}`} tone={b.status === 'EN_VENTE' ? 'green' : 'brand'} selected={b.id === lotId} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.priceRow}>
            <AppText size="caption" color="muted">
              Prix / {isKg ? 'kg' : product === 'OEUF' ? 'alvéole' : 'pièce'}
            </AppText>
            <TextInput
              value={price > 0 ? String(price) : ''}
              onChangeText={(t) => {
                const n = parseInt(t.replace(/\D/g, ''), 10);
                setPrice(Number.isFinite(n) ? n : 0);
              }}
              keyboardType="number-pad"
              style={styles.priceInput}
            />
          </View>
          <Stepper
            value={qty}
            onChange={setQty}
            step={1}
            quickSteps={isKg ? [1, 2, 5] : product === 'OEUF' ? [1, 5, 10] : [1, 5, 10, 25]}
            min={0}
            max={Math.max(maxQty, 1)}
            suffix={ORDER_PRODUCTS.find((p) => p.key === product)?.unit}
            big
          />
          {isKg ? (
            <AppText size="caption" color="muted">
              ≈ {fmt(Math.round(qty * DEFAULT_AVG_WEIGHT_KG * 100) / 100)} kg estimés
            </AppText>
          ) : null}
          <Button label="Ajouter l’article" tone="brand" size="md" disabled={qty <= 0 || price <= 0} onPress={addItem} />
        </Card>

        {items.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <AppText size="label" color="muted">
              ARTICLES DE LA COMMANDE ({items.length})
            </AppText>
            {items.map((i, idx) => (
              <Card key={`${i.productType}-${idx}`} style={styles.draftRow}>
                <View style={{ flex: 1 }}>
                  <AppText size="body" weight="semibold" color="text" numberOfLines={1}>
                    {i.label}
                  </AppText>
                  <AppText size="small" color="muted">
                    {fmt(i.quantity)} {i.unit} × {fmt(i.unitPriceFcfa)}
                  </AppText>
                </View>
                <AppText size="body" weight="bold" color="text">
                  {fmt(i.amountFcfa)} FCFA
                </AppText>
                <Pressable onPress={() => setItems((prev) => prev.filter((_, n) => n !== idx))} hitSlop={8} accessibilityRole="button">
                  <Trash2 size={16} color={color.red[500]} />
                </Pressable>
              </Card>
            ))}
            <View style={styles.detailRow}>
              <AppText size="body" color="muted">
                Total de la commande
              </AppText>
              <AppText size="h3" weight="bold" color="accent">
                {fmtFcfa(total)}
              </AppText>
            </View>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <AppText size="label" color="muted">
            ACOMPTE (OPTIONNEL)
          </AppText>
          <TextInput
            value={deposit > 0 ? String(deposit) : ''}
            onChangeText={(t) => {
              const n = parseInt(t.replace(/\D/g, ''), 10);
              setDeposit(Number.isFinite(n) ? n : 0);
            }}
            placeholder="Montant encaissé sur la caisse (0 = pas d’acompte)"
            placeholderTextColor={color.ink[300]}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        {error ? (
          <AppText size="small" color="danger">
            {error}
          </AppText>
        ) : null}

        <Button label={deposit > 0 ? `Créer et encaisser ${fmt(deposit)} FCFA` : 'Créer la commande'} tone="accent" loading={busy} disabled={items.length === 0} onPress={() => void submit()} />
      </View>
    </Sheet>
  );
}

export default function CommandesScreen() {
  const { farmId, user } = useAuth();
  const canManage = canManageFarm(user.role);
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const ordersQuery = useQuery({ queryKey: ['orders', farmId], queryFn: () => fetchOrders(farmId) });

  const filtered = useMemo(() => {
    const list = ordersQuery.data ?? [];
    if (filter === 'ALL') return list;
    return list.filter((o) => o.status === filter);
  }, [ordersQuery.data, filter]);

  return (
    <Screen
      header={
        <ScreenHeader
          title="Commandes"
          subtitle="Précommandes & bons de commande"
          back
          right={
            canManage ? (
              <Pressable onPress={() => setCreateOpen(true)} style={styles.addBtn} accessibilityRole="button">
                <Plus size={22} color={color.surface} />
              </Pressable>
            ) : undefined
          }
        />
      }
      bottomPad={96}>
      {ordersQuery.isLoading ? (
        <Spinner label="Chargement des commandes…" />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <View style={styles.rowWrap}>
            {FILTERS.map((f) => (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="button">
                <Chip label={f.label} tone="neutral" selected={filter === f.key} />
              </Pressable>
            ))}
          </View>

          {filtered.length === 0 ? (
            <Card tone="default">
              <AppText size="small" color="muted" style={{ textAlign: 'center' }}>
                Aucune commande {filter === 'ALL' ? '' : `« ${orderStatusLabel(filter)} » `}pour le moment.
              </AppText>
            </Card>
          ) : (
            filtered.map((o) => <OrderCard key={o.id} order={o} />)
          )}
        </View>
      )}

      {createOpen ? <CreateOrderSheet onClose={() => setCreateOpen(false)} /> : null}
    </Screen>
  );
}

function OrderCard({ order }: { order: OrderFull }) {
  const router = useRouter();
  const birds = order.items.reduce((a, i) => a + (i.pieceCount ?? 0), 0);
  return (
    <Card onPress={() => router.push({ pathname: '/commande/[id]', params: { id: order.id } })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <AppText size="caption" color="muted">
            {order.referenceNumber}
          </AppText>
          <AppText size="body" weight="bold" color="text" numberOfLines={1}>
            {order.customer?.fullName ?? 'Client non renseigné'}
          </AppText>
        </View>
        <Chip label={orderStatusLabel(order.status)} tone={orderStatusTone(order.status)} />
      </View>
      <AppText size="small" color="muted">
        {orderCanalLabel(order.canal)} · {order.batch?.batchName ?? 'Œufs'} · {order.items.length} article{order.items.length > 1 ? 's' : ''}
        {birds > 0 ? ` · ${fmt(birds)} volailles` : ''}
      </AppText>
      <View style={[styles.detailRow, { marginTop: 8 }]}>
        <AppText size="small" color="muted">
          {order.expectedDate ? `Prévu le ${order.expectedDate.split('-').reverse().join('/')}` : 'Date à convenir'} · Acompte {fmtFcfa(order.depositFcfa)}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppText size="body" weight="bold" color="accent">
            {fmtFcfa(order.totalAmountFcfa)}
          </AppText>
          <ChevronRight size={16} color={color.ink[300]} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: color.ink[800],
    backgroundColor: color.surface,
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  priceInput: {
    height: 40,
    minWidth: 110,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
    color: color.ink[800],
    backgroundColor: color.surface,
    textAlign: 'right',
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    backgroundColor: color.surface,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: color.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
});