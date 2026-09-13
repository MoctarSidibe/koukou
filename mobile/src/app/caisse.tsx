import React, { useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, Coins, FolderClosed, FolderOpen } from 'lucide-react-native';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/auth/AuthContext';
import { fetchCaisseCurrent, fetchCaisseSessions } from '@/api';
import { closeCaisse, openCaisse } from '@/api/mutations';
import { canManageFarm } from '@/api/roles';
import type { CashMovement, CashSession, CaisseSummary } from '@/api/types';
import { color, fmtFcfa, palette } from '@/constants/theme';

const SOURCE_LABEL: Record<string, string> = {
  SALE_PAYMENT: 'Vente',
  MANUAL: 'Manuel',
  REFUND: 'Remboursement',
  EXPENSE: 'Dépense',
};

function MovementRow({ m }: { m: CashMovement }) {
  const negative = m.type === 'OUT';
  return (
    <View style={styles.mvRow}>
      <View style={styles.mvBadge}>
        {negative ? (
          <ArrowUpFromLine size={16} color={color.red[500]} />
        ) : (
          <ArrowDownToLine size={16} color={color.green[600]} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <AppText size="body" weight="semibold" color="text">
          {SOURCE_LABEL[m.source] ?? m.source}
        </AppText>
        <AppText size="caption" color="muted">
          {m.reason ?? (m.saleId ? 'Encaissement vente' : 'Caisse')} · {m.movementDate?.slice(0, 10)}
        </AppText>
      </View>
      <AppText size="body" weight="bold" color={negative ? 'danger' : 'success'}>
        {negative ? '-' : '+'} {fmtFcfa(m.amountFcfa)}
      </AppText>
    </View>
  );
}

function SessionCard({ s }: { s: CashSession }) {
  const open = s.status === 'OPEN';
  return (
    <Card tone={open ? 'green' : 'default'} style={styles.card}>
      <View style={styles.sessionHead}>
        <View style={{ gap: 2, flex: 1 }}>
          <AppText size="body" weight="bold" color="text">
            {open ? 'Session ouverte' : 'Session clôturée'}
          </AppText>
          <AppText size="caption" color="muted">
            Ouverte le {s.openedAt?.slice(0, 10) ?? '—'}{s.closedAt ? ` · clôturée le ${s.closedAt.slice(0, 10)}` : ''}
          </AppText>
        </View>
        {open ? <Chip label="OUVERTE" tone="green" dot /> : <Chip label="CLÔTURÉE" tone="neutral" />}
      </View>
      <View style={{ gap: 2 }}>
        <RowRow label="Fonds d’ouverture" value={fmtFcfa(s.openingBalanceFcfa ?? 0)} />
        <RowRow label="Attendu à la clôture" value={fmtFcfa(s.closingExpectedFcfa ?? 0)} />
        <RowRow label="Déclaré" value={fmtFcfa(s.closingBalanceFcfa ?? 0)} />
        {!open ? <RowRow label="Écart" value={fmtFcfa(s.closingDifferenceFcfa ?? 0)} warn={(s.closingDifferenceFcfa ?? 0) !== 0} /> : null}
      </View>
    </Card>
  );
}

function RowRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.rowRow}>
      <AppText size="small" color="muted">
        {label}
      </AppText>
      <AppText size="small" weight="semibold" color={warn ? 'warn' : 'text'}>
        {value}
      </AppText>
    </View>
  );
}

