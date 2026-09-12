import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { NeoSurface, ThemedModal } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'RentalRequest'>;

/**
 * Extend a rental, or book a slot to return the bike.
 *
 * Both used to mean phoning the hub. Neither takes effect on its own: the
 * request lands PENDING and staff decide, because an extension moves the
 * return date and the billing job invoices against it.
 */

interface RentalRequest {
  id: string;
  reference: string;
  type: 'EXTENSION' | 'RETURN';
  status: string;
  extraWeeks?: number | null;
  quotedAmount?: number | null;
  preferredSlotAt?: string | null;
  riderNote?: string | null;
  decisionNote?: string | null;
  createdAt: string;
  hub?: { name: string; address: string } | null;
}

interface ActiveRental {
  id: string;
  expectedReturnAt: string;
  weeklyRent?: number;
}

const WEEK_CHOICES = [1, 2, 4] as const;

/** Return slots riders actually use: next few days, morning or evening. */
function slotOptions(): { label: string; at: Date }[] {
  const out: { label: string; at: Date }[] = [];
  for (let day = 1; day <= 3; day += 1) {
    for (const hour of [10, 17]) {
      const at = new Date();
      at.setDate(at.getDate() + day);
      at.setHours(hour, 0, 0, 0);
      out.push({
        label: `${at.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
        })} · ${hour === 10 ? '10:00 AM' : '5:00 PM'}`,
        at,
      });
    }
  }
  return out;
}

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: colors.status.warningTint, fg: colors.status.warning },
  APPROVED: { bg: colors.status.successTint, fg: colors.status.success },
  REJECTED: { bg: colors.status.errorTint, fg: colors.status.error },
  CANCELLED: { bg: colors.neutral[100], fg: colors.neutral[500] },
  COMPLETED: { bg: colors.brand.mint, fg: colors.brand.dark },
};

