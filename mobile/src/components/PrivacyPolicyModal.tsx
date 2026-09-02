import React from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, shadows, spacing } from '../theme';
import { PrimaryButton } from './PrimaryButton';

interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  visible,
  onClose,
  title = 'Privacy Policy & Data Protection',
}) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              maxHeight: height * 0.85,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="shield-checkmark" size={22} color={colors.brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subTitle}>Ride For You Enterprise • Version 2.5</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </Pressable>
          </View>

          {/* Security Badge Pill */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="lock-closed" size={12} color={colors.brand.primary} />
              <Text style={styles.badgeText}>256-Bit Cloudflare R2 Vault Encryption</Text>
            </View>
          </View>

          {/* Policy Text Scroll */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Data Collection & Purpose</Text>
              <Text style={styles.bodyText}>
                When you register, submit verification, or rent an EV with <Text style={styles.bold}>Ride For You</Text>, we collect:
              </Text>
              <Text style={styles.bullet}>• <Text style={styles.bold}>Contact Information:</Text> Mobile number and OTP verification.</Text>
              <Text style={styles.bullet}>• <Text style={styles.bold}>KYC Identity Documents:</Text> Aadhaar card, Address proof, and Live selfie for driver license validation and commercial compliance.</Text>
              <Text style={styles.bullet}>• <Text style={styles.bold}>Telemetry & GPS:</Text> Live vehicle coordinates during active rental journeys for roadside recovery, battery swapping, and theft protection.</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Bank-Grade Document Security</Text>
              <Text style={styles.bodyText}>
                All uploaded government documents are encrypted and stored in private <Text style={styles.bold}>Cloudflare R2 Object Storage</Text>.
                Access is restricted to verified operations personnel via short-lived, encrypted presigned URLs. We never store raw identity photos on unencrypted public servers.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. No Third-Party Selling</Text>
              <Text style={styles.bodyText}>
                We do <Text style={styles.bold}>NOT</Text> sell, trade, or monetize your personal data. Your contact details are strictly used for rental bookings, automated OTP delivery, and payment invoicing.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>4. Rental & Refund Agreement</Text>
              <Text style={styles.bodyText}>
                Security deposits and weekly rental fees are processed through secure Reserve Bank of India (RBI) compliant payment channels. Deposits are released upon successful vehicle return inspection.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>5. Your Privacy Rights</Text>
              <Text style={styles.bodyText}>
                You retain the right to request deletion of your uploaded verification documents once your rental agreement is concluded. Contact our 24/7 support desk at <Text style={styles.bold}>support@rideforyou.in</Text>.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <PrimaryButton label="I Understand & Agree" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 43, 58, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text.primary,
  },
  subTitle: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.brand.mintSoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand.mint,
  },
  badgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: colors.brand.dark,
  },
  content: {
    marginVertical: spacing.sm,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.text.primary,
    marginBottom: 4,
  },
  bodyText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  bullet: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.secondary,
    marginTop: 3,
    paddingLeft: 4,
  },
  bold: {
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  footer: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

