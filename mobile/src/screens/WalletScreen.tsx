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
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { NeoSurface, BottomNav, BOTTOM_NAV_HEIGHT } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'Wallet'>;

/**
 * Wallet — company-issued credit.
 *
 * There is deliberately no "Add money" button: riders cannot top this up.
 * Credit appears here when we owe it (a refund, a reversed damage charge, a
 * returned deposit) or grant it (promo, goodwill), and it is spent
 * automatically against the next weekly rent. The screen's job is to make
 * both of those facts obvious, so nobody goes looking for a top-up that
 * does not exist.
 */

interface WalletTransaction {
  id: string;
  direction: 'CREDIT' | 'DEBIT';
  reason: string;
  amount: number;
  balanceAfter: number;
  note?: string | null;
  createdAt: string;
}

interface WalletData {
  balance: number;
  lifetimeCredited: number;
  lifetimeSpent: number;
  transactions: WalletTransaction[];
  nextInvoice?: {
    id: string;
    weekNumber: number;
    amount: number;
    dueAt: string;
    status: string;
  } | null;
  appliedToNextInvoice: number;
}

const REASON_LABEL: Record<string, string> = {
  REFUND: 'Refund',
  DAMAGE_REVERSAL: 'Damage charge reversed',
  DEPOSIT_RETURN: 'Deposit returned',
  PROMO: 'Promo credit',
  GOODWILL: 'Goodwill credit',
  INVOICE_APPLIED: 'Used for weekly rent',
  ADJUSTMENT: 'Adjustment',
};

const REASON_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  REFUND: 'return-down-back',
  DAMAGE_REVERSAL: 'construct-outline',
  DEPOSIT_RETURN: 'shield-checkmark-outline',
  PROMO: 'gift-outline',
  GOODWILL: 'heart-outline',
  INVOICE_APPLIED: 'receipt-outline',
  ADJUSTMENT: 'swap-horizontal',
};

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export default function WalletScreen({ navigation }: Props) {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/rental/wallet');
      setData(res.data?.data ?? null);
      setError(null);
    } catch {
      setError('Could not load your wallet. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Wallet & Payments</Text>
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

          {/* Balance */}
          <NeoSurface borderRadius={radius.lg} style={styles.balanceCard}>
            <View style={styles.balanceIconHalo}>
              <Ionicons name="wallet" size={22} color={colors.brand.primary} />
            </View>
            <Text style={styles.balanceLabel}>Available credit</Text>
            <Text style={styles.balanceValue}>{rupee(data?.balance ?? 0)}</Text>

            {data?.nextInvoice && (data?.balance ?? 0) > 0 ? (
              <View style={styles.appliedRow}>
                <Ionicons name="arrow-forward-circle" size={14} color={colors.brand.primary} />
                <Text style={styles.appliedText}>
                  {rupee(data.appliedToNextInvoice)} comes off week {data.nextInvoice.weekNumber}{' '}
                  rent automatically
                </Text>
              </View>
            ) : (
              <Text style={styles.balanceHint}>
                Credit is applied to your next weekly rent automatically.
              </Text>
            )}
          </NeoSurface>

          {/* Why there is no top-up button. Saying it plainly beats a rider
              hunting for one and raising a ticket about it. */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.status.info} />
            <Text style={styles.infoText}>
              This wallet holds credit from Ride For You — refunds, returned deposits and offers.
              You don't need to add money: weekly rent is paid as usual and any credit is used
              first.
            </Text>
          </View>

          {/* Lifetime totals */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total received</Text>
              <Text style={[styles.statValue, { color: colors.status.success }]}>
                {rupee(data?.lifetimeCredited ?? 0)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total used</Text>
              <Text style={styles.statValue}>{rupee(data?.lifetimeSpent ?? 0)}</Text>
            </View>
          </View>

          {/* Ledger */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Credit history</Text>

            {!data?.transactions?.length ? (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={32} color={colors.neutral[300]} />
                <Text style={styles.emptyTitle}>No credit yet</Text>
                <Text style={styles.emptyHint}>
                  Refunds, returned deposits and offers will show up here.
                </Text>
              </View>
            ) : (
              <View style={styles.txList}>
                {data.transactions.map((t) => {
                  const isCredit = t.direction === 'CREDIT';
                  return (
                    <View key={t.id} style={styles.txRow}>
                      <View
                        style={[
                          styles.txIcon,
                          {
                            backgroundColor: isCredit
                              ? colors.status.successTint
                              : colors.neutral[100],
                          },
                        ]}
                      >
                        <Ionicons
                          name={REASON_ICON[t.reason] ?? 'ellipse-outline'}
                          size={16}
                          color={isCredit ? colors.status.success : colors.text.secondary}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.txTitle}>
                          {REASON_LABEL[t.reason] ?? t.reason}
                        </Text>
                        <Text style={styles.txMeta}>
                          {formatDate(t.createdAt)}
                          {t.note ? ` · ${t.note}` : ''}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text
                          style={[
                            styles.txAmount,
                            { color: isCredit ? colors.status.success : colors.text.primary },
                          ]}
                        >
                          {isCredit ? '+' : '−'}
                          {rupee(t.amount)}
                        </Text>
                        <Text style={styles.txBalance}>{rupee(t.balanceAfter)} left</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Where the actual bills live */}
          <Pressable style={styles.linkCard} onPress={() => navigation.navigate('MyRental')}>
            <View style={styles.linkIconHalo}>
              <Ionicons name="document-text-outline" size={18} color={colors.brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Weekly rent & invoices</Text>
              <Text style={styles.linkSub}>See what's due and pay it</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
          </Pressable>
        </ScrollView>
      )}

      <BottomNav active="wallet" />
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
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
  },

  scroll: {
    padding: screenPadding,
    paddingBottom: BOTTOM_NAV_HEIGHT + spacing.xl,
  },

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

  balanceCard: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface.card,
  },
  balanceIconHalo: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  balanceLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 12.5,
    color: colors.text.secondary,
  },
  balanceValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: 34,
    color: colors.text.primary,
    marginTop: 2,
  },
  balanceHint: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand.mintSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    marginTop: spacing.sm,
  },
  appliedText: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 11.5,
    color: colors.brand.dark,
  },

  infoBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.status.infoTint,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  infoText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.primary,
  },

  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.subtle,
  },
  statLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.text.secondary,
  },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: colors.text.primary,
    marginTop: 2,
  },

  section: { marginTop: spacing.lg },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
  },
  emptyTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 13.5,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  emptyHint: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: spacing.lg,
  },

  txList: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text.primary,
  },
  txMeta: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  txAmount: { fontFamily: fontFamily.bold, fontSize: 14 },
  txBalance: {
    fontFamily: fontFamily.regular,
    fontSize: 10.5,
    color: colors.text.secondary,
  },

  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    ...shadows.subtle,
  },
  linkIconHalo: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 13.5,
    color: colors.text.primary,
  },
  linkSub: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
  },
});
