/**
 * PrimaryButton.tsx
 * -----------------
 * The green gradient button with a white circle + arrow that OVERHANGS the
 * right edge, a subtle underline under the label, and a soft green glow —
 * the "Continue with OTP" button in the mockup.
 *
 * Props:
 *   label     text on the button
 *   onPress   what happens on tap
 *   loading   show a spinner instead of the label, and block taps
 *   disabled  greyed out, blocks taps
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, textStyles } from '../theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function PrimaryButton({ label, onPress, loading, disabled, style }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.wrapper,
        shadows.button,
        { opacity: pressed || isDisabled ? 0.9 : 1 },
        style,
      ]}
    >
      <LinearGradient
        // 3 stops: medium green → light green → pale mint on the right,
        // so the button fades out where the white circle overhangs.
        colors={
          isDisabled
            ? [colors.state.disabledFrom, colors.state.disabledMid, colors.state.disabledTo]
            : [colors.brand.gradientFrom, colors.brand.gradientTo, colors.brand.gradientEnd]
        }
        locations={[0, 0.62, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={colors.text.inverse} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </LinearGradient>

      {/*
        The arrow slot, rebuilt from the Figma export ("Group 39544").

        It is NOT a white circle overhanging the button's right edge — that
        was a misread. The design is a recessed 67x54 pill sitting INSIDE the
        button, holding a raised 52x40 face (rx 20) with the arrow on it.
        Both are sized off the button's own height so they stay in proportion.
      */}
      <View style={styles.slotTrack} pointerEvents="none">
        <View style={styles.slotFace}>
          <Ionicons name="arrow-forward" size={ARROW_GLYPH} color={colors.control.slotArrow} />
        </View>
      </View>
    </Pressable>
  );
}

/*
 * Geometry from the Figma export ("Group 39544"), a 326 x 54 button:
 *   slot track  67 x 54, at the right end, rx 27  (#F2F3F8)
 *   slot face   52 x 40, inset 7 from right/top/bottom, rx 20  (#F9F9FB)
 * Expressed as ratios of the button's height so they hold at any size.
 */
const BTN_H = 54; // design height
const HEIGHT = 45; // 54 design pt -> dp at 360 (54 * 360/430)
const r = (designValue: number) => Math.round((designValue / BTN_H) * HEIGHT);

const TRACK_W = r(67);
const FACE_W = r(52);
const FACE_H = r(40);
const INSET = r(7);
const ARROW_GLYPH = r(20);

const styles = StyleSheet.create({
  wrapper: {
    // Figma: 326 x 54 in the 430pt frame -> 45dp tall at 360dp.
    height: HEIGHT,
    borderRadius: radius.pill,
    justifyContent: 'center',
    // Android derives an elevation shadow from the view's own background, and
    // this wrapper had none (the gradient sits on a child), so the green glow
    // never rendered. boxShadow doesn't require it, but filling with the
    // gradient's start colour also removes any white seam if the child rounds
    // a pixel short of the wrapper's radius.
    backgroundColor: colors.brand.gradientFrom,
  },
  gradient: {
    flex: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 24,
    paddingRight: TRACK_W, // label clears the arrow slot
  },
  label: {
    ...textStyles.button,
    color: colors.text.inverse,
  },
  /* the recessed pill at the right end — inside the button, not overhanging */
  slotTrack: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: TRACK_W,
    borderRadius: radius.pill,
    backgroundColor: colors.control.slotTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* the raised face carrying the arrow */
  slotFace: {
    position: 'absolute',
    right: INSET,
    width: FACE_W,
    height: FACE_H,
    borderRadius: FACE_H / 2,
    backgroundColor: colors.control.slotFace,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
});
