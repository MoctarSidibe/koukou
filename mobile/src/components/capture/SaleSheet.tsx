import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { Stepper } from '../ui/Stepper';
import { useAuth } from '@/auth/AuthContext';
import { fetchBatches, fetchPromotions } from '@/api';
import { invalidateFarmQueries } from '@/api/invalidate';
import { canManageFarm } from '@/api/roles';
import { buildSaleItem, DEFAULT_AVG_WEIGHT_KG, todayStr, type PosProduct } from '@/api/mutations';
import { queueSale } from '@/offline';
import { color, palette, fmt, fmtFcfa, spacing } from '@/constants/theme';

interface SaleSheetProps {
  initialBatchId?: string;
  onClose: () => void;
}

const PRODUCTS: {
  key: PosProduct;
  label: string;
  unit: string;
  priceUnit: string;
  unitPrice: number;
}[] = [
  { key: 'PIECE', label: 'Poulet (pièce)', unit: 'pcs', priceUnit: 'pièce', unitPrice: 2500 },
  { key: 'KG', label: 'Poulet (kg)', unit: 'oiseaux', priceUnit: 'kg', unitPrice: 2200 },
  { key: 'OEUF', label: 'Œufs (alvéole)', unit: 'alv.', priceUnit: 'alvéole', unitPrice: 2500 },
  { key: 'AUTRE', label: 'Autre', unit: 'u', priceUnit: 'unité', unitPrice: 1000 },
];

function demoSaleRef(): string {
  return `VTE-${todayStr().replaceAll('-', '')}-${1000 + Math.floor(Math.random() * 9000)}`;
}

