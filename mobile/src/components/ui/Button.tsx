import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
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
  size?: 'xs' | 'sm' | 'md' | 'lg';
  labelSize?: TextSize;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
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
  style,
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
        size === 'lg' ? styles.lg : size === 'md' ? styles.md : size === 'sm' ? styles.sm : styles.xs,
        tone !== 'ghost' && styles.shadow,
        pressed && active && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button">
      {loading ? (
        <ActivityIndicator color={t.fg} />
      ) : (
        <View style={[styles.inner, size === 'xs' && styles.xsInner, size === 'sm' && styles.smInner]}>
          {image ? (
            <Image
              source={image}
              style={size === 'lg' ? styles.imageLg : size === 'md' ? styles.imageMd : styles.imageSm}
              contentFit="contain"
              accessibilityLabel=""
            />
          ) : null}
          {Icon ? <Icon size={size === 'lg' ? 20 : size === 'md' ? 17 : size === 'sm' ? 14 : 12} color={t.fg} strokeWidth={2.4} /> : null}
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
  shadow: {
    shadowColor: 'rgba(12, 35, 49, 0.35)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
  },
  block: {
    alignSelf: 'stretch',
  },
  lg: {
    height: 50,
    paddingHorizontal: 20,
  },
  md: {
    height: 42,
    paddingHorizontal: 16,
  },
  sm: {
    height: 32,
    paddingHorizontal: 12,
  },
  xs: {
    height: 26,
    paddingHorizontal: 8,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smInner: {
    gap: 6,
  },
  xsInner: {
    gap: 4,
  },
  imageLg: {
    width: 26,
    height: 26,
  },
  imageMd: {
    width: 20,
    height: 20,
  },
  imageSm: {
    width: 16,
    height: 16,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
