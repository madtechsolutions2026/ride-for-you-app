import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { apiClient } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingConfirmed'>;

type Booking = {
  reference: string;
  status: string;
  model: { name: string; category: string } | null;
  plan: { duration: string } | null;
  hub: {
    name: string;
    address: string;
    contactPhone: string | null;
    operatingHours: string | null;
  } | null;
  charges: { rent: number; deposit: number; platformFee: number; total: number };
  amountPaid: number;
  payments: { id: string; purpose: string; amount: number; provider: string }[];
};

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const planLabel = (d?: string) =>
  d === 'WEEK' ? 'Weekly' : d === 'MONTH' ? 'Monthly' : d === 'DAY' ? 'Daily' : d || '';
const purposeLabel = (p: string) =>
  ({ RENT: 'Rental', DEPOSIT: 'Deposit', PLATFORM_FEE: 'Platform fee' } as Record<string, string>)[p] ||
  p;

const NEXT_STEPS = [
  { icon: 'time-outline' as const, text: 'Our team verifies your booking — usually within a few minutes.' },
  { icon: 'navigate-outline' as const, text: 'Head to the pickup hub during operating hours.' },
  { icon: 'card-outline' as const, text: 'Carry your original Driving Licence and the ID used for KYC.' },
  { icon: 'bicycle-outline' as const, text: 'Staff assigns a bike, checks the helmet and hands over the keys.' },
];

export default function BookingConfirmedScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    apiClient
      .get(`/rental/bookings/${bookingId}`)
      .then((res) => setBooking(res.data.booking))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    if (!loading) {
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5, tension: 80 }).start();
    }
  }, [loading]);

  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  const goBookings = () =>
    navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'MyBookings' }] });

  if (loading) {
    return (
      <View style={[styles.root, styles.centre]}>
        <ActivityIndicator color={colors.brand.primary} size="large" />
      </View>
    );
  }

  const c = booking?.charges;
  const paid = booking?.amountPaid ?? c?.total ?? 0;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Success badge */}
        <Animated.View
          style={[
            styles.badgeOuter,
            { transform: [{ scale: pop }], opacity: pop },
          ]}
        >
          <View style={styles.badgeInner}>
            <Ionicons name="checkmark-sharp" size={44} color={colors.common.white} />
          </View>
        </Animated.View>

        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>
          {booking?.reference ? (
            <>
              Reference <Text style={styles.ref}>{booking.reference}</Text>
            </>
          ) : (
            'Your booking is confirmed.'
          )}
        </Text>

        {/* Paid card */}
        <View style={styles.card}>
          <View style={styles.paidHeader}>
            <View>
              <Text style={styles.paidLbl}>Amount paid</Text>
              <Text style={styles.paidVal}>{rupee(paid)}</Text>
            </View>
            <View style={styles.paidChip}>
              <Ionicons name="checkmark-circle" size={13} color={colors.status.success} />
              <Text style={styles.paidChipText}>Paid</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {(booking?.payments || []).map((p) => (
            <View key={p.id} style={styles.miniRow}>
              <Text style={styles.miniLabel}>{purposeLabel(p.purpose)}</Text>
              <Text style={styles.miniValue}>{rupee(p.amount)}</Text>
            </View>
          ))}
          {c && (
            <View style={styles.miniRow}>
              <Text style={styles.miniLabelMuted}>
                Deposit {rupee(c.deposit)} is refunded after you return the bike
              </Text>
            </View>
          )}
        </View>

        {/* Pickup card */}
        {booking?.hub && (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Pickup details</Text>
            <InfoLine icon="bicycle-outline" label={booking.model?.name || 'EV Bike'} sub={`${planLabel(booking.plan?.duration)} plan`} />
            <InfoLine icon="business-outline" label={booking.hub.name} sub={booking.hub.address} />
            {booking.hub.operatingHours && (
              <InfoLine icon="time-outline" label="Operating hours" sub={booking.hub.operatingHours} />
            )}
            {booking.hub.contactPhone && (
              <InfoLine icon="call-outline" label="Hub contact" sub={booking.hub.contactPhone} />
            )}
          </View>
        )}

        {/* Next steps */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>What happens next</Text>
          {NEXT_STEPS.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Ionicons name={s.icon} size={15} color={colors.brand.primary} />
              </View>
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable style={styles.primaryBtn} onPress={goBookings}>
          <Text style={styles.primaryBtnText}>View My Bookings</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={goHome}>
          <Text style={styles.ghostBtnText}>Back to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoLine({
  icon,
  label,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
}) {
  return (
    <View style={styles.infoLine}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={15} color={colors.brand.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        {sub ? <Text style={styles.infoSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  centre: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: screenPadding, paddingBottom: 40, alignItems: 'stretch' },

  badgeOuter: {
    alignSelf: 'center',
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  badgeInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: 24,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13.5,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  ref: { fontFamily: fontFamily.bold, color: colors.brand.primary },

  card: {
    backgroundColor: colors.common.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  cardHeading: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  paidHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paidLbl: { fontFamily: fontFamily.regular, fontSize: 11.5, color: colors.text.secondary },
  paidVal: { fontFamily: fontFamily.extrabold, fontSize: 22, color: colors.text.primary, marginTop: 1 },
  paidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand.mint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  paidChipText: { fontFamily: fontFamily.bold, fontSize: 11, color: colors.status.success },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  miniRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  miniLabel: { fontFamily: fontFamily.regular, fontSize: 12.5, color: colors.text.secondary },
  miniLabelMuted: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  miniValue: { fontFamily: fontFamily.semibold, fontSize: 12.5, color: colors.text.primary },

  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 6 },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.brand.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.text.primary },
  infoSub: { fontFamily: fontFamily.regular, fontSize: 11.5, color: colors.text.secondary, marginTop: 1 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 6 },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.text.primary,
    paddingTop: 4,
  },

  footer: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.common.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    ...shadows.soft,
  },
  primaryBtn: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 15,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.common.white },
  ghostBtn: { paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  ghostBtnText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.text.secondary },
});
