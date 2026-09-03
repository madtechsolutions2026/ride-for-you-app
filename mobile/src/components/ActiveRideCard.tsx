/**
 * ActiveRideCard.tsx
 * ------------------
 * The Home screen's most important surface once a rider is on a bike: which
 * bike, how long is left, and — the bit that was missing entirely — what they
 * owe next and a single tap to settle it.
 *
 * Renders nothing when there is no live rental, so Home can mount it
 * unconditionally.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { images } from '../assets';

export type ActiveRental = {
  id: string;
  status: string;
  isOverdue: boolean;
  bike: {
    registrationNumber: string;
    modelName: string | null;
    batteryPercent: number | null;
    imageUrl: string | null;
  } | null;
  hub: { name: string } | null;
  daysRemaining: number | null;
  weeks: { id: string; weekNumber: number; status: string }[];
  summary: {
    outstanding: number;
    nextDue: {
      invoiceId: string;
      weekNumber: number;
      amount: number;
      daysUntilDue: number;
      status: string;
    } | null;
  };
};

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

/** Turn the invoice's day offset into something a person would actually say. */
function dueLabel(days: number, status: string): string {
  if (status === 'OVERDUE' || days < 0) {
    const late = Math.abs(days);
    return late <= 1 ? 'Overdue since yesterday' : `Overdue by ${late} days`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

type Props = {
  rental: ActiveRental | null;
  onPay: (invoiceId: string) => void;
  onOpen: () => void;
};

export function ActiveRideCard({ rental, onPay, onOpen }: Props) {
  if (!rental) return null;

  const next = rental.summary.nextDue;
  const late = rental.isOverdue;
  const returned = rental.status === 'RETURNED';

  const accent = returned ? colors.status.info : late ? colors.status.error : colors.brand.primary;
  const tint = returned
    ? colors.status.infoTint
    : late
    ? colors.status.errorTint
    : colors.brand.mint;

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      {/* status strip */}
      <View style={[styles.strip, { backgroundColor: tint }]}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={[styles.stripText, { color: accent }]}>
          {returned
            ? 'Returned — settling up'
            : late
            ? 'Payment overdue'
            : 'Your ride is active'}
        </Text>
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={14} color={accent} />
      </View>

      <View style={styles.body}>
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
          <Text style={styles.plate}>{rental.bike?.registrationNumber || '—'}</Text>

          <View style={styles.metaRow}>
            {rental.daysRemaining != null && !returned && (
              <View style={styles.meta}>
                <Ionicons name="time-outline" size={12} color={colors.text.secondary} />
                <Text style={styles.metaText}>
                  {rental.daysRemaining >= 0
                    ? `${rental.daysRemaining}d left`
                    : `${Math.abs(rental.daysRemaining)}d over`}
                </Text>
              </View>
            )}
            {rental.bike?.batteryPercent != null && (
              <View style={styles.meta}>
                <Ionicons name="battery-half-outline" size={12} color={colors.text.secondary} />
                <Text style={styles.metaText}>{rental.bike.batteryPercent}%</Text>
              </View>
            )}
            <View style={styles.meta}>
              <Ionicons name="calendar-outline" size={12} color={colors.text.secondary} />
              <Text style={styles.metaText}>Week {rental.weeks.length}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* the money row — the whole reason this card exists */}
      {next ? (
        <View style={styles.payRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.payLabel}>
              Week {next.weekNumber} rent · {dueLabel(next.daysUntilDue, next.status)}
            </Text>
            <Text style={[styles.payAmount, late && { color: colors.status.error }]}>
              {rupee(next.amount)}
            </Text>
          </View>
          <Pressable
            style={[styles.payBtn, { backgroundColor: accent }]}
            onPress={() => onPay(next.invoiceId)}
            hitSlop={6}
          >
            <Text style={styles.payBtnText}>Pay now</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.payRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.brand.primary} />
          <Text style={styles.settled}>All rent paid — nothing due right now</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: screenPadding,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.card,
    overflow: 'hidden',
    ...shadows.card,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  stripText: { fontFamily: fontFamily.bold, fontSize: 11.5 },

  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  thumb: {
    width: 64,
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
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontFamily: fontFamily.medium, fontSize: 11, color: colors.text.secondary },

  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.neutral[50],
  },
  payLabel: { fontFamily: fontFamily.regular, fontSize: 10.5, color: colors.text.secondary },
  payAmount: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: colors.text.primary,
    marginTop: 1,
  },
  payBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  payBtnText: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.common.white },
  settled: { fontFamily: fontFamily.medium, fontSize: 12.5, color: colors.text.secondary },
});
