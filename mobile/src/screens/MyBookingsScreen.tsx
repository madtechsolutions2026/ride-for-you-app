import React, { useCallback, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { ThemedModal } from '../components';
import { apiClient } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'MyBookings'>;

type Booking = {
  id: string;
  reference: string;
  status: string;
  createdAt: string;
  model: { name: string; category: string } | null;
  plan: { duration: string } | null;
  hub: { name: string; address: string } | null;
  charges: { total: number };
  amountPaid: number;
  rental: { status: string; expectedReturnAt: string | null; bikeRegistration: string | null } | null;
};

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const planLabel = (d?: string) =>
  d === 'WEEK' ? 'Weekly' : d === 'MONTH' ? 'Monthly' : d === 'DAY' ? 'Daily' : d || '';
const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING: { label: 'Payment pending', bg: colors.status.warningTint, fg: colors.status.warning },
  CONFIRMED: { label: 'Confirmed', bg: colors.brand.mint, fg: colors.brand.primary },
  READY: { label: 'Ready for pickup', bg: colors.brand.mint, fg: colors.brand.primary },
  HANDED_OVER: { label: 'Bike with you', bg: colors.status.infoTint, fg: colors.status.info },
  CANCELLED: { label: 'Cancelled', bg: colors.neutral[100], fg: colors.neutral[500] },
  EXPIRED: { label: 'Expired', bg: colors.neutral[100], fg: colors.neutral[500] },
};

export default function MyBookingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await apiClient.get('/rental/bookings');
      setBookings(res.data.bookings || []);
    } catch {
      // keep whatever we have
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setWorking(true);
    try {
      await apiClient.post(`/rental/bookings/${cancelTarget.id}/cancel`);
      setCancelTarget(null);
      await load();
    } catch (e: any) {
      setCancelTarget(null);
    } finally {
      setWorking(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brand.primary} size="large" />
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.centre}>
          <View style={styles.emptyIcon}>
            <Ionicons name="receipt-outline" size={30} color={colors.brand.primary} />
          </View>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptyText}>
            Pick a hub and a bike to make your first booking.
          </Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
          >
            <Text style={styles.emptyBtnText}>Browse bikes</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand.primary} />
          }
        >
          {bookings.map((b) => {
            const meta = STATUS_META[b.status] || {
              label: b.status,
              bg: colors.neutral[100],
              fg: colors.neutral[500],
            };
            const dim = b.status === 'CANCELLED' || b.status === 'EXPIRED';
            return (
              <View key={b.id} style={[styles.card, dim && { opacity: 0.65 }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bikeName} numberOfLines={1}>
                      {b.model?.name || 'EV Bike'}
                    </Text>
                    <Text style={styles.ref}>
                      {b.reference} · {fmtDate(b.createdAt)}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Meta icon="pricetag-outline" text={`${planLabel(b.plan?.duration)} plan`} />
                  {b.hub && <Meta icon="location-outline" text={b.hub.name} />}
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardBottom}>
                  <View>
                    <Text style={styles.amountLbl}>
                      {b.status === 'PENDING' ? 'Payable' : 'Paid'}
                    </Text>
                    <Text style={styles.amountVal}>
                      {rupee(b.status === 'PENDING' ? b.charges.total : b.amountPaid || b.charges.total)}
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    {b.status === 'PENDING' && (
                      <>
                        <Pressable
                          style={styles.ghostAction}
                          onPress={() => setCancelTarget(b)}
                        >
                          <Text style={styles.ghostActionText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          style={styles.primaryAction}
                          onPress={() => navigation.navigate('BookingPayment', { bookingId: b.id })}
                        >
                          <Text style={styles.primaryActionText}>Pay now</Text>
                        </Pressable>
                      </>
                    )}

                    {(b.status === 'CONFIRMED' || b.status === 'READY') && (
                      <>
                        <Pressable style={styles.ghostAction} onPress={() => setCancelTarget(b)}>
                          <Text style={styles.ghostActionText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          style={styles.primaryAction}
                          onPress={() => navigation.navigate('BookingConfirmed', { bookingId: b.id })}
                        >
                          <Text style={styles.primaryActionText}>Details</Text>
                        </Pressable>
                      </>
                    )}

                    {b.status === 'HANDED_OVER' && (
                      <Pressable
                        style={styles.primaryAction}
                        onPress={() => navigation.navigate('BookingConfirmed', { bookingId: b.id })}
                      >
                        <Text style={styles.primaryActionText}>Details</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {b.status === 'HANDED_OVER' && b.rental?.expectedReturnAt && (
                  <View style={styles.rideStrip}>
                    <Ionicons name="bicycle" size={13} color={colors.status.info} />
                    <Text style={styles.rideStripText}>
                      {b.rental.bikeRegistration ? `${b.rental.bikeRegistration} · ` : ''}
                      due back {fmtDate(b.rental.expectedReturnAt)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <ThemedModal
        visible={Boolean(cancelTarget)}
        title="Cancel this booking?"
        message={
          cancelTarget?.status === 'CONFIRMED'
            ? 'Your booking will be cancelled. Refunds for paid amounts are handled by support.'
            : 'This booking will be removed. You can make a new one anytime.'
        }
        icon="close-circle-outline"
        isDestructive
        confirmLabel={working ? 'Cancelling…' : 'Cancel booking'}
        cancelLabel="Keep it"
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </View>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={12} color={colors.text.secondary} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },

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

  scroll: { padding: screenPadding, paddingBottom: 40 },

  card: {
    backgroundColor: colors.common.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bikeName: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text.primary },
  ref: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.text.secondary, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  statusText: { fontFamily: fontFamily.bold, fontSize: 10.5 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '60%' },
  metaText: { fontFamily: fontFamily.medium, fontSize: 11.5, color: colors.text.secondary },

  cardDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountLbl: { fontFamily: fontFamily.regular, fontSize: 10.5, color: colors.text.secondary },
  amountVal: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.text.primary, marginTop: 1 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ghostAction: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  ghostActionText: { fontFamily: fontFamily.semibold, fontSize: 12.5, color: colors.text.secondary },
  primaryAction: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
  },
  primaryActionText: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.common.white },

  rideStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.status.infoTint,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: spacing.sm,
  },
  rideStripText: { fontFamily: fontFamily.medium, fontSize: 11, color: colors.status.info },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text.primary },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  emptyBtnText: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.common.white },
});
