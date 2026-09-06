import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

import { AppText } from './AppText';
import { color, palette, radii } from '@/constants/theme';

interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  quickSteps?: number[];
  min?: number;
  max?: number;
  suffix?: string;
  big?: boolean;
}

export function Stepper({
  value,
  onChange,
  step = 1,
  quickSteps,
  min = 0,
  max = 1_000_000,
  suffix = '',
  big = false,
}: StepperProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  const press = (delta: number) => {
    onChange(clamp(value + delta));
  };

  return (
    <View style={[styles.row, big && styles.rowBig]}>
      <View style={styles.valueWrap}>
        <AppText size={big ? 'h1' : 'h3'} weight="bold" color="text">
          {value.toLocaleString('fr-FR')}
          <AppText size={big ? 'h2' : 'body'} weight="medium" color="muted">
            {suffix ? ` ${suffix}` : ''}
          </AppText>
        </AppText>
      </View>
      <View style={styles.controls}>
        <Pressable
          onPress={() => press(-step)}
          hitSlop={8}
          style={({ pressed }) => [styles.btn, pressed && styles.btnActive]}
          accessibilityRole="button">
          <Minus size={big ? 24 : 20} color={color.ink[700]} />
        </Pressable>
        <Pressable
          onPress={() => press(step)}
          hitSlop={8}
          style={({ pressed }) => [styles.btn, styles.btnPlus, pressed && styles.btnActive]}
          accessibilityRole="button">
          <Plus size={big ? 24 : 20} color={color.surface} />
        </Pressable>
      </View>
      {quickSteps ? (
        <View style={styles.quickRow}>
          {quickSteps.map((q) => (
            <Pressable
              key={q}
              onPress={() => press(q)}
              style={({ pressed }) => [styles.quick, pressed && styles.quickActive]}>
              <AppText size="bodyM" weight="semibold" color="brand">
                +{q}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowBig: {
    justifyContent: 'space-between',
  },
  valueWrap: {
    flex: 1,
    minWidth: 0,
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPlus: {
    backgroundColor: color.brand[600],
    borderColor: color.brand[600],
  },
  btnActive: {
    opacity: 0.85,
  },
  quickRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  quick: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.sm,
    backgroundColor: color.brand[50],
    marginRight: 8,
  },
  quickActive: {
    backgroundColor: color.brand[100],
  },
});
