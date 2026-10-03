import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { apiClient } from '../api/client';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';

/**
 * Pay this week's rent — QR, UPI link, or in-app.
 *
 * The midnight notice promises a QR, so this is where that promise is kept.
 * Three routes to the same rupee, in the order riders actually use them:
 *
 *   1. Scan the QR from another phone, or long-press to save it.
 *   2. Tap to open a UPI app on this phone with the amount pre-filled.
 *   3. Pay in-app, which is the only one we can confirm instantly.
 *
 * UPI intent has no callback, so a QR or link payment is NOT auto-confirmed —
 * the sheet says so rather than leaving the rider to wonder why their invoice
 * is still marked unpaid five minutes later.
 */

interface PaymentHandles {
  invoiceId: string;
  weekNumber: number;
  amount: number;
  upiUri: string | null;
  qrDataUri: string;
  qrAvailable: boolean;
  graceEndsAt: string | null;
  hoursUntilCollection: number | null;
  inRecovery: boolean;
}

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

/** The base64 SVG the backend returns, decoded for react-native-svg. */
function decodeSvg(dataUri: string): string | null {
  const marker = 'base64,';
  const at = dataUri.indexOf(marker);
  if (at < 0) return null;
  try {
    // atob exists in Hermes; Buffer does not.
    return global.atob(dataUri.slice(at + marker.length));
  } catch {
    return null;
  }
}

export const RentPaymentSheet: React.FC<{
  visible: boolean;
  invoiceId: string | null;
  onClose: () => void;
  /** Pay through the app instead — the only instantly-confirmed route. */
  onPayInApp: () => void;
  paying?: boolean;
}> = ({ visible, invoiceId, onClose, onPayInApp, paying }) => {
  const [data, setData] = useState<PaymentHandles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/rental/invoices/${invoiceId}/payment`);
      setData(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not load payment details.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const openUpiApp = async () => {
    if (!data?.upiUri) return;
    const ok = await Linking.canOpenURL(data.upiUri).catch(() => false);
    if (!ok) {
      setError('No UPI app found on this phone. Scan the QR from another device instead.');
      return;
    }
    void Linking.openURL(data.upiUri);
  };

  const copyUpi = async () => {
    if (!data?.upiUri) return;
    await Clipboard.setStringAsync(data.upiUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const svg = data?.qrDataUri ? decodeSvg(data.qrDataUri) : null;
  const hours = data?.hoursUntilCollection ?? null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.title}>
              {data ? `Week ${data.weekNumber} rent` : 'Pay rent'}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.brand.primary} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              {!!data && <Text style={styles.amount}>{rupee(data.amount)}</Text>}

              {/* Where the rider stands, in hours rather than jargon. */}
              {data?.inRecovery ? (
                <View style={[styles.banner, styles.bannerDanger]}>
                  <Ionicons name="alert-circle" size={16} color={colors.status.error} />
                  <Text style={styles.bannerDangerText}>
                    Your bike is scheduled for collection. Pay now, then call support to stop it.
                  </Text>
                </View>
              ) : hours !== null && hours > 0 && hours <= 48 ? (
                <View style={[styles.banner, styles.bannerWarn]}>
                  <Ionicons name="time-outline" size={16} color={colors.status.warning} />
                  <Text style={styles.bannerWarnText}>
                    {hours <= 24
                      ? `${hours}h left before your bike is collected.`
                      : `Pay within ${hours}h to avoid collection.`}
                  </Text>
                </View>
              ) : null}

              {error && (
                <View style={[styles.banner, styles.bannerDanger]}>
                  <Ionicons name="warning-outline" size={16} color={colors.status.error} />
                  <Text style={styles.bannerDangerText}>{error}</Text>
                </View>
              )}

              {/* 1. The QR */}
              {data?.qrAvailable && svg ? (
                <View style={styles.qrCard}>
                  <SvgXml xml={svg} width={200} height={200} />
                  <Text style={styles.qrHint}>
                    Scan with any UPI app — GPay, PhonePe, Paytm or your bank
                  </Text>
                </View>
              ) : data && !data.qrAvailable ? (
                <View style={styles.qrMissing}>
                  <Ionicons name="qr-code-outline" size={26} color={colors.neutral[400]} />
                  <Text style={styles.qrMissingText}>
                    QR payments aren’t set up yet. Use “Pay in the app” below.
                  </Text>
                </View>
              ) : null}

              {/* 2. The link */}
              {data?.qrAvailable && (
                <>
                  <Pressable style={styles.upiBtn} onPress={openUpiApp}>
                    <Ionicons name="open-outline" size={17} color={colors.brand.dark} />
                    <Text style={styles.upiBtnText}>Open my UPI app</Text>
                  </Pressable>

                  <Pressable style={styles.copyRow} onPress={copyUpi} hitSlop={6}>
                    <Ionicons
                      name={copied ? 'checkmark-circle' : 'copy-outline'}
                      size={14}
                      color={copied ? colors.status.success : colors.text.secondary}
                    />
                    <Text style={styles.copyText}>
                      {copied ? 'Payment link copied' : 'Copy payment link'}
                    </Text>
                  </Pressable>

                  <View style={styles.noteRow}>
                    <Ionicons
                      name="information-circle-outline"
                      size={14}
                      color={colors.text.secondary}
                    />
                    <Text style={styles.noteText}>
                      UPI payments can take a few minutes to show here. Paying in the app updates
                      instantly.
                    </Text>
                  </View>

                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </>
              )}

              {/* 3. In-app */}
              <Pressable
                style={[styles.payBtn, paying && styles.payBtnDisabled]}
                onPress={onPayInApp}
                disabled={paying}
              >
                {paying ? (
                  <ActivityIndicator size="small" color={colors.common.white} />
                ) : (
                  <Text style={styles.payBtnText}>
                    Pay {data ? rupee(data.amount) : ''} in the app
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    maxHeight: '90%',
    paddingBottom: spacing.lg,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text.primary },
  centered: { paddingVertical: spacing.xxl, alignItems: 'center' },
  scroll: { paddingHorizontal: screenPadding, paddingBottom: spacing.md },

  amount: {
    fontFamily: fontFamily.extrabold,
    fontSize: 32,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerWarn: { backgroundColor: colors.status.warningTint },
  bannerWarnText: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 12.5,
    color: colors.status.warning,
  },
  bannerDanger: { backgroundColor: colors.status.errorTint },
  bannerDangerText: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 12.5,
    color: colors.status.error,
  },

  qrCard: {
    alignItems: 'center',
    backgroundColor: colors.common.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    ...shadows.subtle,
  },
  qrHint: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  qrMissing: {
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  qrMissingText: {
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  upiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand.mintSoft,
    borderRadius: radius.pill,
    paddingVertical: 13,
    marginTop: spacing.md,
  },
  upiBtnText: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.brand.dark },

  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  copyText: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.text.secondary },

  noteRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  noteText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.text.secondary,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fontFamily.medium, fontSize: 11, color: colors.text.secondary },

  payBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  payBtnDisabled: { backgroundColor: colors.state.disabledMid },
  payBtnText: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.common.white },
});
