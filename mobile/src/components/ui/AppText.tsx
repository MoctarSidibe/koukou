import React from 'react';
import { Text, StyleSheet, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { resolveWeight, typography, tone, type ColorToken, type TextSize, type TextWeight } from '@/constants/theme';

interface AppTextProps extends TextProps {
  size?: TextSize;
  weight?: TextWeight;
  color?: string;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
}

export function AppText({
  size = 'body',
  weight = 'regular',
  color: tint = 'text',
  align,
  style,
  ...rest
}: AppTextProps) {
  const resolved = tint.startsWith('#') ? tint : tone(tint as ColorToken);
  return (
    <Text
      {...rest}
      style={[
        { fontSize: typography[size].fontSize, lineHeight: typography[size].lineHeight },
        { fontWeight: resolveWeight(weight) },
        { color: resolved },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

export function appTextStyles(size: TextSize, weight: TextWeight, tint: string, align?: TextStyle['textAlign']) {
  const resolved = tint.startsWith('#') ? tint : tone(tint as ColorToken);
  return StyleSheet.flatten([
    { fontSize: typography[size].fontSize, lineHeight: typography[size].lineHeight },
    { fontWeight: resolveWeight(weight) },
    { color: resolved },
    align ? { textAlign: align } : null,
  ]);
}