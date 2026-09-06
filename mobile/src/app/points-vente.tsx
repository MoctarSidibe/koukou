import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Star, Store, Trash2 } from 'lucide-react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/auth/AuthContext';
import { fetchPointsOfSale } from '@/api';
import { invalidateFarmQueries } from '@/api/invalidate';
import type { PointOfSaleInput } from '@/api/mutations';
import { createPointOfSaleQueued, deletePointOfSaleQueued, updatePointOfSaleQueued } from '@/offline/engine';
import { canManageFarm } from '@/api/roles';
import type { PointOfSale } from '@/api/types';
import { color, palette, radii, spacing } from '@/constants/theme';

const LIBREVILLE = { latitude: 0.4162, longitude: 9.4673 };

function PdvForm({
  initial,
  onClose,
}: {
  initial?: PointOfSale;
  onClose: () => void;
}) {
  const { farmId, mode } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<'FERME' | 'BOUTIQUE'>(initial?.kind ?? 'BOUTIQUE');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [city, setCity] = useState(initial?.city ?? 'Libreville');
  const [activity, setActivity] = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Nom du point de vente requis.');
      return;
    }
    setBusy(true);
    setError(null);
    const input: PointOfSaleInput = {
      name: name.trim(),
      kind,
      isActive: activity,
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
      ...(kind === 'BOUTIQUE' && !initial
        ? { latitude: LIBREVILLE.latitude, longitude: LIBREVILLE.longitude }
        : {}),
    };
    try {
      if (mode === 'demo') {
        invalidateFarmQueries(queryClient, { farmId });
        onClose();
        return;
      }
      const res = initial
        ? await updatePointOfSaleQueued(farmId, initial.id, input)
        : await createPointOfSaleQueued(farmId, input);
      invalidateFarmQueries(queryClient, { farmId });
      onClose();
      if (res.status === 'queued') {
        setBusy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l’enregistrement.');
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <View>
        <AppText size="label" color="muted">
          TYPE
        </AppText>
        <View style={{ marginTop: 6 }}>
          <Segmented<'FERME' | 'BOUTIQUE'>
            value={kind}
            onChange={setKind}
            options={[
              { key: 'FERME', label: '🏡 Ferme', tint: palette.brand[600] },
              { key: 'BOUTIQUE', label: '🏪 Boutique', tint: palette.accent[600] },
            ]}
          />
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText size="label" color="muted">
          NOM
        </AppText>
        <TextInput value={name} onChangeText={setName} placeholder="Ex. Boutique Occéan" placeholderTextColor={color.ink[300]} style={styles.input} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText size="label" color="muted">
          ADRESSE
        </AppText>
        <TextInput value={address} onChangeText={setAddress} placeholder="Rue, marché, repère" placeholderTextColor={color.ink[300]} style={styles.input} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText size="label" color="muted">
          VILLE
        </AppText>
        <TextInput value={city} onChangeText={setCity} placeholder="Libreville" placeholderTextColor={color.ink[300]} style={styles.input} />
      </View>

      {kind === 'BOUTIQUE' && !initial ? (
        <Card tone="brand" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MapPin size={18} color={color.brand[600]} />
          <AppText size="small" color="muted" style={{ flex: 1 }}>
            Positionnée sur Libreville ({LIBREVILLE.latitude}, {LIBREVILLE.longitude}) — coordonnées GPS de référence.
          </AppText>
        </Card>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <AppText size="label" color="muted">
          État
        </AppText>
        <View style={styles.rowWrap}>
          <Pressable onPress={() => setActivity(true)} accessibilityRole="button">
            <Chip label="Actif" tone="green" selected={activity} />
          </Pressable>
          <Pressable onPress={() => setActivity(false)} accessibilityRole="button">
            <Chip label="Inactif (masqué)" tone="neutral" selected={!activity} />
          </Pressable>
        </View>
      </View>

      {error ? (
        <AppText size="small" color="danger">
          {error}
        </AppText>
      ) : null}

      <Button
        label={initial ? 'Enregistrer' : 'Créer le point de vente'}
        tone="accent"
        loading={busy}
        disabled={!name.trim()}
        onPress={() => void submit()}
      />
    </View>
  );
}

export default function PointsVenteScreen() {
  const { farmId, user, mode } = useAuth();
  const queryClient = useQueryClient();
  const canManage = canManageFarm(user.role);
  const pdvQuery = useQuery({ queryKey: ['points-of-sale', farmId], queryFn: () => fetchPointsOfSale(farmId) });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PointOfSale | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<PointOfSale | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pdvs = useMemo(() => pdvQuery.data ?? [], [pdvQuery.data]);
  const boutiques = useMemo(() => pdvs.filter((p) => p.kind === 'BOUTIQUE'), [pdvs]);
  const farms = useMemo(() => pdvs.filter((p) => p.kind === 'FERME'), [pdvs]);

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (mode === 'demo') {
        invalidateFarmQueries(queryClient, { farmId });
        setConfirmDelete(null);
        return;
      }
      const res = await deletePointOfSaleQueued(farmId, confirmDelete.id);
      invalidateFarmQueries(queryClient, { farmId });
      setConfirmDelete(null);
      Alert.alert(
        'Point de vente supprimé',
        res.status === 'queued' ? 'Suppression mise en file, synchronisation en attente.' : 'Le point de vente a été retiré de la liste.',
      );
    } catch (e) {
      setConfirmDelete(null);
      Alert.alert('Suppression impossible', e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setDeleting(false);
    }
  };

  const openNew = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (p: PointOfSale) => {
    setEditing(p);
    setFormOpen(true);
  };

  const renderCard = (p: PointOfSale) => (
    <Card key={p.id} onPress={() => openEdit(p)} style={styles.pdvCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {p.isDefault ? <Star size={16} color={color.amber[500]} fill={color.amber[400]} /> : null}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppText size="body" weight="bold" color="text" numberOfLines={1}>
              {p.kind === 'FERME' ? '🏡' : '🏪'} {p.name}
            </AppText>
            <Chip label={p.kind === 'FERME' ? 'Ferme' : 'Boutique'} tone={p.kind === 'FERME' ? 'brand' : 'accent'} />
          </View>
          <AppText size="small" color="muted" numberOfLines={1}>
            {[p.city, p.address].filter(Boolean).join(' · ') || '—'}
          </AppText>
          {p.latitude != null ? (
            <AppText size="small" color="faint">
              {p.latitude.toFixed(4)}, {p.longitude?.toFixed(4) ?? '—'}
            </AppText>
          ) : null}
        </View>
        <View style={{ gap: 6, alignItems: 'center' }}>
          <Chip label={p.isActive ? 'Actif' : 'Inactif'} tone={p.isActive ? 'green' : 'neutral'} />
          {!p.isDefault && canManage ? (
            <Pressable
              onPress={() => setConfirmDelete(p)}
              hitSlop={8}
              style={styles.deleteBtn}
              accessibilityRole="button">
              <Trash2 size={16} color={color.red[500]} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Card>
  );

  return (
    <Screen
      header={
        <ScreenHeader
          title="Points de vente"
          subtitle="Ferme & boutiques géolocalisées"
          back
          right={
            canManage ? (
              <Pressable onPress={openNew} style={styles.addBtn} accessibilityRole="button">
                <Plus size={22} color={color.surface} />
              </Pressable>
            ) : undefined
          }
        />
      }
      bottomPad={96}>
      {pdvQuery.isLoading ? (
        <Spinner label="Chargement des points de vente…" />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <View>
            <AppText size="label" color="muted" style={{ marginBottom: spacing.sm }}>
              FERME
            </AppText>
            {farms.map(renderCard)}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <AppText size="label" color="muted">
              BOUTIQUES (LIBREVILLE)
            </AppText>
            {canManage ? (
              <Pressable onPress={openNew} accessibilityRole="button">
                <AppText size="small" weight="bold" color="accent">
                  + Nouvelle
                </AppText>
              </Pressable>
            ) : null}
          </View>
          {boutiques.length > 0 ? (
            boutiques.map(renderCard)
          ) : (
            <Card tone="default">
              <AppText size="small" color="muted">
                Aucune boutique. Ouvrez un point de vente géolocalisé à Libreville pour vendre en ville.
              </AppText>
            </Card>
          )}
        </View>
      )}

      <Sheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier le point de vente' : 'Nouveau point de vente'}
        subtitle="Ferme ou boutique en ville"
        icon={editing ? <Store size={22} color={color.brand[600]} /> : <Plus size={22} color={color.brand[600]} />}>
        <PdvForm
          key={editing?.id ?? 'new'}
          initial={editing}
          onClose={() => setFormOpen(false)}
        />
      </Sheet>

      <Sheet visible={confirmDelete != null} onClose={() => setConfirmDelete(null)} title="Supprimer ce point de vente ?" subtitle={confirmDelete?.name}>
        <View style={{ gap: spacing.lg }}>
          <AppText size="body" color="muted">
            Les ventes passées resteront liées au point de vente, mais il disparaîtra de la liste et des caisseurs. Le point « ferme » par défaut ne peut pas être supprimé.
          </AppText>
          <Button label="Supprimer définitivement" tone="danger" loading={deleting} onPress={() => void remove()} />
          <Button label="Annuler" tone="ghost" onPress={() => setConfirmDelete(null)} />
        </View>
      </Sheet>
    </Screen>
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
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pdvCard: {
    marginBottom: spacing.sm,
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: color.red[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: color.accent[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
});