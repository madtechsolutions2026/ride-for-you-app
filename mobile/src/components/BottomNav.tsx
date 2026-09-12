import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fontFamily, shadows } from '../theme';

/**
 * The app's one bottom tab bar.
 *
 * Home and Profile each used to carry their own copy, and the two had drifted:
 * different tabs (Home had Support, Profile had Wallet), a badge hardcoded to
 * "2" in both, and every button on Profile's bar wired to `() => {}` so four
 * of five did nothing at all. One component now, one tab set, one real badge.
 */

export type TabKey = 'home' | 'bookings' | 'wallet' | 'support' | 'profile';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Tab {
  key: TabKey;
  label: string;
  /** Outline when inactive, solid when active — the usual iOS/Material pair. */
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  screen: keyof RootStackParamList;
}

const TABS: Tab[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', screen: 'Home' },
  {
    key: 'bookings',
    label: 'Bookings',
    icon: 'receipt-outline',
    activeIcon: 'receipt',
    screen: 'MyBookings',
  },
  {
    key: 'wallet',
    label: 'Wallet',
    icon: 'wallet-outline',
    activeIcon: 'wallet',
    screen: 'Wallet',
  },
  {
    key: 'support',
    label: 'Support',
    icon: 'headset-outline',
    activeIcon: 'headset',
    screen: 'Support',
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: 'person-outline',
    activeIcon: 'person',
    screen: 'Profile',
  },
];

interface Props {
  active: TabKey;
  /** Badge shown on Support — open tickets awaiting the rider, if you have it. */
  supportBadge?: number;
}

export const BottomNav: React.FC<Props> = ({ active, supportBadge }) => {
  const navigation = useNavigation<Nav>();

  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const isActive = t.key === active;
        const badge = t.key === 'support' ? (supportBadge ?? 0) : 0;

        return (
          <Pressable
            key={t.key}
            style={styles.tab}
            hitSlop={6}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={
              badge > 0 ? `${t.label}, ${badge} needing attention` : t.label
            }
            onPress={() => {
              // Tapping the tab you are already on should do nothing rather
              // than push a second copy of the screen onto the stack.
              if (isActive) return;
              navigation.navigate(t.screen as never);
            }}
          >
            <View>
              <Ionicons
                name={isActive ? t.activeIcon : t.icon}
                size={22}
                color={isActive ? colors.brand.primary : colors.text.secondary}
              />
              {badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>{t.label}</Text>
            {isActive && <View style={styles.activeBar} />}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    paddingVertical: 10,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.soft,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 12,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 3,
  },
  labelActive: {
    fontFamily: fontFamily.bold,
    color: colors.brand.primary,
  },
  activeBar: {
    position: 'absolute',
    bottom: -8,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brand.primary,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -6,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 7,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
    color: colors.common.white,
  },
});

/** Height to reserve at the bottom of a scroll view so the bar never covers content. */
export const BOTTOM_NAV_HEIGHT = 78;
