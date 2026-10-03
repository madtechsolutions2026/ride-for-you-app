import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily } from '../theme';
import { useUnreadCount } from '../hooks/useNotifications';

/**
 * Header bell with the real unread count.
 *
 * Replaces the hardcoded "2" that sat on the Home and Profile tab bars — a
 * number that never moved no matter what the rider did.
 */
export const NotificationBell: React.FC<{ onPress: () => void; tint?: string }> = ({
  onPress,
  tint = colors.text.primary,
}) => {
  const unread = useUnreadCount();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <View>
        <Ionicons name="notifications-outline" size={20} color={tint} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface.card,
  },
  badgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
    color: colors.common.white,
  },
});
