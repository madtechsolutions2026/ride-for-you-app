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
            ? ['#C7D6CE', '#BFD0C7', '#B6C9BF']
            : [colors.brand.gradientFrom, colors.brand.gradientTo, '#9EE7C4']
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

      {/* White circle with the arrow — overhangs the right edge */}
      <View style={styles.arrowCircle}>
        <Ionicons name="arrow-forward" size={19} color={colors.brand.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 54,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  gradient: {
    flex: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 24,
    paddingRight: 52, // room for the label to clear the overhanging circle
  },
  label: {
    ...textStyles.button,
    color: colors.text.inverse,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255, 255, 255, 0.45)',
  },
  arrowCircle: {
    position: 'absolute',
    right: -6, // sticks out past the button
    top: 2,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
});
