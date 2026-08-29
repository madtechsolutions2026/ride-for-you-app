/**
 * QuickAction.tsx
 * ---------------
 * One item in the Home screen's quick-action row: a mint circle with an icon
 * and a 1–2 line label under it. Optional "New" badge on the corner.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily } from '../theme';

type QuickActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: string;
  onPress?: () => void;
};

export function QuickAction({ icon, label, badge, onPress }: QuickActionProps) {
  return (
    <Pressable style={styles.wrap} onPress={onPress} hitSlop={4}>
      <View style={styles.circle}>
        <Ionicons name={icon} size={22} color={colors.brand.primary} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: 72 },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: colors.brand.primary,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: fontFamily.bold, fontSize: 8, color: colors.text.inverse },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
