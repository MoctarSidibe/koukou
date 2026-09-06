import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { AlertCard } from '@/components/AlertCard';
import { useAuth } from '@/auth/AuthContext';
import { fetchAdvisory } from '@/api';
import { acknowledgeAlert } from '@/api/mutations';
import type { Alert } from '@/api/types';

export default function AlertsScreen() {
  const router = useRouter();
  const { mode, farmId } = useAuth();
  const advisory = useQuery({ queryKey: ['advisory', farmId], queryFn: () => fetchAdvisory(farmId) });
  const [filter, setFilter] = useState<'TOUTES' | 'ROUGE' | 'JAUNE'>('TOUTES');

  const alerts = useMemo(() => {
    const list = advisory.data?.alerts ?? [];
    if (filter === 'TOUTES') return list;
    return list.filter((a) => a.level === filter);
  }, [advisory.data, filter]);

  const deservesAttention = (a: Alert) => a.level === 'ROUGE' || a.level === 'JAUNE';
  const priority = useMemo(() => alerts.filter(deservesAttention), [alerts]);
  const rest = useMemo(() => alerts.filter((a) => !deservesAttention(a)), [alerts]);

  const acknowledge = (id: string) => {
    const alert = alerts.find((a) => a.id === id);
    if (mode !== 'live' || !alert?.alertId) return;
    acknowledgeAlert(farmId, alert.alertId)
      .catch(() => {})
      .finally(() => void advisory.refetch());
  };

  return (
    <Screen bottomPad={120} refreshing={advisory.isFetching} onRefresh={() => void advisory.refetch()}>
      <ScreenHeader title="Alertes" subtitle="Vigilance immédiate, triée par impact" />

      <Card tone="brand" style={{ gap: 4, marginBottom: 12 }}>
        <AppText size="bodyM" weight="medium" color="ink">
          KouKou classe les alertes par sévérité et urgence. La première de la liste mérite votre regard.
        </AppText>
      </Card>

      <View style={styles.filters}>
        {(['TOUTES', 'ROUGE', 'JAUNE'] as const).map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} accessibilityRole="button">
            <Chip label={f === 'TOUTES' ? 'Toutes' : f === 'ROUGE' ? 'Rouges' : 'Jaunes'} tone={f === 'ROUGE' ? 'red' : f === 'JAUNE' ? 'amber' : 'brand'} selected={filter === f} />
          </Pressable>
        ))}
      </View>

      {advisory.isLoading ? (
        <Spinner label="Analyse en cours…" />
      ) : advisory.isError ? (
        <AppText size="small" color="danger">
          Analyse indisponible pour le moment. Vérifiez la connexion au serveur.
        </AppText>
      ) : (
        <View style={{ gap: 12 }}>
          {priority.length > 0 &&
            priority.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                onAcknowledge={acknowledge}
                onOpenLot={(batchId) => router.push(`/lot/${batchId}`)}
              />
            ))}

          {rest.length > 0 && (
            <>
              <AppText size="label" color="muted" style={{ marginTop: 6 }}>
                INFORMATIONS
              </AppText>
              {rest.map((a) => (
                <AlertCard key={a.id} alert={a} onAcknowledge={acknowledge} onOpenLot={(batchId) => router.push(`/lot/${batchId}`)} showWhy={false} />
              ))}
            </>
          )}

          {priority.length === 0 && rest.length === 0 ? (
            <EmptyState
              emoji="✅"
              title="Tout est vert !"
              description="Aucune alerte active. Votre ferme fonctionne bien."
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
});