import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { useNotifications, AppNotification } from '../hooks/useNotifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

/**
 * The rider's inbox — previously a hardcoded array of three fake rows.
 *
 * Tapping a notification marks it read and follows its deep link, which is the
 * same `screen`/`params` pair the push payload carries, so a notification
 * behaves identically whether it arrives as a push or is found here later.
 */

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  BOOKING: 'calendar-outline',
  PAYMENT: 'card-outline',
  KYC: 'shield-checkmark-outline',
  RENTAL: 'bicycle-outline',
  SUPPORT: 'chatbubble-ellipses-outline',
  SWAP: 'battery-charging-outline',
  PROMO: 'gift-outline',
  SYSTEM: 'information-circle-outline',
};

const CATEGORY_TINT: Record<string, string> = {
  BOOKING: colors.brand.mint,
  PAYMENT: colors.status.warningTint,
  KYC: colors.status.successTint,
  RENTAL: colors.brand.mintStrong,
  SUPPORT: colors.status.infoTint,
  SWAP: colors.brand.mintSoft,
  PROMO: colors.accent.purpleTint,
  SYSTEM: colors.neutral[100],
};

const CATEGORY_COLOR: Record<string, string> = {
  BOOKING: colors.brand.primary,
  PAYMENT: colors.status.warning,
  KYC: colors.status.success,
  RENTAL: colors.brand.dark,
  SUPPORT: colors.status.info,
  SWAP: colors.brand.primary,
  PROMO: colors.accent.purple,
  SYSTEM: colors.text.secondary,
};

/** "just now" / "3h ago" / "12 Sep" — absolute once it stops being recent. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function NotificationsScreen({ navigation }: Props) {
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead } =
    useNotifications();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const openNotification = (n: AppNotification) => {
    if (!n.readAt) void markRead(n.id);

    // The server authors the deep link, so the route name cannot be proved at
    // compile time here — same escape hatch App.tsx uses for push payloads.
    if (n.screen) {
      const go = navigation.navigate as unknown as (s: string, p?: object) => void;
      go(n.screen, n.params ?? undefined);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>

        {unreadCount > 0 && (
          <Pressable onPress={markAllRead} hitSlop={8} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.primary}
            />
          }
        >
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="cloud-offline-outline" size={16} color={colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {notifications.length === 0 && !error ? (
            <View style={styles.empty}>
              <View style={styles.emptyHalo}>
                <Ionicons
                  name="notifications-off-outline"
                  size={28}
                  color={colors.neutral[400]}
                />
              </View>
              <Text style={styles.emptyTitle}>Nothing yet</Text>
              <Text style={styles.emptyHint}>
                Booking updates, rent reminders and support replies will appear here.
              </Text>
            </View>
          ) : (
            notifications.map((n) => {
              const unread = !n.readAt;
              return (
                <Pressable
                  key={n.id}
                  style={[styles.card, unread && styles.cardUnread]}
                  onPress={() => openNotification(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${n.title}. ${n.body}${unread ? '. Unread' : ''}`}
                >
                  <View
                    style={[
                      styles.icon,
                      { backgroundColor: CATEGORY_TINT[n.category] ?? colors.neutral[100] },
                    ]}
                  >
                    <Ionicons
                      name={CATEGORY_ICON[n.category] ?? 'ellipse-outline'}
                      size={18}
                      color={CATEGORY_COLOR[n.category] ?? colors.text.secondary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      <Text style={styles.time}>{relativeTime(n.createdAt)}</Text>
                    </View>
                    <Text style={styles.body}>{n.body}</Text>
                  </View>

                  {unread && <View style={styles.unreadDot} />}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
    paddingTop: 56,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { marginRight: spacing.md },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
  },
  markAllBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.mintSoft,
  },
  markAllText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11.5,
    color: colors.brand.dark,
  },

  scroll: { padding: screenPadding, paddingBottom: spacing.xxl },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.errorTint,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 12.5,
    color: colors.status.error,
  },

  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyHalo: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyHint: {
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.lg,
    lineHeight: 18,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.subtle,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.brand.primary,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 13.5,
    color: colors.text.primary,
  },
  titleUnread: { fontFamily: fontFamily.bold },
  time: {
    fontFamily: fontFamily.regular,
    fontSize: 10.5,
    color: colors.text.secondary,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.secondary,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.primary,
    marginTop: 6,
  },
});
