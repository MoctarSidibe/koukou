import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { palette } from '@/constants/theme';

const WAVE_MS = 900;

export function PulsarDot({ size = 10, color }: { size?: number; color?: string }) {
  const wave = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const dotColor = color ?? palette.accent[500];

  useEffect(() => {
    const ripple = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: WAVE_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    const ripple2 = Animated.loop(
      Animated.sequence([
        Animated.delay(WAVE_MS / 2),
        Animated.timing(wave2, {
          toValue: 1,
          duration: WAVE_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    ripple.start();
    ripple2.start();
    pulse.start();
    return () => {
      ripple.stop();
      ripple2.stop();
      pulse.stop();
    };
  }, [wave, wave2, breathe]);

  const ringScale = (v: Animated.AnimatedInterpolation<number>) =>
    v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5], extrapolate: 'clamp' });
  const ringOpacity = (v: Animated.AnimatedInterpolation<number>) =>
    v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.28, 0.08, 0] });
  const dotScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.1],
  });

  const box = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          box,
          { borderColor: dotColor, opacity: ringOpacity(wave), transform: [{ scale: ringScale(wave) }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          box,
          { borderColor: dotColor, opacity: ringOpacity(wave2), transform: [{ scale: ringScale(wave2) }] },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          box,
          { backgroundColor: dotColor, transform: [{ scale: dotScale }] },
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