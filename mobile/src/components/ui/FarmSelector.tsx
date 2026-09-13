import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { CheckCircle } from 'lucide-react-native';

import { AppText } from '@/components/ui/AppText';
import { palette, color } from '@/constants/theme';
import { Sheet } from '@/components/ui/Sheet';

interface FarmSelectorProps {
  visible: boolean;
  onClose: () => void;
  farms: any[];
  onSelect: (farmId: string) => void;
}

export function FarmSelector({ visible, onClose, farms, onSelect }: FarmSelectorProps) {
  const [activeFarmId, setActiveFarmId] = useState(farms[0]?.id ?? '');

  const handleSelect = (farmId: string) => {
    setActiveFarmId(farmId);
    onSelect(farmId);
    onClose();
  };

  return (
    <Pressable
      onPress={visible ? () => {} : undefined}
      accessible={visible}
    >
      {visible && (
        <Sheet
          visible={visible}
          title="Sélection de la ferme"
          subtitle="Choisissez votre ferme"
          onClose={onClose}
        >
          {farms.length === 0 ? (
            <AppText size="body" color="muted">
              Aucune ferme associée
            </AppText>
          ) : farms.map((farm) => (
            <Pressable
              key={farm.id}
              style={styles.farmItem}
              onPress={() => handleSelect(farm.id)}
            >
              <View style={styles.farmRow}>
                <CheckCircle
                  size={14}
                  color={palette.green[600]}
                  style={farm.id === activeFarmId ? { marginRight: 6 } : null}
                />
                <AppText size="body" weight="semibold" color="text" numberOfLines={1}>
                  {farm.name}
                </AppText>
                <AppText size="caption" color="muted" numberOfLines={1}>
                  {farm.administrativeCity}
                </AppText>
              </View>
            </Pressable>
          ))}
        </Sheet>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  farmItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
    alignItems: 'center',
  },
  farmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});