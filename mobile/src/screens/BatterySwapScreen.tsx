import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { NeoSurface, ThemedModal } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'BatterySwap'>;

/**
 * Battery swap by QR.
 *
 * The in-app FAQ has always told riders to "scan the QR code" at a dock — this
 * is the screen that makes that true. The camera stays mounted only while the
 * screen is focused and only until a code is accepted, so it is not quietly
 * running in the background.
 */

interface Swap {
  id: string;
  reference: string;
  batteryOutPercent: number;
  batteryInPercent: number;
  createdAt: string;
  station?: { name: string; address: string } | null;
  hub?: { name: string; address: string } | null;
  bike?: { registrationNumber: string } | null;
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function BatterySwapScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // A camera fires onBarcodeScanned many times a second. Without this guard the
  // same dock would be submitted a dozen times before the first response lands.
  const handledRef = useRef(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiClient.get('/rental/swaps');
      setSwaps(res.data?.data?.swaps ?? []);
    } catch {
      // History is secondary — the scanner still works without it.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
      return () => {
        setScanning(false);
        handledRef.current = false;
      };
    }, [loadHistory]),
  );

  const startScan = async () => {
    setError(null);
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('Camera access is needed to scan a dock QR code.');
        return;
      }
    }
    handledRef.current = false;
    setScanning(true);
  };

  const onScanned = async ({ data }: { data: string }) => {
    if (handledRef.current) return;
    handledRef.current = true;

    setScanning(false);
    setSubmitting(true);
    setError(null);

    try {
      const res = await apiClient.post('/rental/swaps', { code: data });
      const swap = res.data?.data;
      const where = swap?.station?.name ?? swap?.hub?.name ?? 'the dock';
      setSuccess(
        `Swapped at ${where}. Your bike now shows ${swap?.batteryInPercent ?? 100}% charge.`,
      );
      void loadHistory();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'That swap could not be logged. Try again.');
      handledRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Battery Swap</Text>
      </View>

      {scanning ? (
        <View style={styles.scanner}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
          />

          {/* Reticle */}
          <View style={styles.reticleWrap} pointerEvents="none">
            <View style={styles.reticle} />
            <Text style={styles.reticleHint}>Point at the QR code on the dock</Text>
          </View>

          <Pressable style={styles.cancelScan} onPress={() => setScanning(false)}>
            <Ionicons name="close" size={20} color={colors.text.primary} />
            <Text style={styles.cancelScanText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <NeoSurface borderRadius={radius.lg} style={styles.scanCard}>
            <View style={styles.scanIconHalo}>
              <Ionicons name="battery-charging" size={26} color={colors.brand.primary} />
            </View>
            <Text style={styles.scanTitle}>Swap a drained battery</Text>
            <Text style={styles.scanSub}>
              Scan the QR on any swap dock or hub. Exchange your battery for a charged one in
              under two minutes.
            </Text>

            <Pressable style={styles.scanBtn} onPress={startScan} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator size="small" color={colors.common.white} />
              ) : (
                <>
                  <Ionicons name="qr-code-outline" size={18} color={colors.common.white} />
                  <Text style={styles.scanBtnText}>Scan dock QR</Text>
                </>
              )}
            </Pressable>
          </NeoSurface>

          <Pressable style={styles.findCard} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="map-outline" size={18} color={colors.brand.primary} />
            <Text style={styles.findText}>Find the nearest swap dock on the map</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
          </Pressable>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Swap history</Text>

            {loading ? (
              <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.lg }} />
            ) : swaps.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="battery-dead-outline" size={30} color={colors.neutral[300]} />
                <Text style={styles.emptyTitle}>No swaps yet</Text>
                <Text style={styles.emptyHint}>
                  Every swap you make is logged here with the charge you received.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {swaps.map((s) => (
                  <View key={s.id} style={styles.row}>
                    <View style={styles.rowIcon}>
                      <Ionicons
                        name="battery-charging-outline"
                        size={16}
                        color={colors.brand.primary}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>
                        {s.station?.name ?? s.hub?.name ?? 'Swap dock'}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {formatWhen(s.createdAt)}
                        {s.bike?.registrationNumber ? ` · ${s.bike.registrationNumber}` : ''}
                      </Text>
                    </View>

                    <View style={styles.swapDelta}>
                      <Text style={styles.deltaOut}>{s.batteryOutPercent}%</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={11}
                        color={colors.text.secondary}
                      />
                      <Text style={styles.deltaIn}>{s.batteryInPercent}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <ThemedModal
        visible={!!success}
        title="Battery swapped"
        message={success ?? ''}
        icon="battery-charging"
        confirmLabel="Done"
        onConfirm={() => setSuccess(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },

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

  scanCard: { alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface.card },
  scanIconHalo: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  scanSub: {
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand.primary,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  scanBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.common.white,
  },

  findCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.subtle,
  },
  findText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.text.primary,
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

  list: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.text.primary },
  rowMeta: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  swapDelta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deltaOut: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.text.secondary,
  },
  deltaIn: {
    fontFamily: fontFamily.bold,
    fontSize: 12.5,
    color: colors.status.success,
  },

  /* Scanner */
  scanner: { flex: 1, backgroundColor: colors.common.black },
  reticleWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  reticle: {
    width: 230,
    height: 230,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.brand.light,
    backgroundColor: colors.common.transparent,
  },
  reticleHint: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.text.inverse,
    marginTop: spacing.lg,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  cancelScan: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.overlay.mapControl,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  cancelScanText: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: colors.text.primary,
  },
});
