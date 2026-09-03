import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { images } from '../assets';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { ThemedModal } from '../components';
import { apiClient } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'MyRental'>;

type Week = {
  id: string;
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';
  dueAt: string;
  paidAt: string | null;
  daysUntilDue: number;
  payable: boolean;
};

type Rental = {
  id: string;
  status: string;
  isOverdue: boolean;
  reference: string | null;
  plan: string | null;
  bike: {
    registrationNumber: string;
    modelName: string | null;
    batteryPercent: number | null;
    imageUrl: string | null;
  } | null;
  hub: { name: string; address: string; contactPhone: string | null } | null;
  handoverAt: string;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  daysRemaining: number | null;
  weeks: Week[];
  summary: {
    weeksBilled: number;
    totalBilled: number;
    totalPaid: number;
    outstanding: number;
    depositHeld: number;
  };
  damage: { id: string; severity: string; description: string; estimatedCost: number }[];
};

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const shortDate = (v: string) =>
  new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Day offsets read as English, not as "Due in 1 days". */
function dueLabel(days: number): string {
  if (days < 0) {
    const late = Math.abs(days);
    return late === 1 ? '1 day late' : `${late} days late`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

const WEEK_TONE: Record<Week['status'], { bg: string; fg: string; label: string }> = {
  PAID: { bg: colors.brand.mint, fg: colors.status.success, label: 'Paid' },
  PENDING: { bg: colors.status.warningTint, fg: colors.status.warning, label: 'Due' },
  OVERDUE: { bg: colors.status.errorTint, fg: colors.status.error, label: 'Overdue' },
  WAIVED: { bg: colors.neutral[100], fg: colors.neutral[500], label: 'Waived' },
};

export default function MyRentalScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const focusInvoiceId = route.params?.payInvoiceId;

  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payTarget, setPayTarget] = useState<Week | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const res = await apiClient.get('/rental/rentals/active');
        const r: Rental | null = res.data.rental;
        setRental(r);
        // Deep-linked from the Home card's Pay button — open that week directly.
        if (focusInvoiceId && r) {
          const w = r.weeks.find((x) => x.id === focusInvoiceId);
          if (w?.payable) setPayTarget(w);
        }
      } catch {
        // keep whatever is on screen
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [focusInvoiceId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmPay = async () => {
    if (!payTarget) return;
    setPaying(true);
    try {
      const res = await apiClient.post(`/rental/invoices/${payTarget.id}/pay`, { method: 'UPI' });
      setRental(res.data.rental);
      setPayTarget(null);
      Alert.alert('Payment successful', res.data.message || 'Rent paid.');
    } catch (e: any) {
      setPayTarget(null);
      Alert.alert('Payment failed', e?.response?.data?.error || 'Please try again.');
    } finally {
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

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Rental</Text>
      </View>

      {!rental ? (
        <View style={styles.centre}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bicycle-outline" size={30} color={colors.brand.primary} />
          </View>
          <Text style={styles.emptyTitle}>No active rental</Text>
          <Text style={styles.emptyText}>
            Once a bike is handed over to you at the hub, your weekly rent shows up here.
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
          contentContainerStyle={{ padding: screenPadding, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.brand.primary}
            />
          }
        >
          {/* --- the bike --- */}
          <View style={styles.bikeCard}>
            <View style={styles.thumb}>
              <Image
                source={rental.bike?.imageUrl ? { uri: rental.bike.imageUrl } : images.heroScooter}
                style={styles.thumbImg}
                contentFit="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.model} numberOfLines={1}>
                {rental.bike?.modelName || 'Your bike'}
              </Text>
              <Text style={styles.plate}>{rental.bike?.registrationNumber}</Text>
              {rental.hub && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={12} color={colors.text.secondary} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {rental.hub.name}
                  </Text>
                </View>
              )}
            </View>
            <View
              style={[
                styles.statePill,
                { backgroundColor: rental.isOverdue ? colors.status.errorTint : colors.brand.mint },
              ]}
            >
              <Text
                style={[
                  styles.statePillText,
                  { color: rental.isOverdue ? colors.status.error : colors.brand.primary },
                ]}
              >
                {rental.isOverdue ? 'OVERDUE' : rental.status}
              </Text>
            </View>
          </View>

          {/* --- money summary --- */}
          <View style={styles.sumCard}>
            <View style={styles.sumRow}>
              <Sum label="Billed" value={rupee(rental.summary.totalBilled)} />
              <View style={styles.sumDiv} />
              <Sum label="Paid" value={rupee(rental.summary.totalPaid)} tone={colors.status.success} />
              <View style={styles.sumDiv} />
              <Sum
                label="Outstanding"
                value={rupee(rental.summary.outstanding)}
                tone={rental.summary.outstanding > 0 ? colors.status.error : colors.text.primary}
              />
            </View>
            {rental.summary.depositHeld > 0 && (
              <Text style={styles.depositNote}>
                {rupee(rental.summary.depositHeld)} deposit held — refunded when you return the bike.
              </Text>
            )}
          </View>

          {/* --- damage, if any is pending --- */}
          {rental.damage.length > 0 && (
            <View style={styles.damageCard}>
              <Ionicons name="alert-circle" size={16} color={colors.status.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.damageTitle}>Damage under review</Text>
                {rental.damage.map((d) => (
                  <Text key={d.id} style={styles.damageText}>
                    {d.severity} · {d.description} · est. {rupee(d.estimatedCost)}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* --- week by week --- */}
          <Text style={styles.sectionLabel}>Weekly rent</Text>
          <View style={styles.weeksCard}>
            {rental.weeks.map((w, i) => {
              const tone = WEEK_TONE[w.status];
              return (
                <View
                  key={w.id}
                  style={[styles.week, i < rental.weeks.length - 1 && styles.weekBorder]}
                >
                  <View style={[styles.weekNum, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.weekNumText, { color: tone.fg }]}>{w.weekNumber}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.weekPeriod}>
                      {shortDate(w.periodStart)} – {shortDate(w.periodEnd)}
                    </Text>
                    <Text style={styles.weekSub}>
                      {w.status === 'PAID' && w.paidAt
                        ? `Paid ${shortDate(w.paidAt)}`
                        : w.status === 'WAIVED'
                        ? 'Waived by support'
                        : dueLabel(w.daysUntilDue)}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={styles.weekAmount}>{rupee(w.amount)}</Text>
                    {w.payable ? (
                      <Pressable style={styles.weekPay} onPress={() => setPayTarget(w)}>
                        <Text style={styles.weekPayText}>Pay</Text>
                      </Pressable>
                    ) : (
                      <View style={[styles.weekTag, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.weekTagText, { color: tone.fg }]}>{tone.label}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.footnote}>
            Rent is billed every week for as long as you keep the bike. Return it at{' '}
            {rental.hub?.name || 'the hub'} to stop billing and get your deposit back.
          </Text>
        </ScrollView>
      )}

      <ThemedModal
        visible={Boolean(payTarget)}
        title={`Pay week ${payTarget?.weekNumber ?? ''} rent`}
        message={
          payTarget
            ? `${rupee(payTarget.amount)} for ${shortDate(payTarget.periodStart)} – ${shortDate(
                payTarget.periodEnd
              )}.\n\nTest checkout — no money is charged.`
            : ''
        }
        icon="wallet-outline"
        confirmLabel={paying ? 'Paying…' : `Pay ${rupee(payTarget?.amount ?? 0)}`}
        cancelLabel="Not now"
        onConfirm={confirmPay}
        onCancel={() => !paying && setPayTarget(null)}
      />
    </View>
  );
}

function Sum({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.sum}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={[styles.sumValue, tone ? { color: tone } : null]}>{value}</Text>
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

  bikeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.common.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.subtle,
  },
  thumb: {
    width: 62,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.brand.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '90%', height: '90%' },
  model: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text.primary },
  plate: {
    fontFamily: fontFamily.semibold,
    fontSize: 11.5,
    color: colors.text.secondary,
    letterSpacing: 0.6,
    marginTop: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  metaText: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.text.secondary, flex: 1 },
  statePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  statePillText: { fontFamily: fontFamily.bold, fontSize: 9.5, letterSpacing: 0.4 },

  sumCard: {
    backgroundColor: colors.common.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.subtle,
  },
  sumRow: { flexDirection: 'row', alignItems: 'stretch' },
  sum: { flex: 1, alignItems: 'center' },
  sumDiv: { width: 1, backgroundColor: colors.border },
  sumLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sumValue: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text.primary, marginTop: 3 },
  depositNote: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    textAlign: 'center',
  },

  damageCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.status.warningTint,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginTop: spacing.md,
  },
  damageTitle: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.text.primary },
  damageText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },

  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: colors.text.secondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  weeksCard: {
    backgroundColor: colors.common.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    ...shadows.subtle,
  },
  week: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 13 },
  weekBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  weekNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNumText: { fontFamily: fontFamily.bold, fontSize: 13 },
  weekPeriod: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.text.primary },
  weekSub: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.text.secondary, marginTop: 1 },
  weekAmount: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.text.primary },
  weekPay: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
  },
  weekPayText: { fontFamily: fontFamily.bold, fontSize: 11.5, color: colors.common.white },
  weekTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  weekTagText: { fontFamily: fontFamily.bold, fontSize: 10 },

  footnote: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },

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
    lineHeight: 19,
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