export default function CaisseScreen() {
  const { farms, user, farmId } = useAuth();
  const canManage = canManageFarm(user.role);
  const queryClient = useQueryClient();

  const caisse = useQuery({ queryKey: ['caisse', farmId], queryFn: () => fetchCaisseCurrent(farmId) });
  const sessions = useQuery({ queryKey: ['caisse-sessions', farmId], queryFn: () => fetchCaisseSessions(farmId) });

  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current: CaisseSummary | null = caisse.data ?? null;
  const hasOpen = !!current?.session;
  const movements = current?.movements ?? [];
  const history = sessions.data ?? [];

  const fmtDate = (d?: string) => (d ? d.slice(0, 10) : '—');

  const act = async (kind: 'open' | 'close') => {
    const value = Math.round(Number(amount.replace(/[^\d]/g, '')) || 0);
    if (kind === 'open' && value < 0) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      if (kind === 'open') await openCaisse(farmId, value);
      else await closeCaisse(farmId, value);
      setAmount('');
      const invalidate = [
        ['caisse', farmId] as const,
        ['caisse-sessions', farmId] as const,
      ];
      void Promise.all(invalidate.map((key) => queryClient.invalidateQueries({ queryKey: key })));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur lors de l’opération de caisse.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<ScreenHeader title="Caisse du jour" subtitle={farms[0]?.name ?? 'Ferme'} back right={<Coins size={18} color={color.ink[300]} />} />}>

      {caisse.isLoading ? (
        <Spinner label="Lecture de la caisse…" />
      ) : (
        <>
          {current ? (
            <Card tone="brand" style={styles.card}>
              <View style={styles.sessionHead}>
                <View style={{ gap: 2, flex: 1 }}>
                  <AppText size="body" weight="bold" color="text">
                    Caisse {hasOpen ? 'ouverte' : 'fermée'}
                  </AppText>
                  <AppText size="caption" color="muted">
                    {current.session?.openedAt ? `Ouverte le ${fmtDate(current.session.openedAt)}` : 'Aucune session ouverte'}
                  </AppText>
                </View>
                <Chip label="ESPÈCES" tone="green" dot />
              </View>
              {hasOpen ? (
                <View style={{ gap: 2 }}>
                  <RowRow label="Solde attendu" value={fmtFcfa(current.expectedBalanceFcfa)} />
                  <RowRow label="Entrées" value={fmtFcfa(current.inFcfa)} />
                  <RowRow label="Sorties" value={fmtFcfa(current.outFcfa)} />
                </View>
              ) : null}
            </Card>
          ) : null}

          {canManage ? (
            <Card tone="default" style={styles.card}>
              <AppText size="label" color="muted" style={{ marginBottom: 6 }}>
                {hasOpen ? 'CLÔTURE DE CAISSE' : 'OUVERTURE DE CAISSE'}
              </AppText>
              <TextInput
                value={amount}
                onChangeText={(t) => {
                  setAmount(t);
                  setError(null);
                }}
                placeholder={hasOpen ? 'FCFA déclarés en caisse' : 'Fonds de caisse initial (FCFA)'}
                placeholderTextColor={color.ink[300]}
                keyboardType="number-pad"
                style={styles.input}
                editable={!busy}
              />
              {error ? (
                <AppText size="small" color="danger" style={{ marginBottom: 8 }}>
                  {error}
                </AppText>
              ) : null}
              <Button
                label={hasOpen ? 'Clôturer la caisse' : 'Ouvrir la caisse'}
                tone={hasOpen ? 'success' : 'brand'}
                icon={hasOpen ? FolderClosed : FolderOpen}
                onPress={() => act(hasOpen ? 'close' : 'open')}
                disabled={busy}
                loading={busy}
              />
            </Card>
          ) : (
            <Card tone="default" style={styles.card}>
              <AppText size="label" color="muted" style={{ marginBottom: 6 }}>
                OUVERTURE / CLÔTURE DE CAISSE
              </AppText>
              <AppText size="body" color="muted">
                Réservé au propriétaire. Vous pouvez consulter le statut de la caisse, les mouvements du jour et l’historique des sessions.
              </AppText>
            </Card>
          )}

          <SectionHeader title="Mouvements du jour" subtitle={current ? fmtDate(current.session?.openedAt) : ''} />
          <View style={{ gap: 4 }}>
            {movements.length === 0 ? (
              <AppText size="caption" color="muted">
                Aucun mouvement aujourd’hui.
              </AppText>
            ) : (
              movements.map((m) => <MovementRow key={m.id} m={m} />)
            )}
          </View>

          <SectionHeader title="Historique des sessions" />
          <View style={{ gap: 10 }}>
            {history.length === 0 ? (
              <AppText size="caption" color="muted">
                Aucune session passée.
              </AppText>
            ) : (
              history.map((s) => <SessionCard key={s.id} s={s} />)
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
  },
  mvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  mvBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: color.ink[800],
    backgroundColor: palette.surface,
    marginBottom: 10,
  },
});