export function SaleSheet({ initialBatchId, onClose }: SaleSheetProps) {
  const { mode, user, farmId } = useAuth();
  const canManage = canManageFarm(user.role);
  const queryClient = useQueryClient();

  const batchesQuery = useQuery({ queryKey: ['batches', farmId], queryFn: () => fetchBatches(farmId) });
  const sellable = (batchesQuery.data ?? []).filter((b) => b.status === 'EN_VENTE' || b.status === 'ACTIF');
  const promotionsQuery = useQuery({ queryKey: ['promotions', farmId], queryFn: () => fetchPromotions(farmId), enabled: canManage });
  const activeCodes = (promotionsQuery.data ?? []).filter((p) => p.active).map((p) => p.code);

  const [lotId, setLotId] = useState(initialBatchId ?? '');
  const lot = sellable.find((b) => b.id === lotId) ?? sellable[0];

  const [product, setProduct] = useState<PosProduct>('PIECE');
  const [qty, setQty] = useState(0);
  const [sold, setSold] = useState(false);
  const [soldRef, setSoldRef] = useState('');
  const [queued, setQueued] = useState(false);
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [promoCode, setPromoCode] = useState('');

  const meta = PRODUCTS.find((p) => p.key === product)!;

  const invoice = () => {
    const fields: { customerName?: string; customerPhone?: string; promoCode?: string } = {};
    if (clientName.trim()) fields.customerName = clientName.trim();
    if (clientPhone.trim()) fields.customerPhone = clientPhone.trim();
    if (promoCode.trim()) fields.promoCode = promoCode.trim().toUpperCase();
    return Object.keys(fields).length > 0 ? fields : undefined;
  };

  const weightKg = product === 'KG' ? Math.round(qty * DEFAULT_AVG_WEIGHT_KG * 100) / 100 : null;
  const total = product === 'KG' ? Math.round(qty * DEFAULT_AVG_WEIGHT_KG * meta.unitPrice) : qty * meta.unitPrice;

  const success = (ref: string, isQueued: boolean) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSoldRef(ref);
    setQueued(isQueued);
    setSold(true);
    setTimeout(onClose, 1300);
  };

  const sell = async () => {
    if (total <= 0) return;
    if (mode === 'demo') {
      success(demoSaleRef(), false);
      return;
    }

    const built = buildSaleItem(product, qty, meta.unitPrice, lot?.id ?? null, {
      avgWeightKg: DEFAULT_AVG_WEIGHT_KG,
    });
    if ('error' in built) {
      setError(built.error);
      return;
    }

    setSelling(true);
    setError(null);
    try {
      const result = await queueSale(farmId, todayStr(), [built.item], total, invoice());
      if (result.status === 'sent') {
        invalidateFarmQueries(queryClient, { farmId, batchId: lot?.id });
        success(result.reference ?? '', false);
      } else {
        success('PEND', true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la vente.');
      setSelling(false);
    }
  };

  if (sold) {
    return (
      <View style={styles.savedWrap}>
        <Check size={54} color={palette.green[600]} strokeWidth={3} />
        <AppText size="h3" weight="bold" color="text">
          Vente encaissée
        </AppText>
        <AppText size="caption" color="muted">
          {soldRef === 'PEND'
            ? 'Mise en attente · sera encaissée le retour en ligne'
            : soldRef}
        </AppText>
        <AppText size="caption" color="faint">
          {queued || mode === 'demo' ? 'En attente de synchronisation' : 'Encaissée espèces · caisse journalière'}
        </AppText>
      </View>
    );
  }

  const maxQty = product === 'PIECE' || product === 'KG' ? (lot?.quantityAlive ?? 0) : product === 'OEUF' ? 200 : 1000;

  return (
    <View style={{ gap: spacing.lg }}>
      <View>
        <AppText size="label" color="muted">
          LOT
        </AppText>
        <View style={styles.rowWrap}>
          {(sellable.length > 0 ? sellable : []).map((b) => (
            <Pressable key={b.id} onPress={() => setLotId(b.id)} accessibilityRole="button">
              <Chip
                label={`${b.batchName ?? b.id} · ${fmt(b.quantityAlive)}`}
                tone={b.status === 'EN_VENTE' ? 'green' : 'brand'}
                selected={lot?.id === b.id}
                style={styles.chip}
              />
            </Pressable>
          ))}
          {sellable.length === 0 ? (
            <AppText size="caption" color="muted">
              Aucun lot à vendre.
            </AppText>
          ) : null}
        </View>
      </View>

      <View>
        <AppText size="label" color="muted">
          PRODUIT
        </AppText>
        <View style={styles.rowWrap}>
          {PRODUCTS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => {
                setProduct(p.key);
                setQty(0);
                setError(null);
              }}
              accessibilityRole="button">
              <Chip label={p.label} tone="accent" selected={p.key === product} style={styles.chip} />
            </Pressable>
          ))}
        </View>
      </View>

      <Card tone="default" style={{ gap: spacing.sm }}>
        <View style={styles.priceRow}>
          <AppText size="caption" color="muted">
            PRIX UNITAIRE
          </AppText>
          <AppText size="body" weight="semibold" color="text">
            {fmtFcfa(meta.unitPrice)} / {meta.priceUnit}
          </AppText>
        </View>
        {product === 'KG' ? (
          <AppText size="caption" color="muted">
            ≈ {fmt(weightKg ?? 0)} kg estimés · {DEFAULT_AVG_WEIGHT_KG.toLocaleString('fr-FR')} kg/oiseau · décompte par oiseaux
          </AppText>
        ) : null}
        <Stepper
          value={qty}
          onChange={(n) => {
            setQty(n);
            setError(null);
          }}
          step={1}
          quickSteps={product === 'KG' ? [1, 2, 5] : [1, 5, 10, 25]}
          min={0}
          max={maxQty}
          suffix={meta.unit}
          big
        />
      </Card>

      {error ? (
        <AppText size="small" color="danger">
          {error}
        </AppText>
      ) : null}

      <Card tone="default" style={{ gap: spacing.sm }}>
        <AppText size="label" color="muted">
          CLIENT & COUPON — OPTIONNEL
        </AppText>
        <TextInput
          value={clientName}
          onChangeText={setClientName}
          placeholder="Nom du client (restaurant, revendeur…)"
          placeholderTextColor={color.ink[300]}
          style={styles.input}
        />
        <TextInput
          value={clientPhone}
          onChangeText={setClientPhone}
          placeholder="Téléphone (crée ou retrouve la fiche)"
          placeholderTextColor={color.ink[300]}
          keyboardType="phone-pad"
          style={styles.input}
        />
        <TextInput
          value={promoCode}
          onChangeText={(t) => setPromoCode(t.toUpperCase())}
          placeholder="Code promo (ex. BIENVENUE10)"
          placeholderTextColor={color.ink[300]}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
        />
        {activeCodes.length > 0 ? (
          <AppText size="caption" color="faint">
            Codes actifs : {activeCodes.join(' · ')}
          </AppText>
        ) : null}
      </Card>

      <View style={styles.totalRow}>
        <View style={{ flex: 1 }}>
          <AppText size="label" color="muted">
            TOTAL
          </AppText>
          <AppText size="display" weight="bold" color="accent">
            {fmtFcfa(total)}
          </AppText>
        </View>
        <View style={{ width: 140 }}>
          <Button
            label="Encaisser"
            tone="accent"
            icon={Check}
            disabled={total <= 0 || selling}
            loading={selling}
            onPress={sell}
          />
        </View>
      </View>

      <AppText size="caption" color="faint" style={{ textAlign: 'center' }}>
        {mode === 'live'
          ? 'Espèces · la caisse journalière s’ouvre automatiquement si besoin.'
          : 'Espèces uniquement · Mobile Money bientôt disponible'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  savedWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.huge,
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