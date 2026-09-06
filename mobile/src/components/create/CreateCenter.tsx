import React, { createContext, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bird, BookOpen, Building2, CreditCard, PackageOpen, Plus, Syringe } from 'lucide-react-native';

import { Sheet } from '../ui/Sheet';
import { AppText } from '../ui/AppText';
import { CreateLotSheet } from '../CreateLotSheet';
import { CreateBuildingSheet } from '../CreateBuildingSheet';
import { color, palette, radii } from '@/constants/theme';
import { useQuickCapture } from '../capture/QuickCaptureProvider';

type CreateMode = 'none' | 'menu' | 'lot' | 'building';

interface CreateCenterApi {
  openCreateMenu: () => void;
  openCreateLot: () => void;
  openCreateBuilding: () => void;
}

const CreateCenterContext = createContext<CreateCenterApi | null>(null);

export function useCreateCenter(): CreateCenterApi {
  const ctx = useContext(CreateCenterContext);
  if (!ctx) throw new Error('useCreateCenter doit être utilisé dans CreateCenterProvider');
  return ctx;
}

const CREATE_ACTIONS = [
  { key: 'daily' as const, label: 'Saisie du jour', sub: 'Morts, aliments, eau', icon: BookOpen, bg: color.green[50], fg: color.green[600] },
  { key: 'lot' as const, label: 'Nouveau lot', sub: 'Bande de poulets', icon: Bird, bg: color.brand[50], fg: color.brand[600] },
  { key: 'feed' as const, label: 'Entrée provende', sub: 'Nouveau lot HACCP', icon: PackageOpen, bg: color.surfaceAlt, fg: color.ink[600] },
  { key: 'care' as const, label: 'Soin', sub: 'Prophylaxie', icon: Syringe, bg: color.brand[50], fg: color.brand[700] },
  { key: 'building' as const, label: 'Bâtiment', sub: 'Infrastructure', icon: Building2, bg: color.brand[50], fg: color.brand[700] },
  { key: 'sale' as const, label: 'Encaisser', sub: 'POS espèces', icon: CreditCard, bg: color.accent[50], fg: color.accent[600] },
];

export function CreateCenterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { openDaily, openSale, openFeed } = useQuickCapture();
  const [mode, setMode] = useState<CreateMode>('none');

  const close = () => setMode('none');

  const api = useMemo<CreateCenterApi>(
    () => ({
      openCreateMenu: () => setMode('menu'),
      openCreateLot: () => setMode('lot'),
      openCreateBuilding: () => setMode('building'),
    }),
    [],
  );

  const handlePick = (key: 'lot' | 'building' | 'daily' | 'sale' | 'feed' | 'care') => {
    switch (key) {
      case 'lot':
        setMode('lot');
        return;
      case 'building':
        setMode('building');
        return;
      case 'daily':
        close();
        openDaily();
        return;
      case 'sale':
        close();
        openSale();
        return;
      case 'feed':
        close();
        openFeed();
        return;
      case 'care':
        close();
        router.push('/sanitary');
        return;
    }
  };

  return (
    <CreateCenterContext.Provider value={api}>
      {children}

      <CreateLotSheet visible={mode === 'lot'} onClose={close} />
      <CreateBuildingSheet visible={mode === 'building'} onClose={close} />

      <Sheet
        visible={mode === 'menu'}
        onClose={close}
        title="Nouvelle entrée"
        subtitle="Choisissez une action"
        icon={<Plus size={22} color={color.brand[600]} />}>
        <View style={styles.grid}>
          {CREATE_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Pressable
                key={a.key}
                onPress={() => handlePick(a.key)}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                accessibilityRole="button">
                <View style={[styles.iconWrap, { backgroundColor: a.bg }]}>
                  <Icon size={20} color={a.fg} />
                </View>
                <AppText size="body" weight="semibold" color="text" numberOfLines={1}>
                  {a.label}
                </AppText>
                <AppText size="small" color="muted" numberOfLines={1}>
                  {a.sub}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </CreateCenterContext.Provider>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '47%',
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    gap: 4,
  },
  pressed: {
    backgroundColor: palette.surfaceAlt,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
