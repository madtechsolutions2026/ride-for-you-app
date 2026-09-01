import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, radius, shadows, spacing } from '../theme';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';

type Props = {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  userPhone?: string;
  kycStatus?: string;
  onNavigateProfile: () => void;
  onNavigateBookings?: () => void;
  onNavigateWallet?: () => void;
  onLogout: () => void;
};

export function SideDrawer({
  visible,
  onClose,
  userName,
  userPhone,
  kycStatus = 'PENDING',
  onNavigateProfile,
  onNavigateBookings,
  onNavigateWallet,
  onLogout,
}: Props) {
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.8, 320);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

  const isVerified = kycStatus === 'APPROVED' || kycStatus === 'Verified';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdropPress} onPress={onClose} />

        <View style={[styles.drawer, { width: drawerWidth }]}>
          {/* Header Profile Section */}
          <View style={styles.header}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitial}>
                  {userName ? userName.charAt(0).toUpperCase() : (userPhone ? userPhone.slice(-2) : 'R')}
                </Text>
              </View>
            </View>

            <View style={styles.headerInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {userName ? userName : 'Rider'}
              </Text>
              <Text style={styles.userPhone}>
                {userPhone ? userPhone : '+91 Phone'}
              </Text>
              <View style={[styles.kycBadge, isVerified ? styles.kycBadgeVerified : styles.kycBadgePending]}>
                <Ionicons
                  name={isVerified ? 'checkmark-circle' : 'time'}
                  size={12}
                  color={isVerified ? colors.status.success : colors.status.warning}
                />
                <Text style={[styles.kycBadgeText, isVerified ? styles.kycTextVerified : styles.kycTextPending]}>
                  {isVerified ? 'KYC Verified' : 'KYC Pending'}
                </Text>
              </View>
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* Menu Items */}
          <ScrollView showsVerticalScrollIndicator={false} style={styles.menuScroll}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onNavigateProfile();
              }}
            >
              <View style={styles.menuIconWrapper}>
                <Ionicons name="person-outline" size={20} color={colors.brand.primary} />
              </View>
              <Text style={styles.menuLabel}>My Profile & KYC</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onNavigateBookings && onNavigateBookings();
              }}
            >
              <View style={styles.menuIconWrapper}>
                <Ionicons name="calendar-outline" size={20} color={colors.brand.primary} />
              </View>
              <Text style={styles.menuLabel}>My Bookings & Rides</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onNavigateWallet && onNavigateWallet();
              }}
            >
              <View style={styles.menuIconWrapper}>
                <Ionicons name="wallet-outline" size={20} color={colors.brand.primary} />
              </View>
              <Text style={styles.menuLabel}>Wallet & Payments</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={onClose}
            >
              <View style={styles.menuIconWrapper}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.brand.primary} />
              </View>
              <Text style={styles.menuLabel}>Safety & Helmet Guide</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => setPrivacyModalVisible(true)}
            >
              <View style={styles.menuIconWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.brand.primary} />
              </View>
              <Text style={styles.menuLabel}>Privacy Policy & Data Security</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={onClose}
            >
              <View style={styles.menuIconWrapper}>
                <Ionicons name="headset-outline" size={20} color={colors.brand.primary} />
              </View>
              <Text style={styles.menuLabel}>24/7 Rider Support</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
            </Pressable>
          </ScrollView>

          {/* Log Out Button */}
          <View style={styles.footer}>
            <Pressable
              style={styles.logoutBtn}
              onPress={() => {
                onClose();
                onLogout();
              }}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.status.error} />
              <Text style={styles.logoutText}>Log Out</Text>
            </Pressable>
            <Text style={styles.versionText}>Ride For You • v1.0.2</Text>
          </View>
        </View>

        <PrivacyPolicyModal
          visible={privacyModalVisible}
          onClose={() => setPrivacyModalVisible(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    flexDirection: 'row',
  },
  backdropPress: {
    flex: 1,
  },
  drawer: {
    height: '100%',
    backgroundColor: colors.surface.card,
    paddingTop: 54,
    paddingHorizontal: spacing.md,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: colors.brand.primary,
  },
  headerInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text.primary,
  },
  userPhone: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
    marginTop: 1,
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  kycBadgeVerified: {
    backgroundColor: colors.brand.mint,
  },
  kycBadgePending: {
    backgroundColor: colors.status.warningTint,
  },
  kycBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
  },
  kycTextVerified: {
    color: colors.status.success,
  },
  kycTextPending: {
    color: colors.status.warning,
  },
  closeBtn: {
    padding: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  menuScroll: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  menuIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brand.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  menuLabel: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 13.5,
    color: colors.text.primary,
  },
  footer: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.status.errorTint,
    marginBottom: spacing.xs,
  },
  logoutText: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: colors.status.error,
  },
  versionText: {
    fontFamily: fontFamily.regular,
    fontSize: 10.5,
    color: colors.text.secondary,
    marginTop: 4,
  },
});
