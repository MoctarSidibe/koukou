import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { palette, radii } from '@/constants/theme';

type Tone = 'default' | 'brand' | 'accent' | 'alert' | 'warn' | 'green' | 'plain';

const TONES: Record<Tone, { bg: string; bd: string }> = {
  default: { bg: palette.surface, bd: palette.border },
  brand: { bg: palette.brand[50], bd: palette.brand[100] },
  accent: { bg: palette.accent[50], bd: palette.accent[200] },
  alert: { bg: palette.red[50], bd: palette.red[100] },
  warn: { bg: palette.amber[50], bd: palette.amber[200] },
  green: { bg: palette.green[50], bd: palette.green[100] },
  plain: { bg: 'transparent', bd: 'transparent' },
};

interface CardProps {
  children: React.ReactNode;
  tone?: Tone;
  onPress?: () => void;
  padding?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, tone = 'default', onPress, padding = true, style }: CardProps) {
  const baseStyle = [styles.card, padding && styles.padded, { backgroundColor: TONES[tone].bg, borderColor: TONES[tone].bd }, style];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [baseStyle, pressed && styles.pressed]}
        accessibilityRole="button">
        {children}
      </Pressable>
    );
  }
  return <View style={baseStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.xl,
    shadowColor: palette.brand[950],
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  padded: {
    padding: 16,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.998 }],
  },
});