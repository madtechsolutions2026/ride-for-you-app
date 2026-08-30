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
          // The underline is a View, not textDecorationLine. `textDecorationColor`
          // is iOS-only — on Android the underline ignored it and drew solid
          // white instead of the soft 45% the mockup shows.
          <View style={styles.labelWrap}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.labelUnderline} />
          </View>
        )}
      </LinearGradient>

      {/* White circle with the arrow — overhangs the right edge */}
      <View style={styles.arrowCircle}>
        <Ionicons name="arrow-forward" size={19} color={colors.brand.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Measured off the mockup at 55.8dp — two independent column scans agreed,
    // which is also what validated the 360dp scale for every other number.
    height: 56,
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
    paddingRight: 52, // room for the label to clear the overhanging circle
  },
  labelWrap: { alignItems: 'center' },
  label: {
    ...textStyles.button,
    color: colors.text.inverse,
  },
  labelUnderline: {
    alignSelf: 'stretch',
    height: 1,
    marginTop: 2,
    backgroundColor: colors.overlay.onAccent,
  },
  arrowCircle: {
    position: 'absolute',
    right: -6, // sticks out past the button
    top: 3, // (56 - 50) / 2 — keeps the circle centred now the button is 56 tall
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
});
