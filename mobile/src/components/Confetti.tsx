/**
 * Confetti.tsx
 * ------------
 * A lightweight one-shot confetti burst — no native deps, just Animated.
 * Drop it into a relatively/absolutely positioned parent and give it the
 * area height to fall through.
 *
 *   <View style={{ position: 'relative' }}>
 *     <Confetti height={320} />
 *     ...content...
 *   </View>
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  /** How tall the fall area is (px). */
  height: number;
  /** How wide the fall area is (px). Defaults to a wide guess. */
  width?: number;
  /** Number of falling pieces in the burst. */
  count?: number;
  /** Play the burst automatically on mount. */
  autoPlay?: boolean;
  /** Non-animated specks left scattered near the top as decoration. */
  decor?: number;
};

const PALETTE = [
  colors.brand.primary,
  colors.brand.light,
  colors.status.info,
  colors.status.warning,
  colors.status.error,
  colors.accent.purple,
  colors.brand.gradientEnd,
];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function Confetti({ height, width = 420, count = 30, autoPlay = true, decor = 12 }: Props) {
  const specks = useMemo(
    () =>
      Array.from({ length: decor }).map((_, i) => ({
        key: `d${i}`,
        x: rand(0, width),
        y: rand(0, height * 0.42),
        size: rand(5, 9),
        long: Math.random() > 0.5,
        color: PALETTE[Math.floor(rand(0, PALETTE.length))],
        rot: rand(0, 360),
        round: Math.random() > 0.7,
      })),
    [decor, width, height]
  );

  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        key: i,
        x: rand(0, width),
        drift: rand(-50, 50),
        size: rand(6, 11),
        long: Math.random() > 0.5,
        color: PALETTE[Math.floor(rand(0, PALETTE.length))],
        delay: rand(0, 450),
        duration: rand(2600, 4200),
        spin: rand(2, 5) * (Math.random() > 0.5 ? 1 : -1),
        round: Math.random() > 0.7,
      })),
    [count, width]
  );

  const progress = useRef(pieces.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!autoPlay) return;
    const anims = pieces.map((p, i) =>
      Animated.timing(progress[i], {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: true,
      })
    );
    Animated.parallel(anims).start();
  }, [autoPlay]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {specks.map((s) => (
        <View
          key={s.key}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.long ? s.size * 1.7 : s.size,
            borderRadius: s.round ? s.size : 2,
            backgroundColor: s.color,
            opacity: 0.85,
            transform: [{ rotate: `${s.rot}deg` }],
          }}
        />
      ))}
      {pieces.map((p, i) => {
        const t = progress[i];
        const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-24, height + 40] });
        const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const rotate = t.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.spin * 360}deg`],
        });
        const opacity = t.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={p.key}
            style={{
              position: 'absolute',
              left: p.x,
              top: 0,
              width: p.size,
              height: p.long ? p.size * 1.7 : p.size,
              borderRadius: p.round ? p.size : 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
