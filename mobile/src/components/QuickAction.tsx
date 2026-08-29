/**
 * QuickAction.tsx
 * ---------------
 * One item in the Home screen's quick-action row: a mint circle with an icon
 * and a 1–2 line label under it. Optional "New" badge on the corner.
 *
 * `QuickActionDivider` is the thin vertical hairline drawn between items.
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
        <Ionicons name={icon} size={21} color={colors.brand.primary} />
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

export function QuickActionDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center' },
  circle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: 6,
    backgroundColor: colors.brand.primary,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  badgeText: { fontFamily: fontFamily.bold, fontSize: 8.5, color: colors.text.inverse },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 9,
  },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: 6 },
});
