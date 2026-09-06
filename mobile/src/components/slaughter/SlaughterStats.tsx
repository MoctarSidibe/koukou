import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Building, Check, Package, Scale, Send, Truck } from 'lucide-react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { MetricTile } from '@/components/ui/MetricTile';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { speciesLabel } from '@/api/format';
import type { ProductionBatch, SlaughterOrder } from '@/api/types';
import { color, palette, spacing } from '@/constants/theme';

interface SlaughterStatsProps {
  orders: SlaughterOrder[];
  lot?: ProductionBatch;
}

interface SlaughterStatsData {
  openCount: number;
  openBirds: number;
  processedCount: number;
  processedBirds: number;
  carcassKg: number;
  rendement: number | null;
  rendementCount: number;
  reserveCarcasses: number;
  interneOrders: number;
  interneCodes: number;
  externeOrders: number;
  externeCodes: number;
  lotName: string | null;
  lotSpecies: string | null;
  lotReady: number;
  lotOrdered: number;
  lotProcessed: number;
}

function computeStats(orders: SlaughterOrder[], lot?: ProductionBatch): SlaughterStatsData {
  const active = orders.filter((o) => o.status !== 'CANCELLED');
  const open = active.filter((o) => o.status === 'DRAFT' || o.status === 'SENT');
  const processed = active.filter((o) => o.status === 'PROCESSED');
  const withRendement = processed.filter((o) => o.rendementPercent != null);
  const interne = active.filter((o) => o.destination === 'INTERNE');
  const externe = active.filter((o) => o.destination === 'EXTERNE' && o.status !== 'DRAFT');
  const lotOrders = lot ? active.filter((o) => o.batchId === lot.id) : [];

  return {
    openCount: open.length,
    openBirds: open.reduce((s, o) => s + o.birdCount, 0),
    processedCount: processed.length,
    processedBirds: processed.reduce((s, o) => s + o.birdCount, 0),
    carcassKg: processed.reduce((s, o) => s + (o.carcassWeightKg ?? 0), 0),
    rendement: withRendement.length
      ? withRendement.reduce((s, o) => s + (o.rendementPercent ?? 0), 0) / withRendement.length
      : null,
    rendementCount: withRendement.length,
    reserveCarcasses: active.reduce((s, o) => s + (o.carcassesAvailable ?? 0), 0),
    interneOrders: interne.length,
    interneCodes: interne.filter((o) => o.internalBatchCode).length,
    externeOrders: externe.length,
    externeCodes: externe.filter((o) => o.abattoirLotCode).length,
    lotName: lot?.batchName ?? null,
    lotSpecies: lot ? (lot.customSpecies ?? speciesLabel(lot.species)) : null,
    lotReady: lot?.quantityAlive ?? 0,
    lotOrdered: lotOrders.reduce((s, o) => s + o.birdCount, 0),
    lotProcessed: lotOrders.filter((o) => o.status === 'PROCESSED').reduce((s, o) => s + o.birdCount, 0),
  };
}

function Row({ icon, iconTone, label, value }: { icon: React.ReactNode; iconTone: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: `${iconTone}18` }]}>{icon}</View>
      <View style={styles.rowBody}>
        <AppText size="small" weight="semibold" color="muted">
          {label}
        </AppText>
        <AppText size="body" weight="bold" color="text">
          {value}
        </AppText>
      </View>
    </View>
  );
}

export function SlaughterStats({ orders, lot }: SlaughterStatsProps) {
  const stats = computeStats(orders, lot);
  const warned = lot ? stats.lotOrdered >= stats.lotReady && stats.lotOrdered > 0 : false;

  return (
    <View style={{ gap: spacing.lg }}>
      <SectionHeader title="Suivi & statistiques" subtitle={lot ? `${stats.lotName ?? '—'} · ${stats.lotSpecies ?? ''}` : undefined} />

      <View style={styles.tiles}>
        <MetricTile label="En cours" icon={Send} value={String(stats.openCount)} sub={stats.openBirds > 0 ? `${stats.openBirds} oiseaux réservés` : 'aucun ordre ouvert'} tone="brand" compact />
        <MetricTile label="Traités" icon={Check} value={String(stats.processedCount)} sub={stats.carcassKg > 0 ? `${stats.processedBirds} oiseaux · ${Math.round(stats.carcassKg)} kg carcasse` : `${stats.processedBirds} oiseaux abattus`} tone="green" compact />
        <MetricTile label="Rendement moyen" icon={Scale} value={stats.rendement != null ? `${stats.rendement.toFixed(1)} %` : '—'} sub={stats.rendementCount > 0 ? `sur ${stats.rendementCount} ordre(s)` : 'pas encore de données'} tone="default" compact />
        <MetricTile label="Réserve carcasses" icon={Package} value={String(stats.reserveCarcasses)} sub="vendables au POS abattu" tone="accent" compact />
      </View>

      <Card style={styles.traceCard}>
        <AppText size="label" color="muted">
          TRAÇABILITÉ DE L’ORDRE
        </AppText>

        {lot ? (
          <>
            <Row icon={<Scale size={16} color={warned ? color.amber[600] : color.brand[600]} />} iconTone={warned ? palette.amber[500] : palette.brand[600]} label="Prêt à abattre" value={`${stats.lotReady} oiseaux`} />
            <Row icon={<Send size={16} color={color.ink[400]} />} iconTone={palette.ink[400]} label="Planifiés (ordres en cours)" value={`${stats.lotOrdered} oiseaux`} />
            <Row icon={<Check size={16} color={color.green[600]} />} iconTone={palette.green[600]} label="Déjà traités" value={`${stats.lotProcessed} oiseaux`} />
          </>
        ) : null}

        <View style={styles.divider} />

        <Row icon={<Building size={16} color={color.brand[600]} />} iconTone={palette.brand[600]} label="Interne · abattoir ferme" value={`${stats.interneOrders} ordre(s) · ${stats.interneCodes} code(s) suivi généré(s)`} />
        <Row icon={<Truck size={16} color={color.accent[500]} />} iconTone={palette.accent[500]} label="Externe · sous-traitant" value={`${stats.externeOrders} bordereau(x) envoyé(s) · ${stats.externeCodes} code(s) abattoir saisi(s)`} />

        {warned ? (
          <AppText size="small" color="warn">
            Attention : les ordres en cours du lot couvrent déjà le cheptel vivant.
          </AppText>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  traceCard: {
    gap: 10,
    padding: 14,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
});