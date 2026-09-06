import React, { useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, KeyRound, Phone, UserPlus, Users } from 'lucide-react-native';

import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/auth/AuthContext';
import { fetchFarmMembers } from '@/api';
import { createFarmMember } from '@/api/mutations';
import { canManageFarm } from '@/api/roles';
import { initials } from '@/api/format';
import type { FarmMember } from '@/api/types';
import { color, palette } from '@/constants/theme';

function MemberRow({ member }: { member: FarmMember }) {
  return (
    <Card tone="default" style={styles.card}>
      <View style={styles.memberHead}>
        <View style={styles.avatar}>
          <AppText size="body" weight="bold" color="surface" style={{ fontSize: 15 }}>
            {initials(member.user.fullName)}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.titleRow}>
            <AppText size="body" weight="bold" color="text" numberOfLines={1} style={{ flex: 1 }}>
              {member.user.fullName}
            </AppText>
            <Chip label="ÉLEVEUR" tone="brand" />
          </View>
          <AppText size="caption" color="muted">
            {member.user.phone}
            {member.user.email ? ` · ${member.user.email}` : ''}
          </AppText>
          {member.buildingAssignment ? (
            <AppText size="caption" color="muted">
              Affecté : {member.buildingAssignment}
            </AppText>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export default function EquipeScreen() {
  const { farms, mode, user, farmId } = useAuth();
  const canManage = canManageFarm(user.role);
  const queryClient = useQueryClient();

  const members = useQuery({
    queryKey: ['farm-members', farmId],
    queryFn: () => fetchFarmMembers(farmId),
    enabled: canManage,
  });

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [building, setBuilding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setFullName('');
    setPhone('');
    setCode('');
    setBuilding('');
    setSuccess(false);
  };

  const submit = async () => {
    if (!fullName.trim() || !phone.trim()) {
      setError('Nom et téléphone sont obligatoires.');
      return;
    }
    if (code.trim().length < 6) {
      setError('Le code doit contenir au moins 6 caractères.');
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'live') {
        await createFarmMember(farmId, {
          fullName: fullName.trim(),
          phone: phone.trim(),
          code: code.trim(),
          buildingAssignment: building.trim() ? building.trim() : undefined,
        });
      } else {
        await new Promise<void>((r) => setTimeout(r, 400));
      }
      reset();
      setSuccess(true);
      void queryClient.invalidateQueries({ queryKey: ['farm-members', farmId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création du compte.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Équipe" subtitle={farms[0]?.name ?? 'Ferme'} back right={<Users size={18} color={color.ink[300]} />} />

      {canManage ? (
        <>
          <Card tone="default" style={styles.card}>
            <AppText size="label" color="muted" style={{ marginBottom: 6 }}>
              AJOUTER UN ÉLEVEUR
            </AppText>
            <AppText size="caption" color="muted" style={{ marginBottom: 12 }}>
              Le compte terrain saisit les saisies du jour, vend et encaisse. Création réservée au propriétaire.
            </AppText>
            <Field icon={<UserPlus size={16} color={color.ink[400]} />} label="Nom complet">
              <FieldInput value={fullName} onChangeText={setFullName} placeholder="Ex : Jean-Marc Ondo" editable={!busy} />
            </Field>
            <Field icon={<Phone size={16} color={color.ink[400]} />} label="Téléphone">
              <FieldInput value={phone} onChangeText={setPhone} placeholder="+241 77 XX XX XX" keyboardType="phone-pad" editable={!busy} />
            </Field>
            <Field icon={<KeyRound size={16} color={color.ink[400]} />} label="Code secret (≥ 6 caractères)">
              <FieldInput value={code} onChangeText={setCode} placeholder="••••••" secureTextEntry editable={!busy} />
            </Field>
            <Field icon={<Building2 size={16} color={color.ink[400]} />} label="Bâtiment assigné (optionnel)">
              <FieldInput value={building} onChangeText={setBuilding} placeholder="Ex : Bâtiment A" editable={!busy} />
            </Field>
            {error ? (
              <AppText size="small" color="danger" style={{ marginBottom: 8 }}>
                {error}
              </AppText>
            ) : null}
            {success ? (
              <AppText size="small" color="success" style={{ marginBottom: 8 }}>
                Compte éleveur créé et rattaché à la ferme.
              </AppText>
            ) : null}
            <Button label="Créer le compte éleveur" tone="brand" icon={UserPlus} onPress={() => void submit()} disabled={busy} loading={busy} />
            {mode !== 'live' ? (
              <AppText size="caption" color="faint" style={{ textAlign: 'center', marginTop: 4 }}>
                Démo · opération simulée
              </AppText>
            ) : null}
          </Card>

          <SectionHeader
            title={`Membres (${(members.data?.length ?? 0) + 1})`}
            subtitle={`${user.fullName} (propriétaire) + éleveurs`}
          />
          {members.isLoading ? (
            <Spinner label="Chargement de l'équipe…" />
          ) : (
            <View style={{ gap: 8 }}>
              <Card tone="green" style={styles.card}>
                <View style={styles.memberHead}>
                  <View style={[styles.avatar, { backgroundColor: color.green[600] }]}>
                    <AppText size="body" weight="bold" color="surface" style={{ fontSize: 15 }}>
                      {initials(user.fullName)}
                    </AppText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.titleRow}>
                      <AppText size="body" weight="bold" color="text" numberOfLines={1} style={{ flex: 1 }}>
                        {user.fullName}
                      </AppText>
                      <Chip label="PROPRIÉTAIRE" tone="green" />
                    </View>
                    <AppText size="caption" color="muted">
                      {user.phone}
                    </AppText>
                  </View>
                </View>
              </Card>
              {(members.data ?? []).map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </View>
          )}
        </>
      ) : (
        <Card tone="default" style={styles.card}>
          <AppText size="label" color="muted" style={{ marginBottom: 6 }}>
            ÉQUIPE DE LA FERME
          </AppText>
          <AppText size="body" color="muted">
            La gestion de l’équipe (création de comptes, liste des éleveurs) est réservée au propriétaire. Le compte éleveur est utilisé pour les saisies terrain, les ventes et l’encaissement.
          </AppText>
        </Card>
      )}
    </Screen>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        {icon}
        <AppText size="small" weight="semibold" color="muted">
          {label}
        </AppText>
      </View>
      {children}
    </View>
  );
}

function FieldInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={color.ink[300]} style={styles.input} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
  },
  memberHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
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
  },
});