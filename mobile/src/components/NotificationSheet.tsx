import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, radius, shadows, spacing } from '../theme';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'offer' | 'kyc' | 'system';
  unread: boolean;
};

const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    title: '⚡ Weekend Battery Swap Discount',
    message: 'Enjoy unlimited battery swaps at 20% off across all Hyderabad metro hubs this weekend!',
    time: '15m ago',
    type: 'offer',
    unread: true,
  },
  {
    id: 'n2',
    title: '🪪 KYC Verification in Progress',
    message: 'Complete your profile and upload documents to get approved for express high-speed rentals.',
    time: '2h ago',
    type: 'kyc',
    unread: true,
  },
  {
    id: 'n3',
    title: '🎉 Welcome to Ride For You!',
    message: 'Your account is ready. Pick up a smart scooter at any nearby station and ride sustainably.',
    time: '1d ago',
    type: 'system',
    unread: false,
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function NotificationSheet({ visible, onClose }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(SAMPLE_NOTIFICATIONS);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.title}>Notifications</Text>
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>
                  {notifications.filter((n) => n.unread).length}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <Pressable onPress={handleMarkAllRead} hitSlop={6}>
                <Text style={styles.markReadText}>Mark all read</Text>
              </Pressable>
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={6}>
                <Ionicons name="close" size={20} color={colors.text.secondary} />
              </Pressable>
            </View>
          </View>

          {/* Notification List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {notifications.map((item) => (
              <View
                key={item.id}
                style={[styles.itemCard, item.unread && styles.itemCardUnread]}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor:
                        item.type === 'offer'
                          ? colors.status.warningTint
                          : item.type === 'kyc'
                          ? colors.brand.mint
                          : colors.status.infoTint,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      item.type === 'offer'
                        ? 'pricetag'
                        : item.type === 'kyc'
                        ? 'shield-checkmark'
                        : 'notifications'
                    }
                    size={20}
                    color={
                      item.type === 'offer'
                        ? colors.status.warning
                        : item.type === 'kyc'
                        ? colors.brand.primary
                        : colors.status.info
                    }
                  />
                </View>

                <View style={styles.itemContent}>
                  <View style={styles.itemTopRow}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {item.unread && <View style={styles.dot} />}
                  </View>
                  <Text style={styles.itemMessage}>{item.message}</Text>
                  <Text style={styles.itemTime}>{item.time}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 36,
    maxHeight: '80%',
    ...shadows.card,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
  },
  unreadCountBadge: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  unreadCountText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: colors.common.white,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  markReadText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: colors.brand.primary,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    paddingBottom: spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  itemCardUnread: {
    backgroundColor: colors.common.white,
    borderColor: colors.brand.mint,
    ...shadows.subtle,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  itemContent: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: colors.text.primary,
    flex: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.brand.primary,
    marginLeft: 6,
  },
  itemMessage: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text.secondary,
    marginTop: 2,
  },
  itemTime: {
    fontFamily: fontFamily.medium,
    fontSize: 10.5,
    color: colors.neutral[400],
    marginTop: 6,
  },
});
