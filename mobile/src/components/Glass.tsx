/**
 * Glass.tsx
 * ---------
 * A frosted-glass surface. Whatever sits BEHIND it (the hero photo, the page
 * background) shows through, blurred. Used for the language pill, the shield
 * badge, and the trust-badge circles in the mockup.
 *
 * How it's built — three stacked layers inside one rounded, clipped box:
 *   1. <BlurView>        real blur of whatever is behind
 *   2. a white wash      so text on top stays readable
 *   3. {children}        your actual content
 *
 * Usage:
 *   <Glass borderRadius={radius.pill} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
 *     <Text>🌐 English</Text>
 *   </Glass>
 */

import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass, radius } from '../theme';

type GlassProps = ViewProps & {
  /** Corner rounding. Defaults to a full pill. */
  borderRadius?: number;
  /** Frost strength 0–100. Defaults to the theme value. */
  intensity?: number;
};

export function Glass({
  borderRadius = radius.pill,
  intensity = glass.blurIntensity,
  style,
  children,
  ...rest
}: GlassProps) {
  return (
    <View style={[styles.wrapper, { borderRadius }, style]} {...rest}>
      {/* Layer 1 — blur the content behind this box */}
      <BlurView
        intensity={intensity}
        tint={glass.blurTint}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />
      {/* Layer 2 — a translucent white wash for contrast */}
      <View style={[StyleSheet.absoluteFill, { borderRadius, backgroundColor: glass.fill }]} />
      {/* Layer 3 — whatever you put inside <Glass>...</Glass> */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden', // clips the blur to the rounded corners
    borderWidth: glass.borderWidth,
    borderColor: glass.border, // the bright "glass rim"
  },
});
