import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { palette } from '@/constants/theme';

const COLOR_CYCLE_MS = 3000;
const WAVE_MS = 900;

const DOT_COLORS = [palette.accent[500], palette.brand[600], palette.green[600], palette.accent[500]];

export function PulsarDot({ size = 10 }: { size?: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dot = Animated.loop(
      Animated.timing(progress, {
        toValue: 3,
        duration: COLOR_CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    const ripple = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: WAVE_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
    );
    const ripple2 = Animated.loop(
      Animated.sequence([
        Animated.delay(WAVE_MS / 2),
        Animated.timing(wave2, {
          toValue: 1,
          duration: WAVE_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    dot.start();
    ripple.start();
    ripple2.start();
    return () => {
      dot.stop();
      ripple.stop();
      ripple2.stop();
    };
  }, [progress, wave, wave2]);

  const currentColor = progress.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: DOT_COLORS,
  });

  const dotScale = progress.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0.85, 1.2, 1.2, 0.85],
    extrapolate: 'clamp',
  });

  const ringScale = (v: Animated.AnimatedInterpolation<number>) =>
    v.interpolate({ inputRange: [0, 1], outputRange: [1, 3], extrapolate: 'clamp' });
  const ringOpacity = (v: Animated.AnimatedInterpolation<number>) =>
    v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.45, 0.15, 0] });

  const box = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          box,
          { borderColor: currentColor, opacity: ringOpacity(wave), transform: [{ scale: ringScale(wave) }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          box,
          { borderColor: currentColor, opacity: ringOpacity(wave2), transform: [{ scale: ringScale(wave2) }] },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          box,
          { backgroundColor: currentColor, transform: [{ scale: dotScale }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  dot: {
    backgroundColor: palette.accent[500],
  },
});