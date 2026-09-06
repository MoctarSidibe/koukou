import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Svg, Circle } from 'react-native-svg';

import { AppText } from './AppText';
import { gradeColor, radii, color } from '@/constants/theme';
import type { HealthGrade } from '@/api/types';

interface PulseRingProps {
  score: number;
  grade: HealthGrade;
  size?: number;
  onPress?: () => void;
}

const FR = 10;

export function PulseRing({ score, grade, size = 190, onPress }: PulseRingProps) {
  const r = (size - FR * 2) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const tint = gradeColor[grade];

  const ring = (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color.surfaceAlt}
          strokeWidth={FR}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tint}
          strokeWidth={FR}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <AppText size="display" weight="bold" color={tint}>
          {score}
        </AppText>
        <AppText size="small" weight="semibold" color="muted">
          sur 100
        </AppText>
        <View style={[styles.grade, { backgroundColor: `${tint}1A` }]}>
          <AppText size="label" weight="bold" color={tint}>
            {grade}
          </AppText>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={styles.press}>
        {ring}
      </Pressable>
    );
  }
  return ring;
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  grade: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  press: {
    borderRadius: radii.pill,
  },
});