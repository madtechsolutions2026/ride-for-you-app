import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { images } from '../assets';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { Confetti, Glass } from '../components';
import { apiClient } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingConfirmed'>;

type Booking = {
  reference: string;
  status: string;
  model: { name: string; category: string; imageUrl: string | null } | null;
  plan: { duration: string } | null;
  hub: {
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    contactPhone: string | null;
    operatingHours: string | null;
  } | null;
  charges: { rent: number; deposit: number; platformFee: number; total: number };
  amountPaid: number;
  payments: { id: string; purpose: string; amount: number; provider: string }[];
};

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = Math.min(Math.round(SCREEN_W * 0.86), 360);

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const planLabel = (d?: string) =>
  d === 'WEEK' ? 'Weekly' : d === 'MONTH' ? 'Monthly' : d === 'DAY' ? 'Daily' : d || '—';
const purposeLabel = (p: string) =>
  (({ RENT: 'Rental', DEPOSIT: 'Deposit', PLATFORM_FEE: 'Platform fee' }) as Record<string, string>)[
    p
  ] || p;

const REMINDERS = ['Carry valid ID proof', 'Wear the helmet', 'Park at designated zones'];

export default function BookingConfirmedScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const pop = useRef(new Animated.Value(0)).current;
  const toastO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    apiClient
      .get(`/rental/bookings/${bookingId}`)
      .then((res) => setBooking(res.data.booking))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    if (!loading) {
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5, tension: 70 }).start();
    }
  }, [loading]);

  const flashToast = (msg: string) => {
    setToast(msg);
    Animated.sequence([
      Animated.timing(toastO, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastO, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  const goBookings = () =>
    navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'MyBookings' }] });

  const copyRef = async () => {
    if (!booking) return;
    try {
      await Clipboard.setStringAsync(booking.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      flashToast('Could not copy');
    }
  };

  const openMaps = () => {
    const h = booking?.hub;
    if (!h) return;
    const q =
      h.lat != null && h.lng != null
        ? `${h.lat},${h.lng}`
        : encodeURIComponent(`${h.name} ${h.address}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() =>
      flashToast('Could not open Maps')
    );
  };

  const callHub = () => {
    const phone = booking?.hub?.contactPhone;
    if (!phone) return flashToast('Hub contact not available');
    Linking.openURL(`tel:${phone}`).catch(() => flashToast('Could not open dialer'));
  };

  const shareReceipt = () => {
    if (!booking) return;
    const c = booking.charges;
    const lines = [
      'Ride For You — Booking Receipt',
      `Booking ID: ${booking.reference}`,
      `Bike: ${booking.model?.name ?? 'EV Bike'} (${planLabel(booking.plan?.duration)})`,
      `Pickup: ${booking.hub?.name ?? ''}`,
      '',
      `Rental        ${rupee(c.rent)}`,
      `Deposit       ${rupee(c.deposit)}  (refundable)`,
      `Platform fee  ${rupee(c.platformFee)}`,
      `Total paid    ${rupee(booking.amountPaid || c.total)}`,
    ];
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centre]}>
        <ActivityIndicator color={colors.brand.primary} size="large" />
      </View>
    );
  }

  const c = booking?.charges;
  const paid = booking?.amountPaid ?? c?.total ?? 0;
  const heroSrc =
    booking?.model?.imageUrl ? { uri: booking.model.imageUrl } : images.bookingHero;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- HERO ---------------- */}
        <View style={styles.hero}>
          <LinearGradient
            colors={[colors.brand.glassTop, colors.brand.mint, colors.brand.mintStrong]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Image
            source={heroSrc}
            style={styles.heroImg}
            contentFit="cover"
            contentPosition="top right"
          />
          {/* fade the hero's lower-left into the page so the headline stays legible */}
          <LinearGradient
            colors={['transparent', 'transparent', colors.surface.background]}
            locations={[0, 0.45, 0.92]}
            start={{ x: 0.35, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Confetti height={HERO_H + 60} width={SCREEN_W} count={34} decor={14} />

          <View style={[styles.heroTopRow, { paddingTop: insets.top + spacing.xs }]}>
            <Pressable onPress={goHome} hitSlop={8}>
              <Glass borderRadius={radius.md} style={styles.circleBtn}>
                <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
              </Glass>
            </Pressable>
            <Pressable onPress={callHub} hitSlop={8}>
              <Glass borderRadius={radius.md} style={styles.circleBtn}>
                <Ionicons name="headset" size={18} color={colors.text.primary} />
              </Glass>
            </Pressable>
          </View>
        </View>

        {/* ---------------- HEADLINE (overlaps hero) ---------------- */}
        <View style={styles.headline}>
          <Animated.View
            style={[styles.badgeOuter, { transform: [{ scale: pop }], opacity: pop }]}
          >
            <View style={styles.badgeInner}>
              <Ionicons name="checkmark-sharp" size={40} color={colors.common.white} />
            </View>
          </Animated.View>

          <Text style={styles.h1}>Booking</Text>
          <Text style={[styles.h1, styles.h1green]}>Confirmed!</Text>
          <Text style={styles.tagline}>Enjoy your eco-friendly ride 🚀</Text>

          <Pressable style={styles.idRow} onPress={copyRef} hitSlop={6}>
            <Text style={styles.idLabel}>
              Booking ID: <Text style={styles.idValue}>{booking?.reference ?? '—'}</Text>
            </Text>
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={15}
              color={copied ? colors.status.success : colors.text.secondary}
            />
            {copied && <Text style={styles.copiedText}>Copied</Text>}
          </Pressable>

          <View style={styles.statusPill}>
            <Ionicons name="time-outline" size={13} color={colors.brand.primary} />
            <Text style={styles.statusPillText}>
              Your ride is all set{'  '}•{'  '}See you at the station!
            </Text>
          </View>
        </View>

        {/* ---------------- UPCOMING RIDE CARD ---------------- */}
        <View style={styles.card}>
          <View style={styles.rideHead}>
            <View style={styles.rideThumb}>
              <Image
                source={
                  booking?.model?.imageUrl ? { uri: booking.model.imageUrl } : images.vehicleS1
                }
                style={styles.rideThumbImg}
                contentFit="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rideName} numberOfLines={1}>
                {booking?.model?.name ?? 'EV Bike'}
              </Text>
              <Text style={styles.rideSub}>100% Electric Scooter</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <Stat icon="calendar-outline" label="Plan" value={planLabel(booking?.plan?.duration)} sub="rental cycle" />
            <View style={styles.statDivider} />
            <Stat
              icon="time-outline"
              label="Pickup"
              value="At the hub"
              sub={booking?.hub?.operatingHours || 'opening hours'}
            />
            <View style={styles.statDivider} />
            <Stat icon="wallet-outline" label="Total Paid" value={rupee(paid)} sub="incl. deposit" accent />
          </View>

          {/* pickup / return strip */}
          <View style={styles.routeStrip}>
            <View style={styles.routeCol}>
              <View style={styles.routeDotGreen} />
              <Text style={styles.routeLabel}>Pickup Station</Text>
              <Text style={styles.routePlace} numberOfLines={2}>
                {booking?.hub?.name ?? '—'}
              </Text>
            </View>

            <View style={styles.routeMid}>
              <View style={styles.routeDash} />
              <View style={styles.routeScooter}>
                <Ionicons name="bicycle" size={13} color={colors.brand.primary} />
              </View>
              <View style={styles.routeDash} />
            </View>

            <View style={[styles.routeCol, { alignItems: 'flex-end' }]}>
              <View style={styles.routeDotGrey} />
              <Text style={styles.routeLabel}>Return</Text>
              <Text style={[styles.routePlace, { textAlign: 'right' }]} numberOfLines={2}>
                Same as pickup station
              </Text>
            </View>
          </View>
        </View>

        {/* ---------------- ACTION TILES ---------------- */}
        <View style={styles.tiles}>
          <ActionTile
            icon="navigate"
            tint={colors.brand.mint}
            fg={colors.brand.primary}
            label={'Navigate to\nStation'}
            onPress={openMaps}
          />
          <ActionTile
            icon="document-text"
            tint={colors.status.infoTint}
            fg={colors.status.info}
            label={'View Booking\nDetails'}
            onPress={goBookings}
          />
          <ActionTile
            icon="call"
            tint={colors.status.warningTint}
            fg={colors.status.warning}
            label={'Call\nthe Hub'}
            onPress={callHub}
          />
          <ActionTile
            icon="share-social"
            tint={colors.accent.purpleTint}
            fg={colors.accent.purple}
            label={'Share\nReceipt'}
            onPress={shareReceipt}
          />
        </View>

        {/* ---------------- REMINDERS ---------------- */}
        <View style={[styles.card, styles.reminderCard]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.reminderTitle}>Important Reminders</Text>
            <View style={styles.reminderRow}>
              {REMINDERS.map((r) => (
                <View key={r} style={styles.reminderItem}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.brand.primary} />
                  <Text style={styles.reminderText}>{r}</Text>
                </View>
              ))}
            </View>
          </View>
          {images.helmet ? (
            <Image source={images.helmet} style={styles.helmet} contentFit="contain" />
          ) : (
            <View style={styles.helmetFallback}>
              <Ionicons name="shield-checkmark" size={26} color={colors.brand.primary} />
            </View>
          )}
        </View>

        {/* ---------------- HELP ---------------- */}
        <Pressable style={[styles.card, styles.helpCard]} onPress={callHub}>
          <View style={styles.helpIcon}>
            <Ionicons name="headset-outline" size={18} color={colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.helpTitle}>Need help during your ride?</Text>
            <Text style={styles.helpSub}>We're available 24/7</Text>
          </View>
          <View style={styles.helpBtn}>
            <Text style={styles.helpBtnText}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.text.primary} />
          </View>
        </Pressable>
      </ScrollView>

      {/* ---------------- STICKY CTA ---------------- */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable style={styles.primaryBtn} onPress={goBookings}>
          <Text style={styles.primaryBtnText}>View My Bookings</Text>
          <View style={styles.primaryBtnArrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.brand.primary} />
          </View>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={goHome} hitSlop={6}>
          <Text style={styles.ghostBtnText}>Back to Home</Text>
        </Pressable>
      </View>

      {toast && (
        <Animated.View
          style={[styles.toast, { opacity: toastO, bottom: insets.bottom + 120 }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */

function Stat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Ionicons name={icon} size={12} color={colors.brand.primary} />
        <Text style={[styles.statValue, accent && { color: colors.brand.primary }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function ActionTile({
  icon,
  tint,
  fg,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  fg: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tile, { backgroundColor: tint }]} onPress={onPress}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={17} color={fg} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <View style={styles.tileChevron}>
        <Ionicons name="chevron-forward" size={12} color={fg} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  centre: { alignItems: 'center', justifyContent: 'center' },

  /* Hero */
  hero: {
    height: HERO_H,
    width: '100%',
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  heroImg: {
    position: 'absolute',
    right: -SCREEN_W * 0.02,
    top: -6,
    width: SCREEN_W * 0.66,
    height: '118%',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
  },
  circleBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },

  /* Headline */
  headline: {
    paddingHorizontal: screenPadding,
    marginTop: -HERO_H * 0.34,
    marginBottom: spacing.md,
  },
  badgeOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  badgeInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: {
    fontFamily: fontFamily.black,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1,
    color: colors.text.primary,
  },
  h1green: { color: colors.brand.primary },
  tagline: {
    fontFamily: fontFamily.medium,
    fontSize: 13.5,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  idLabel: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.text.secondary },
  idValue: { fontFamily: fontFamily.bold, color: colors.text.primary },
  copiedText: { fontFamily: fontFamily.semibold, fontSize: 11, color: colors.status.success },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.brand.mintSoft,
    borderWidth: 1,
    borderColor: colors.brand.mint,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: spacing.md,
  },
  statusPillText: { fontFamily: fontFamily.semibold, fontSize: 11.5, color: colors.brand.primary },

  /* Cards */
  card: {
    backgroundColor: colors.common.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: screenPadding,
    marginBottom: spacing.md,
    ...shadows.card,
  },

  rideHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rideThumb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.brand.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideThumbImg: { width: 44, height: 44 },
  rideName: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.text.primary },
  rideSub: { fontFamily: fontFamily.regular, fontSize: 11.5, color: colors.text.secondary, marginTop: 1 },

  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 9.5,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  statValue: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.text.primary },
  statSub: { fontFamily: fontFamily.regular, fontSize: 9, color: colors.text.secondary, marginTop: 2 },

  routeStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.brand.mintSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  routeCol: { flex: 1 },
  routeDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand.primary,
    marginBottom: 5,
  },
  routeDotGrey: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.neutral[300],
    marginBottom: 5,
  },
  routeLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  routePlace: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.text.primary, marginTop: 2 },
  routeMid: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingTop: 2 },
  routeDash: { width: 14, height: 1.5, backgroundColor: colors.brand.light, marginVertical: 2 },
  routeScooter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.common.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },

  /* Tiles */
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tile: {
    width: (SCREEN_W - screenPadding * 2 - spacing.sm) / 2,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.overlay.onAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 12.5,
    lineHeight: 16,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  tileChevron: { position: 'absolute', right: 10, bottom: 10 },

  /* Reminders */
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand.mintSoft,
    borderWidth: 1,
    borderColor: colors.brand.mint,
    ...shadows.subtle,
  },
  reminderTitle: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.text.primary },
  reminderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.sm },
  reminderItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reminderText: { fontFamily: fontFamily.medium, fontSize: 11, color: colors.text.primary },
  helmet: { width: 66, height: 66 },
  helmetFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Help */
  helpCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...shadows.subtle },
  helpIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: { fontFamily: fontFamily.semibold, fontSize: 12.5, color: colors.text.primary },
  helpSub: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.text.secondary, marginTop: 1 },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  helpBtnText: { fontFamily: fontFamily.semibold, fontSize: 10.5, color: colors.text.primary },

  /* Footer */
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.common.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.soft,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand.primary,
    paddingVertical: 15,
    borderRadius: radius.pill,
  },
  primaryBtnText: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.common.white },
  primaryBtnArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.common.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtn: { paddingVertical: 11, alignItems: 'center' },
  ghostBtnText: { fontFamily: fontFamily.semibold, fontSize: 13.5, color: colors.text.secondary },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.text.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  toastText: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.common.white },
});
