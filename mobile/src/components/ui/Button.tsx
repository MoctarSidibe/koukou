import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Image, type ImageProps } from 'expo-image';

import { AppText } from './AppText';
import { color, palette, radii } from '@/constants/theme';
import type { TextSize } from '@/constants/theme';

type ButtonTone = 'primary' | 'brand' | 'accent' | 'ghost' | 'danger' | 'success';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  tone?: ButtonTone;
  icon?: LucideIcon;
  image?: ImageProps['source'];
  size?: 'md' | 'lg';
  labelSize?: TextSize;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export function Button({
  label,
  onPress,
  tone = 'accent',
  icon: Icon,
  image,
  size = 'lg',
  labelSize = 'bodyM',
  block = true,
  disabled = false,
  loading = false,
}: ButtonProps) {
  const stylesByTone: Record<ButtonTone, { bg: string; fg: string; border?: string }> = {
    accent: { bg: color.accent[500], fg: color.surface },
    brand: { bg: color.brand[600], fg: color.surface },
    primary: { bg: color.brand[600], fg: color.surface },
    success: { bg: palette.green[600], fg: palette.surface },
    danger: { bg: color.red[500], fg: color.surface },
    ghost: { bg: color.surfaceAlt, fg: color.ink[700], border: color.border },
  };

  const t = stylesByTone[tone];
  const active = !disabled && !loading;

  return (
    <Pressable
      onPress={active ? onPress : undefined}
      disabled={!active}
      style={({ pressed }) => [
        styles.button,
        block && styles.block,
        { backgroundColor: t.bg, borderColor: t.border ?? t.bg },
        size === 'lg' ? styles.lg : styles.md,
        pressed && active && styles.pressed,
        disabled && styles.disabled,
      ]}
      accessibilityRole="button">
      {loading ? (
        <ActivityIndicator color={t.fg} />
      ) : (
        <View style={styles.inner}>
          {image ? (
            <Image
              source={image}
              style={size === 'lg' ? styles.imageLg : styles.imageMd}
              contentFit="contain"
              accessibilityLabel=""
            />
          ) : null}
          {Icon ? <Icon size={size === 'lg' ? 20 : 17} color={t.fg} strokeWidth={2.4} /> : null}
          <AppText size={labelSize} weight="semibold" color={t.fg}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    alignSelf: 'stretch',
  },
  lg: {
    height: 54,
    paddingHorizontal: 20,
  },
  md: {
    height: 44,
    paddingHorizontal: 16,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageLg: {
    width: 26,
    height: 26,
  },
  imageMd: {
    width: 20,
    height: 20,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