export default function RentalRequestScreen({ navigation, route }: Props) {
  const [mode, setMode] = useState<'EXTENSION' | 'RETURN'>(route.params?.type ?? 'EXTENSION');
  const [weeks, setWeeks] = useState<number>(1);
  const [slot, setSlot] = useState<Date | null>(null);
  const [note, setNote] = useState('');

  const [rental, setRental] = useState<ActiveRental | null>(null);
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const slots = slotOptions();

  const load = useCallback(async () => {
    try {
      const [r, q] = await Promise.all([
        apiClient.get('/rental/rentals/active'),
        apiClient.get('/rental/requests'),
      ]);
      const active = r.data?.rental;
      setRental(
        active
          ? {
              id: active.id,
              expectedReturnAt: active.expectedReturnAt,
              weeklyRent: active.weeks?.[0]?.amount,
            }
          : null,
      );
      setRequests(q.data?.data ?? []);
      setError(null);
    } catch {
      setError('Could not load your rental. Pull back and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const submit = async () => {
    setError(null);

    if (mode === 'RETURN' && !slot) {
      setError('Pick a return slot first.');
      return;
    }

    setSubmitting(true);
    try {
      const payload =
        mode === 'EXTENSION'
          ? { type: 'EXTENSION', extraWeeks: weeks, riderNote: note.trim() || undefined }
          : {
              type: 'RETURN',
              preferredSlotAt: slot!.toISOString(),
              riderNote: note.trim() || undefined,
            };

      const res = await apiClient.post('/rental/requests', payload);
      setSuccess(res.data?.message ?? 'Request sent.');
      setNote('');
      setSlot(null);
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not send that request. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async (id: string) => {
    try {
      await apiClient.post(`/rental/requests/${id}/cancel`);
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not withdraw that request.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Extend or Return</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!rental ? (
          <View style={styles.empty}>
            <Ionicons name="bicycle-outline" size={32} color={colors.neutral[300]} />
            <Text style={styles.emptyTitle}>No bike on rent</Text>
            <Text style={styles.emptyHint}>
              Extensions and return slots apply to a live rental. Book a bike first.
            </Text>
            <Pressable style={styles.emptyBtn} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.emptyBtnText}>Browse bikes</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.dueCard}>
              <Ionicons name="calendar-outline" size={16} color={colors.brand.primary} />
              <Text style={styles.dueText}>
                Currently due back on{' '}
                <Text style={styles.dueStrong}>
                  {new Date(rental.expectedReturnAt).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  })}
                </Text>
              </Text>
            </View>

            {/* Mode switch */}
            <View style={styles.segmented}>
              {(['EXTENSION', 'RETURN'] as const).map((m) => {
                const on = mode === m;
                return (
                  <Pressable
                    key={m}
                    style={[styles.segment, on && styles.segmentOn]}
                    onPress={() => {
                      setMode(m);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Ionicons
                      name={m === 'EXTENSION' ? 'time-outline' : 'return-down-back-outline'}
                      size={15}
                      color={on ? colors.common.white : colors.text.secondary}
                    />
                    <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                      {m === 'EXTENSION' ? 'Keep it longer' : 'Return the bike'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.status.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <NeoSurface borderRadius={radius.lg} style={styles.formCard}>
              {mode === 'EXTENSION' ? (
                <>
                  <Text style={styles.label}>How much longer?</Text>
                  <View style={styles.chipRow}>
                    {WEEK_CHOICES.map((w) => {
                      const on = weeks === w;
                      return (
                        <Pressable
                          key={w}
                          style={[styles.chip, on && styles.chipOn]}
                          onPress={() => setWeeks(w)}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>
                            {w} {w === 1 ? 'week' : 'weeks'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {!!rental.weeklyRent && (
                    <View style={styles.quoteRow}>
                      <Text style={styles.quoteLabel}>Estimated extra rent</Text>
                      <Text style={styles.quoteValue}>{rupee(rental.weeklyRent * weeks)}</Text>
                    </View>
                  )}
                  <Text style={styles.hint}>
                    Billed as your usual weekly invoices once approved — nothing is charged now.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.label}>When will you drop it off?</Text>
                  <View style={styles.slotGrid}>
                    {slots.map((s) => {
                      const on = slot?.getTime() === s.at.getTime();
                      return (
                        <Pressable
                          key={s.at.toISOString()}
                          style={[styles.slot, on && styles.slotOn]}
                          onPress={() => setSlot(s.at)}
                        >
                          <Text style={[styles.slotText, on && styles.slotTextOn]}>
                            {s.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.hint}>
                    Bring the bike, its charger and the helmet to your pickup hub at the confirmed
                    time.
                  </Text>
                </>
              )}

              <Text style={[styles.label, { marginTop: spacing.md }]}>
                Anything we should know? (optional)
              </Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder={
                  mode === 'EXTENSION'
                    ? 'e.g. Work trip extended by a week'
                    : 'e.g. Slight scratch on the left panel'
                }
                placeholderTextColor={colors.text.secondary}
                multiline
                maxLength={500}
              />

              <Pressable
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={submit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.common.white} />
                ) : (
                  <Text style={styles.submitText}>
                    {mode === 'EXTENSION' ? 'Request extension' : 'Request return slot'}
                  </Text>
                )}
              </Pressable>
            </NeoSurface>
          </>
        )}

        {/* Past requests */}
        {requests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your requests</Text>

            {requests.map((r) => {
              const tone = STATUS_TONE[r.status] ?? STATUS_TONE.PENDING;
              return (
                <View key={r.id} style={styles.reqCard}>
                  <View style={styles.reqHead}>
                    <Text style={styles.reqRef}>{r.reference}</Text>
                    <View style={[styles.reqPill, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.reqPillText, { color: tone.fg }]}>{r.status}</Text>
                    </View>
                  </View>

                  <Text style={styles.reqBody}>
                    {r.type === 'EXTENSION'
                      ? `Extend by ${r.extraWeeks} week${r.extraWeeks === 1 ? '' : 's'}${
                          r.quotedAmount ? ` · ${rupee(r.quotedAmount)}` : ''
                        }`
                      : `Return on ${
                          r.preferredSlotAt
                            ? new Date(r.preferredSlotAt).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'
                        }`}
                  </Text>

                  {!!r.decisionNote && (
                    <View style={styles.decisionBox}>
                      <Ionicons
                        name="shield-checkmark"
                        size={12}
                        color={colors.brand.primary}
                      />
                      <Text style={styles.decisionText}>{r.decisionNote}</Text>
                    </View>
                  )}

                  {r.status === 'PENDING' && (
                    <Pressable style={styles.withdrawBtn} onPress={() => withdraw(r.id)}>
                      <Text style={styles.withdrawText}>Withdraw</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ThemedModal
        visible={!!success}
        title="Request sent"
        message={success ?? ''}
        icon="paper-plane-outline"
        confirmLabel="Done"
        onConfirm={() => setSuccess(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  centered: { alignItems: 'center', justifyContent: 'center' },

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
  headerTitle: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.text.primary },

  scroll: { padding: screenPadding, paddingBottom: spacing.xxl },

  dueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand.mintSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  dueText: { fontFamily: fontFamily.regular, fontSize: 12.5, color: colors.text.primary },
  dueStrong: { fontFamily: fontFamily.bold },

  segmented: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.card,
    ...shadows.subtle,
  },
  segmentOn: { backgroundColor: colors.brand.primary },
  segmentText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12.5,
    color: colors.text.secondary,
  },
  segmentTextOn: { color: colors.common.white },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.errorTint,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 12.5,
    color: colors.status.error,
  },

  formCard: {
    padding: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface.card,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },

  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.brand.mintStrong },
  chipText: { fontFamily: fontFamily.semibold, fontSize: 12.5, color: colors.text.secondary },
  chipTextOn: { color: colors.brand.dark },

  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quoteLabel: { fontFamily: fontFamily.medium, fontSize: 12.5, color: colors.text.secondary },
  quoteValue: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text.primary },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[50],
  },
  slotOn: { backgroundColor: colors.brand.mintStrong },
  slotText: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.text.secondary },
  slotTextOn: { fontFamily: fontFamily.bold, color: colors.brand.dark },

  noteInput: {
    minHeight: 72,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.text.primary,
    textAlignVertical: 'top',
  },

  submitBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitBtnDisabled: { backgroundColor: colors.state.disabledMid },
  submitText: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.common.white },

  section: { marginTop: spacing.lg },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  reqCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.subtle,
  },
  reqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reqRef: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.text.primary },
  reqPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  reqPillText: { fontFamily: fontFamily.bold, fontSize: 9.5 },
  reqBody: {
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    color: colors.text.secondary,
    marginTop: 4,
  },
  decisionBox: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: colors.brand.mintSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  decisionText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.primary,
  },
  withdrawBtn: { alignSelf: 'flex-start', marginTop: spacing.sm },
  withdrawText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: colors.status.error,
  },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  emptyHint: {
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.lg,
  },
  emptyBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    marginTop: spacing.md,
  },
  emptyBtnText: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.common.white },
});
