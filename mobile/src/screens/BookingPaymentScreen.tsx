import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { images } from '../assets';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { ThemedModal, PrivacyPolicyModal } from '../components';
import { apiClient } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingPayment'>;

type Booking = {
  id: string;
  reference: string;
  status: string;
  model: { name: string; category: string; imageUrl: string | null } | null;
  plan: { duration: string; price: number; deposit: number } | null;
  hub: { name: string; address: string } | null;
  charges: { rent: number; deposit: number; platformFee: number; total: number };
};

const METHODS = [
  { key: 'PHONEPE', label: 'PhonePe', sub: 'UPI · Wallet', icon: 'phone-portrait-outline' as const },
  { key: 'RAZORPAY', label: 'Razorpay', sub: 'Cards · Netbanking', icon: 'card-outline' as const },
  { key: 'UPI', label: 'UPI', sub: 'GPay · Paytm · BHIM', icon: 'qr-code-outline' as const },
];

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const planLabel = (d?: string) =>
  d === 'WEEK' ? 'Weekly' : d === 'MONTH' ? 'Monthly' : d === 'DAY' ? 'Daily' : d || '';

export default function BookingPaymentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<string>('PHONEPE');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient
      .get(`/rental/bookings/${bookingId}`)
      .then((res) => {
        if (!alive) return;
        const b: Booking = res.data.booking;
        setBooking(b);
        if (b.status !== 'PENDING') {
          navigation.replace('BookingConfirmed', { bookingId });
        }
      })
      .catch(() => alive && setError('Could not load this booking. Please try again.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [bookingId]);

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      await apiClient.post(`/rental/bookings/${bookingId}/pay`, { method });
      navigation.replace('BookingConfirmed', { bookingId });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Payment failed. Please try again.');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centre]}>
        <ActivityIndicator color={colors.brand.primary} size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <ThemedModal
        visible
        title="Something went wrong"
        message={error || 'Booking not found.'}
        icon="alert-circle-outline"
        confirmLabel="Go back"
        onConfirm={() => navigation.goBack()}
      />
    );
  }

  const c = booking.charges;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Secure Checkout</Text>
          <Text style={styles.headerSub}>Booking {booking.reference}</Text>
        </View>
        <View style={styles.lockPill}>
          <Ionicons name="lock-closed" size={12} color={colors.brand.primary} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Bike summary */}
        <View style={styles.bikeCard}>
          <View style={styles.bikeImgBox}>
            <Image
              source={booking.model?.imageUrl ? { uri: booking.model.imageUrl } : images.vehicleS1}
              style={styles.bikeImg}
              contentFit="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bikeName} numberOfLines={1}>
              {booking.model?.name || 'EV Bike'}
            </Text>
            <Text style={styles.bikeMeta}>
              {planLabel(booking.plan?.duration)} plan
            </Text>
            {booking.hub && (
              <View style={styles.hubRow}>
                <Ionicons name="location-outline" size={12} color={colors.text.secondary} />
                <Text style={styles.hubText} numberOfLines={1}>
                  {booking.hub.name}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Charges */}
        <Text style={styles.sectionLabel}>Payment summary</Text>
        <View style={styles.card}>
          <Row label={`${planLabel(booking.plan?.duration)} rental`} value={rupee(c.rent)} />
          <Row label="Refundable deposit" value={rupee(c.deposit)} hint="Returned after the ride" />
          <Row label="Platform fee" value={rupee(c.platformFee)} hint="One-time · non-refundable" />
          <View style={styles.divider} />
          <Row label="Total payable" value={rupee(c.total)} strong />
        </View>

        {/* Method */}
        <Text style={styles.sectionLabel}>Choose payment method</Text>
        <View style={styles.card}>
          {METHODS.map((m, i) => {
            const active = method === m.key;
            return (
              <Pressable
                key={m.key}
                style={[styles.method, i < METHODS.length - 1 && styles.methodBorder]}
                onPress={() => setMethod(m.key)}
              >
                <View style={[styles.methodIcon, active && styles.methodIconActive]}>
                  <Ionicons
                    name={m.icon}
                    size={18}
                    color={active ? colors.common.white : colors.brand.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <Text style={styles.methodSub}>{m.sub}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Test-mode notice & Privacy Policy link */}
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.status.info} />
          <Text style={styles.noticeText}>
            By proceeding, you agree to the{' '}
            <Text
              style={{ color: colors.brand.primary, fontFamily: fontFamily.bold, textDecorationLine: 'underline' }}
              onPress={() => setPrivacyModalVisible(true)}
            >
              Rental Agreement & Privacy Policy
            </Text>
            . Security deposit is 100% refundable upon vehicle inspection.
          </Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      {/* Sticky pay button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View>
          <Text style={styles.footerLbl}>Total payable</Text>
          <Text style={styles.footerVal}>{rupee(c.total)}</Text>
        </View>
        <Pressable
          style={[styles.payBtn, paying && { opacity: 0.7 }]}
          onPress={handlePay}
          disabled={paying}
        >
          {paying ? (
            <ActivityIndicator color={colors.common.white} />
          ) : (
            <>
              <Text style={styles.payBtnText}>Pay {rupee(c.total)}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.common.white} />
            </>
          )}
        </Pressable>
      </View>

      <PrivacyPolicyModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
      />
    </View>
  );
}

function Row({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, strong && styles.rowLabelStrong]}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  centre: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.sm,
    backgroundColor: colors.common.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.text.primary },
  headerSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  lockPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { padding: screenPadding, paddingBottom: 40 },

  bikeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.common.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.subtle,
  },
  bikeImgBox: {
    width: 76,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: colors.brand.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bikeImg: { width: '92%', height: '92%' },
  bikeName: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text.primary },
  bikeMeta: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  hubRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  hubText: { fontFamily: fontFamily.regular, fontSize: 11.5, color: colors.text.secondary, flex: 1 },

  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: colors.text.secondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.common.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    ...shadows.subtle,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowLabel: { fontFamily: fontFamily.medium, fontSize: 13.5, color: colors.text.primary },
  rowLabelStrong: { fontFamily: fontFamily.bold, fontSize: 15 },
  rowHint: { fontFamily: fontFamily.regular, fontSize: 10.5, color: colors.text.secondary, marginTop: 1 },
  rowValue: { fontFamily: fontFamily.semibold, fontSize: 13.5, color: colors.text.primary },
  rowValueStrong: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.brand.primary },
  divider: { height: 1, backgroundColor: colors.border },

  method: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 13 },
  methodBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconActive: { backgroundColor: colors.brand.primary },
  methodLabel: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.text.primary },
  methodSub: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.text.secondary, marginTop: 1 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.brand.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand.primary },

  noticeBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.status.infoTint,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  noticeText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.text.primary,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.status.error,
    marginTop: spacing.md,
    textAlign: 'center',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.common.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.soft,
  },
  footerLbl: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.text.secondary },
  footerVal: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.text.primary },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.pill,
    minWidth: 160,
    justifyContent: 'center',
  },
  payBtnText: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.common.white },
});
