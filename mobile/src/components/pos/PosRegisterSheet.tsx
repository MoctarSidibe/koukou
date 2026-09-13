import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Banknote, Check, ReceiptText } from 'lucide-react-native';

import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Sheet } from '../ui/Sheet';
import type { InvoiceFields } from '@/api/mutations';
import type { Promotion } from '@/api/types';
import type { SendResult } from '@/offline';
import { color, palette, radii, spacing, fmt } from '@/constants/theme';

import { findPromotion, totalsFor } from './helpers';
import type { PosLine } from './types';

interface PosRegisterSheetProps {
  visible: boolean;
  lines: PosLine[];
  promotions: Promotion[];
  pdvName: string;
  pointOfSaleId?: string;
  onSell: (input: { invoice?: InvoiceFields; promoCode?: string; pointOfSaleId?: string }) => Promise<SendResult>;
  onSettled?: () => void;
  onClose: () => void;
}

const QUICK_CASH = [5000, 10000, 20000, 50000];

export function PosRegisterSheet({
  visible,
  lines,
  promotions,
  pdvName,
  pointOfSaleId,
  onSell,
  onSettled,
  onClose,
}: PosRegisterSheetProps) {
  const [promoCode, setPromoCode] = useState('');
  const [tendered, setTendered] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sold, setSold] = useState<{ ref: string; queued: boolean } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPromoCode('');
    setTendered(0);
    setCustomerName('');
    setCustomerPhone('');
    setSelling(false);
    setError(null);
    setSold(null);
  }, [visible]);

  const sub = totalsFor(lines, null).subtotalFcfa;
  const promo = findPromotion(promotions, promoCode, sub);
  const totals = totalsFor(lines, promo);
  const change = tendered - totals.totalFcfa;
  const canSell = totals.totalFcfa > 0 && tendered >= totals.totalFcfa;

  const security = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const invoice = (): InvoiceFields | undefined => {
    const fields: InvoiceFields = {};
    if (customerName.trim()) fields.customerName = customerName.trim();
    if (customerPhone.trim()) fields.customerPhone = customerPhone.trim();
    return Object.keys(fields).length > 0 ? fields : undefined;
  };

  const sell = async () => {
    if (!canSell) {
      if (totals.totalFcfa > 0 && tendered > 0 && tendered < totals.totalFcfa) {
        setError('La somme versée est inférieure au total.');
      }
      return;
    }
    setSelling(true);
    setError(null);
    try {
      const result = await onSell({
        invoice: invoice(),
        promoCode: promoCode.trim(),
        pointOfSaleId,
      });
      security();
      onSettled?.();
      setSold({ ref: result.status === 'sent' ? (result.reference ?? 'VTE') : 'PEND', queued: result.status !== 'sent' });
      setTimeout(onClose, 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l’encaissement.');
      setSelling(false);
    }
  };

  if (sold) {
    return (
      <Sheet visible={visible} onClose={onClose}>
        <View style={styles.savedWrap}>
          <View style={styles.checkCircle}>
            <Check size={54} color={palette.green[600]} strokeWidth={3} />
          </View>
          <AppText size="h3" weight="bold" color="text">
            Vente encaissée
          </AppText>
          <AppText size="caption" color="muted">
            {sold.ref} · {pdvName}
          </AppText>
          <AppText size="caption" color="faint">
            {sold.queued ? 'En attente de synchronisation' : 'Encaissée espèces · caisse journalière'}
          </AppText>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Encaissement"
      subtitle="Espèces · caisse journalière"
      icon={<Banknote size={22} color={color.green[600]} />}
      accentColor={color.green[500]}>
      <View style={{ gap: spacing.lg }}>
        <Card tone={totals.discountFcfa > 0 ? 'green' : 'default'} style={{ gap: spacing.sm }}>
          <View style={styles.totalHead}>
            <View style={{ flex: 1 }}>
              <AppText size="label" color="muted">
                TOTAL À ENCAISSER
              </AppText>
              <AppText size="h1" weight="bold" color="accent">
                {fmt(totals.totalFcfa)} FCFA
              </AppText>
            </View>
            <ReceiptText size={26} color={color.green[600]} />
          </View>
          <View style={styles.detailRow}>
            <AppText size="small" color="muted">
              Sous-total
            </AppText>
            <AppText size="small" weight="semibold" color="text">
              {fmt(totals.subtotalFcfa)} FCFA
            </AppText>
          </View>
          {totals.discountFcfa > 0 ? (
            <View style={styles.detailRow}>
              <AppText size="small" color="success">
                Remise ({promo?.label ?? promoCode})
              </AppText>
              <AppText size="small" weight="semibold" color="success">
                − {fmt(totals.discountFcfa)} FCFA
              </AppText>
            </View>
          ) : null}
        </Card>

        <View>
          <AppText size="label" color="muted">
            CODE PROMO — OPTIONNEL
          </AppText>
          <TextInput
            value={promoCode}
            onChangeText={(t) => {
              setPromoCode(t.toUpperCase());
              setError(null);
            }}
            placeholder="Ex. BIENVENUE10"
            placeholderTextColor={color.ink[300]}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, { marginTop: 6 }]}
          />
          {promo ? (
            <AppText size="small" color="success" style={{ marginTop: 4 }}>
              {promo.label} appliquée · remise {promo.type === 'PCT' ? `${promo.value} %` : `${fmt(promo.value)} FCFA`}
            </AppText>
          ) : promoCode.trim() ? (
            <AppText size="small" color="danger" style={{ marginTop: 4 }}>
              Code invalide ou minimum non atteint.
            </AppText>
          ) : null}
        </View>

        <Card tone="default" style={{ gap: spacing.sm }}>
          <AppText size="label" color="muted">
            ESPÈCES REÇUES
          </AppText>
          <View style={styles.cashRow}>
            <TextInput
              value={tendered > 0 ? String(tendered) : ''}
              onChangeText={(t) => {
                const n = parseInt(t.replace(/\D/g, ''), 10);
                setTendered(Number.isFinite(n) ? n : 0);
                setError(null);
              }}
              placeholder="Montant reçu"
              placeholderTextColor={color.ink[300]}
              keyboardType="number-pad"
              style={[styles.input, { flex: 1 }]}
            />
            {totals.totalFcfa > 0 ? (
              <Pressable onPress={() => setTendered(totals.totalFcfa)} accessibilityRole="button">
                <AppText size="small" weight="bold" color="brand" style={{ paddingHorizontal: 8 }}>
                  Exact
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.quickWrap}>
            {QUICK_CASH.map((n) => (
              <Pressable
                key={n}
                onPress={() => {
                  setTendered(n);
                  setError(null);
                }}
                style={({ pressed }) => [styles.quick, pressed && { opacity: 0.7 }]}
                accessibilityRole="button">
                <AppText size="small" weight="bold" color={tendered === n ? 'surface' : 'ink'}>
                  {fmt(n)}
                </AppText>
              </Pressable>
            ))}
          </View>
          {tendered > 0 ? (
            <View style={styles.changeRow}>
              <AppText size="caption" color="muted">
                MONNAIE À RENDRE
              </AppText>
              <AppText size="h3" weight="bold" color={change >= 0 ? 'success' : 'danger'}>
                {fmt(Math.max(change, 0))} FCFA
              </AppText>
            </View>
          ) : null}
        </Card>

        <Card tone="default" style={{ gap: spacing.sm }}>
          <AppText size="label" color="muted">
            CLIENT — OPTIONNEL (TROUVÉ OU CRÉÉ PAR TÉLÉPHONE)
          </AppText>
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Nom du client (restaurant, revendeur…)"
            placeholderTextColor={color.ink[300]}
            style={styles.input}
          />
          <TextInput
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder="Téléphone"
            placeholderTextColor={color.ink[300]}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </Card>

        {error ? (
          <AppText size="small" color="danger">
            {error}
          </AppText>
        ) : null}

        <Button
          label={`Encaisser ${fmt(totals.totalFcfa)} FCFA`}
          tone="success"
          icon={Check}
          loading={selling}
          disabled={!canSell}
          onPress={() => void sell()}
        />
        <AppText size="caption" color="faint" style={{ textAlign: 'center' }}>
          {pdvName} · Espèces uniquement · Mobile Money bientôt disponible
        </AppText>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  savedWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.huge,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: palette.green[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 15,
    color: color.ink[800],
    backgroundColor: color.surface,
  },
  cashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  quickWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  quick: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: color.brand[50],
    borderWidth: 1,
    borderColor: color.brand[100],
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    paddingTop: 10,
    marginTop: 4,
  },
});