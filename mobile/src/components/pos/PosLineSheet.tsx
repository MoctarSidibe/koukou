import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { CreditCard } from 'lucide-react-native';

import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';
import { SPECIES_ICONS, speciesLabel } from '@/api/format';
import type { PosProduct } from '@/api/mutations';
import { DEFAULT_AVG_WEIGHT_KG } from '@/api/mutations';
import type { BatchWithMetrics, SlaughterOrder } from '@/api/types';
import { color, palette, radii, spacing, fmt } from '@/constants/theme';

import { lineAmount } from './helpers';
import type { PosLine } from './types';

interface PosLineSheetProps {
  visible: boolean;
  lots: BatchWithMetrics[];
  pools: SlaughterOrder[];
  committed?: PosLine[];
  initial?: PosLine;
  presetBatchId?: string;
  onSave: (line: PosLine) => void;
  onClose: () => void;
}

type AbattuMode = 'direct' | 'pool';

const PRODUCTS: {
  key: PosProduct;
  label: string;
  unit: string;
  priceUnit: string;
  unitPrice: number;
  kind?: 'CHAIR' | 'PONDEUSE';
}[] = [
  { key: 'PIECE', label: 'Sur pied (pièce)', unit: 'pcs', priceUnit: 'pièce', unitPrice: 2500, kind: 'CHAIR' },
  { key: 'KG', label: 'Sur pied (kg)', unit: 'oiseaux', priceUnit: 'kg', unitPrice: 2200, kind: 'CHAIR' },
  { key: 'ABATTU_PIECE', label: 'Abattu (pièce)', unit: 'pcs', priceUnit: 'pièce', unitPrice: 2900, kind: 'CHAIR' },
  { key: 'ABATTU_KG', label: 'Abattu (kg)', unit: 'oiseaux', priceUnit: 'kg', unitPrice: 2550, kind: 'CHAIR' },
  { key: 'OEUF', label: 'Œufs (alvéole)', unit: 'alv.', priceUnit: 'alvéole', unitPrice: 2500, kind: 'PONDEUSE' },
  { key: 'AUTRE', label: 'Autre', unit: 'u', priceUnit: 'unité', unitPrice: 1000 },
];

function lotTitle(b: BatchWithMetrics): string {
  const species = b.customSpecies ?? speciesLabel(b.species);
  return `${SPECIES_ICONS[b.species] ?? ''} ${b.batchName ?? species}`;
}

function productMeta(key: PosProduct) {
  return PRODUCTS.find((p) => p.key === key) ?? PRODUCTS[0];
}

