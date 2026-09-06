import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Crosshair, Lock, Scale, Settings, SlidersHorizontal } from 'lucide-react-native';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/auth/AuthContext';
import { fetchReferenceConstants } from '@/api';
import type { ReferenceConstant } from '@/api/types';
import { color } from '@/constants/theme';

function fmtValue(v: number): string {
  return Number.isInteger(v) ? String(v) : String(v).replace(/\.?0+$/, '');
}

function ConstantRow({ c }: { c: ReferenceConstant }) {
  return (
    <Card tone="default" style={styles.card}>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <AppText size="small" weight="bold" color="text" numberOfLines={1}>
          {c.key}
        </AppText>
        <AppText size="caption" color="muted">
          {c.description}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {c.isEditable ? <Chip label="éditable" tone="outline" /> : <Chip label="fixe" tone="neutral" />}
        </View>
      </View>
      <AppText size="body" weight="bold" color="text">
        {fmtValue(c.value)}
      </AppText>
    </Card>
  );
}

export default function ReglagesScreen() {
  const { farms } = useAuth();
  const farm = farms[0];

  const constants = useQuery({ queryKey: ['reference-constants'], queryFn: () => fetchReferenceConstants() });

  return (
    <Screen>
      <ScreenHeader title="Réglages de ferme" subtitle={farm?.name ?? 'Ferme'} back right={<Settings size={18} color={color.ink[300]} />} />

      {farm ? (
        <Card tone="brand" style={styles.card}>
          <View style={styles.farmHead}>
            <View style={styles.farmIcon}>
              <Crosshair size={20} color={color.surface} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText size="body" weight="bold" color="text">
                {farm.name}
              </AppText>
              <AppText size="caption" color="muted">
                {farm.administrativeCity ?? 'Commune non renseignée'} · Sac de provende : {fmtValue(farm.defaultSacKg)} kg
              </AppText>
              <View style={styles.chipsRow}>
                {farm.isVerified ? <Chip label="Vérifiée" tone="green" dot /> : <Chip label="Non vérifiée" tone="amber" dot />}
                {farm.active ? <Chip label="Active" tone="green" /> : <Chip label="Suspendue" tone="red" />}
              </View>
            </View>
          </View>
        </Card>
      ) : null}

      <Card tone="default" style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SlidersHorizontal size={18} color={color.ink[400]} />
          <AppText size="body" weight="semibold" color="text">
            Constantes de référence
          </AppText>
        </View>
        <AppText size="caption" color="muted">
          Seuils d’alertes, vide sanitaire et autonomie provende. Constantes globales, modifiables uniquement par la
          plateforme (couche administrateur).
        </AppText>
        <View style={styles.noteRow}>
          <Lock size={13} color={color.ink[300]} />
          <AppText size="caption" color="faint">
            Lecture seule côté ferme
          </AppText>
        </View>
      </Card>

      <SectionHeader title="Seuils & repères" subtitle="Valeurs actuellement en vigueur" right={<Scale size={16} color={color.ink[300]} />} />
      {constants.isLoading ? (
        <Spinner label="Lecture des constantes…" />
      ) : (
        <View style={{ gap: 8 }}>
          {(constants.data ?? []).map((c) => (
            <ConstantRow key={c.key} c={c} />
          ))}
          {!constants.data?.length ? (
            <AppText size="caption" color="muted">
              Aucune constante disponible.
            </AppText>
          ) : null}
        </View>
      )}

      <Card tone="default" style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={18} color={color.green[600]} />
          <AppText size="body" weight="semibold" color="text">
            Ce que pilote l’application
          </AppText>
        </View>
        <AppText size="caption" color="muted">
          Saisie journalière, ventes (POS espèces), soins prophylactiques, stock de provende, abattage et caisse —
          l’advisory s’appuie sur ces seuils pour prioriser vos prochaines actions.
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
  },
  farmHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  farmIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: color.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});