export function PosLineSheet({ visible, lots, pools, committed, initial, presetBatchId, onSave, onClose }: PosLineSheetProps) {
  const [product, setProduct] = useState<PosProduct>('PIECE');
  const [abattuMode, setAbattuMode] = useState<AbattuMode>('direct');
  const [lotId, setLotId] = useState('');
  const [poolId, setPoolId] = useState('');
  const [qty, setQty] = useState(0);
  const [price, setPrice] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      const isAbattu = initial.product === 'ABATTU_PIECE' || initial.product === 'ABATTU_KG';
      setProduct(initial.product);
      setAbattuMode(isAbattu && initial.slaughterOrderId ? 'pool' : 'direct');
      setLotId(initial.batchId ?? '');
      setPoolId(initial.slaughterOrderId ?? '');
      setQty(initial.qty);
      setPrice(initial.unitPriceFcfa);
    } else {
      const preset = lots.find((b) => b.id === presetBatchId);
      setProduct(preset?.type === 'PONDEUSE' ? 'OEUF' : 'PIECE');
      setAbattuMode('direct');
      setLotId(preset ? preset.id : '');
      setPoolId('');
      setQty(0);
      setPrice(productMeta(preset?.type === 'PONDEUSE' ? 'OEUF' : 'PIECE').unitPrice);
    }
    setError(null);
  }, [visible, initial, presetBatchId, lots]);

  const isAbattu = product === 'ABATTU_PIECE' || product === 'ABATTU_KG';
  const isKg = product === 'KG' || product === 'ABATTU_KG';

  const sellable = lots.filter(
    (b) => b.quantityAlive > 0 && (b.status === 'EN_VENTE' || b.status === 'ACTIF'),
  );
  const poolList = pools.filter((p) => p.status === 'PROCESSED' && p.slaughterType === 'ABATTU' && (p.carcassesAvailable ?? 0) > 0);

  const pool = poolList.find((p) => p.id === poolId);
  const lot = sellable.find((b) => b.id === lotId);

  const productsWithoutSlaughter = (l: PosLine) => l.product !== 'ABATTU_PIECE' && l.product !== 'ABATTU_KG';
  const flockUsed = (committed ?? [])
    .filter((l) => l.uid !== initial?.uid && l.batchId === lotId && productsWithoutSlaughter(l))
    .reduce((a, l) => a + l.qty, 0);
  const poolUsed = (committed ?? [])
    .filter((l) => l.uid !== initial?.uid && l.slaughterOrderId === poolId)
    .reduce((a, l) => a + l.qty, 0);

  const maxQty =
    product === 'OEUF' ? 200 :
    product === 'AUTRE' ? 1000 :
    abattuMode === 'pool' ? Math.max((pool?.carcassesAvailable ?? 0) - poolUsed, 0) :
    Math.max((lot?.quantityAlive ?? 0) - flockUsed, 0) || (product === 'KG' || product === 'ABATTU_KG' ? 1000 : 200);

  const preview = (() => {
    const previewLine: PosLine = {
      uid: initial?.uid ?? 'preview',
      product,
      batchId: abattuMode === 'pool' ? (pool?.batchId ?? lotId) : lotId || undefined,
      slaughterOrderId: abattuMode === 'pool' ? poolId : undefined,
      qty,
      unitPriceFcfa: price,
      label: productMeta(product).label,
    };
    return lineAmount(previewLine);
  })();

  const selectProduct = (key: PosProduct) => {
    setProduct(key);
    setError(null);
    if (key === 'ABATTU_PIECE' || key === 'ABATTU_KG') {
      setAbattuMode(poolList.length > 0 ? 'pool' : 'direct');
      return;
    }
    setAbattuMode('direct');
    setPoolId('');
    if (key === 'OEUF' || key === 'AUTRE') {
      setLotId('');
    }
  };

  const save = () => {
    if (qty <= 0) {
      setError('Indiquez une quantité.');
      return;
    }
    if (price <= 0) {
      setError('Indiquez un prix unitaire.');
      return;
    }
    if (isAbattu && abattuMode === 'pool' && !pool) {
      setError('Sélectionnez un lot de carcasses (abattoir).');
      return;
    }
    if ((product === 'PIECE' || product === 'KG') && !lotId) {
      setError('Sélectionnez un lot.');
      return;
    }
    onSave({
      uid: initial?.uid ?? `new-${Date.now()}-${qty}`,
      product,
      batchId: abattuMode === 'pool' ? (pool?.batchId ?? lotId) : lotId || undefined,
      slaughterOrderId: abattuMode === 'pool' ? poolId : undefined,
      qty,
      unitPriceFcfa: price,
      label: productMeta(product).label,
    });
    onClose();
  };

  const meta = productMeta(product);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={initial ? 'Modifier l’article' : 'Ajouter un article'}
      subtitle="Produit, lot et quantité"
      icon={<CreditCard size={22} color={color.accent[600]} />}
      accentColor={color.accent[400]}>
      <View style={{ gap: spacing.lg }}>
        <View>
          <AppText size="label" color="muted">
            PRODUIT
          </AppText>
          <View style={styles.rowWrap}>
            {PRODUCTS.map((p) => (
              <Pressable key={p.key} onPress={() => selectProduct(p.key)} accessibilityRole="button">
                <Chip label={p.label} tone={isAbattu ? 'amber' : 'accent'} selected={p.key === product} style={styles.chip} />
              </Pressable>
            ))}
          </View>
        </View>

        {isAbattu && poolList.length > 0 ? (
          <View>
            <AppText size="label" color="muted">
              SOURCE
            </AppText>
            <View style={{ marginTop: 6 }}>
              <Segmented<AbattuMode>
                value={abattuMode}
                onChange={(m) => {
                  setAbattuMode(m);
                  setError(null);
                }}
                options={[
                  { key: 'direct', label: 'Abattage direct', tint: palette.accent[600] },
                  { key: 'pool', label: `Carcasses · ${fmt(poolList.reduce((a, p) => a + (p.carcassesAvailable ?? 0), 0))}`, tint: palette.brand[600] },
                ]}
              />
            </View>
          </View>
        ) : null}

        {abattuMode === 'pool' ? (
          <View>
            <AppText size="label" color="muted">
              LOT DE CARCASSES (ABATTOIR)
            </AppText>
            <View style={styles.rowWrap}>
              {poolList.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setPoolId(p.id);
                    setError(null);
                  }}
                  accessibilityRole="button">
                  <Chip
                    label={`${p.batch.batchName ?? p.batch.id} · ${fmt(p.carcassesAvailable ?? 0)} carc.`}
                    tone="brand"
                    selected={p.id === poolId}
                    style={styles.chip}
                  />
                </Pressable>
              ))}
              {poolList.length === 0 ? (
                <AppText size="caption" color="muted">
                  Aucune carcasse disponible en ce moment.
                </AppText>
              ) : null}
            </View>
            {pool ? (
              <AppText size="caption" color="faint">
                {pool.batch.batchName} · {SPECIES_ICONS[pool.batch.species] ?? ''} {speciesLabel(pool.batch.species)} · {pool.referenceNumber}
              </AppText>
            ) : null}
          </View>
        ) : (
          <View>
            <AppText size="label" color="muted">
              LOT
            </AppText>
            <View style={styles.rowWrap}>
              {sellable.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => {
                    setLotId(b.id);
                    setError(null);
                  }}
                  accessibilityRole="button">
                  <Chip
                    label={`${lotTitle(b)} · ${fmt(b.quantityAlive)}`}
                    tone={b.status === 'EN_VENTE' ? 'green' : 'brand'}
                    selected={b.id === lotId}
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
        )}

        <Card tone="default" style={{ gap: spacing.sm }}>
          <View style={styles.priceRow}>
            <AppText size="caption" color="muted">
              PRIX UNITAIRE
            </AppText>
            <View style={styles.priceInputWrap}>
              <TextInput
                value={price > 0 ? String(price) : ''}
                onChangeText={(t) => {
                  const n = parseInt(t.replace(/\D/g, ''), 10);
                  setPrice(Number.isFinite(n) ? n : 0);
                  setError(null);
                }}
                placeholder="FCFA"
                placeholderTextColor={color.ink[300]}
                keyboardType="number-pad"
                style={styles.priceInput}
              />
              <AppText size="body" weight="semibold" color="text">
                / {meta.priceUnit}
              </AppText>
            </View>
          </View>
          {isKg ? (
            <AppText size="caption" color="muted">
              {fmt(qty)} oiseaux · ≈ {fmt(Math.round(qty * DEFAULT_AVG_WEIGHT_KG * 100) / 100)} kg · décompte par oiseaux
            </AppText>
          ) : null}
          <Stepper
            value={qty}
            onChange={(n) => {
              setQty(n);
              setError(null);
            }}
            step={1}
            quickSteps={isKg ? [1, 2, 5] : product === 'OEUF' ? [1, 5, 10] : [1, 5, 10, 25]}
            min={0}
            max={Math.max(maxQty, 1)}
            suffix={meta.unit}
            big
          />
        </Card>

        {error ? (
          <AppText size="small" color="danger">
            {error}
          </AppText>
        ) : null}

        <View style={styles.totalRow}>
          <View style={{ flex: 1 }}>
            <AppText size="label" color="muted">
              SOUS-TOTAL
            </AppText>
            <AppText size="h2" weight="bold" color="accent">
              {fmt(preview)} FCFA
            </AppText>
          </View>
          <View style={{ width: 150 }}>
            <Button label={initial ? 'Mettre à jour' : 'Ajouter'} tone="accent" disabled={qty <= 0 || price <= 0} onPress={save} />
          </View>
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
  chip: {
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInput: {
    height: 44,
    minWidth: 120,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '700',
    color: color.ink[800],
    backgroundColor: color.surface,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
});