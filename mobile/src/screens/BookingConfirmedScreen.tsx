import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
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
import Svg, { Path, ClipPath, Defs, Image as SvgImage } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { images } from '../assets';
import { colors, fontFamily } from '../theme';
import { Confetti } from '../components';
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
};

/* Palette lifted from the Figma export ("Booking Confirmed Screen.svg") — a
   brighter emerald than the app's brand green, kept local so it doesn't shift
   the rest of the app. */
const C = {
  green: '#10B981',
  greenDeep: '#0FA372',
  ink: '#1A2836',
  inkSub: '#9CA3AF',
  tint: '#EFF7F4',
  borderGreen: '#BBF7D0',
  pageTop: '#E9F6F0',
  line: '#F0F2F4',
};

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 20;
const HERO_H = Math.round((SCREEN_W * 340) / 430);
const BLOB =
  'M186.725 271C173.525 301.4 198.559 328.667 212.725 338.5H430.225V0H316.225C297.425 15.6 282.725 47.8333 277.725 62C275.725 71.6 270.225 88.3333 267.725 95.5C260.525 112.3 258.725 127.833 258.725 133.5C257.525 155.9 240.892 175.167 232.725 182C219.525 190.4 212.892 209.833 211.225 218.5C211.625 234.9 200.392 251.333 194.725 257.5C189.925 264.7 187.392 269.5 186.725 271Z';

const rupee = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const planLabel = (d?: string) =>
  d === 'WEEK' ? 'Weekly' : d === 'MONTH' ? 'Monthly' : d === 'DAY' ? 'Daily' : d || '';

export default function BookingConfirmedScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params || {};

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const pop = useRef(new Animated.Value(0)).current;
  const leaf = useRef(new Animated.Value(0)).current;
  const toastO = useRef(new Animated.Value(0)).current;

  const sampleBooking: Booking = {
    reference: 'RFY-8921-HYD',
    status: 'CONFIRMED',
    model: {
      name: 'SPRINTO HS',
      category: 'High-Speed Commercial',
      imageUrl: null,
    },
    plan: { duration: 'WEEK' },
    hub: {
      name: 'Kondapur Main Hub',
      address: 'Botanical Garden Rd, Kondapur, Hyderabad',
      lat: 17.4588,
      lng: 78.3621,
      contactPhone: '+91 40 4567 8901',
      operatingHours: '09:00 AM - 09:00 PM',
    },
    charges: {
      rent: 1925,
      deposit: 0,
      platformFee: 1500,
      total: 3425,
    },
    amountPaid: 3425,
  };

  useEffect(() => {
    if (!bookingId || bookingId === 'sample' || bookingId === 'demo') {
      setBooking(sampleBooking);
      setLoading(false);
      return;
    }

    apiClient
      .get(`/rental/bookings/${bookingId}`)
      .then((res) => setBooking(res.data.booking || sampleBooking))
      .catch(() => setBooking(sampleBooking))
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    if (loading) return;
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5, tension: 70 }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(leaf, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(leaf, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, [loading]);

  const flashToast = (msg: string) => {
    setToast(msg);
    Animated.sequence([
      Animated.timing(toastO, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(toastO, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  const goBookings = () =>
    navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'MyBookings' }] });
  const goProfile = () =>
    navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'Profile' }] });

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

  const addReminder = () => {
    const h = booking?.hub;
    const title = encodeURIComponent(`Pick up ${booking?.model?.name ?? 'my Ride For You bike'}`);
    const details = encodeURIComponent(
      `Booking ${booking?.reference ?? ''}. Carry the ID used for KYC.`
    );
    const loc = encodeURIComponent(h ? `${h.name}, ${h.address}` : '');
    Linking.openURL(
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${loc}`
    ).catch(() => flashToast('Could not open calendar'));
  };

  const callSupport = () => {
    const phone = booking?.hub?.contactPhone;
    if (!phone) return flashToast('Support number not available');
    Linking.openURL(`tel:${phone}`).catch(() => flashToast('Could not open dialer'));
  };

  const invite = () => {
    Share.share({
      message:
        'I just booked an electric scooter on Ride For You — smart, affordable EV rentals. Give it a try!',
    }).catch(() => {});
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centre]}>
        <ActivityIndicator color={C.green} size="large" />
      </View>
    );
  }

  const hub = booking?.hub;
  const hubShort = hub?.name.replace(/^ride for you\s*[–—-]\s*/i, '') || 'the hub';
  const hours = hub?.operatingHours || 'opening hours';
  const deposit = booking?.charges?.deposit ?? 0;

  const STEPS = [
    {
      title: 'Go to the pickup station',
      body: hub ? `Reach ${hubShort}, open ${hours}.` : 'Reach the hub during opening hours.',
    },
    { title: 'Verify at the desk', body: 'Show your Booking ID and KYC document.' },
    { title: 'Collect your bike', body: 'Staff checks the helmet and hands over the keys.' },
    {
      title: 'Return on time',
      body:
        deposit > 0
          ? `Return to the same hub to get your ${rupee(deposit)} deposit back.`
          : 'Return to the same hub to avoid late fees.',
    },
  ];

  const leafY = leaf.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const leafR = leaf.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '5deg'] });

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 92 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- HERO ---------------- */}
        <View style={styles.hero}>
          <Svg
            width={SCREEN_W}
            height={HERO_H}
            viewBox="0 0 430 340"
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <ClipPath id="blob">
                <Path d={BLOB} />
              </ClipPath>
            </Defs>
            <Path d={BLOB} fill={C.tint} />
            <SvgImage
              href={images.confirmHeroScene}
              x={151}
              y={-104}
              width={279}
              height={504}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#blob)"
            />
          </Svg>

          <Confetti height={HERO_H + 40} width={SCREEN_W} count={36} decor={16} />

          <Animated.View
            style={[
              styles.leaves,
              { transform: [{ translateY: leafY }, { rotate: leafR }] },
            ]}
            pointerEvents="none"
          >
            <Image source={images.confirmLeaves} style={styles.leavesImg} contentFit="contain" />
          </Animated.View>

          <Image
            source={
              booking?.model?.imageUrl ? { uri: booking.model.imageUrl } : images.confirmScooter
            }
            style={styles.heroScooter}
            contentFit="contain"
          />

          {/* top row */}
          <View style={[styles.topRow, { top: insets.top + 6 }]}>
            <Pressable style={styles.backBtn} onPress={goHome} hitSlop={8}>
              <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
            </Pressable>
            <Pressable style={styles.helpBtn} onPress={callSupport} hitSlop={8}>
              <Ionicons name="headset-outline" size={15} color={colors.text.primary} />
              <Text style={styles.helpBtnText}>Help</Text>
            </Pressable>
          </View>
        </View>

        {/* ---------------- HEADLINE ---------------- */}
        <View style={styles.headline}>
          <Animated.View style={[styles.check, { transform: [{ scale: pop }], opacity: pop }]}>
            <Ionicons name="checkmark-sharp" size={22} color={C.green} />
          </Animated.View>

          <Text style={styles.h1}>Booking</Text>
          <Text style={[styles.h1, { color: C.green }]}>Confirmed!</Text>
          <Text style={styles.sub}>Your ride is all set. Get ready for a smart and smooth journey.</Text>

          <Pressable style={styles.idPill} onPress={copyRef} hitSlop={6}>
            <Ionicons name="shield-checkmark" size={13} color={C.green} />
            <Text style={styles.idText}>
              Booking ID: <Text style={styles.idStrong}>{booking?.reference ?? '—'}</Text>
            </Text>
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={14}
              color={copied ? C.green : colors.neutral[400]}
            />
          </Pressable>
        </View>

        {/* ---------------- REMINDER (dark) ---------------- */}
        <View style={styles.reminder}>
          <View style={styles.bell}>
            <Ionicons name="notifications" size={17} color={colors.common.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reminderTitle}>Add a pickup reminder</Text>
            <Text style={styles.reminderSub}>A calendar nudge before the hub opening hours.</Text>
          </View>
          <Pressable style={styles.reminderBtn} onPress={addReminder}>
            <Text style={styles.reminderBtnText}>Add</Text>
          </Pressable>
        </View>

        {/* ---------------- WHAT'S NEXT ---------------- */}
        <View style={styles.card}>
          <Image source={images.confirmScan} style={styles.wnScan} contentFit="contain" />

          <Text style={styles.cardTitle}>What's Next?</Text>

          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.stepRail}>
                  <View style={styles.stepDot}>
                    <Text style={styles.stepNum}>{i + 1}</Text>
                  </View>
                  {i < STEPS.length - 1 && <View style={styles.stepLine} />}
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                  <Text style={styles.stepText}>{s.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ---------------- NEED HELP ---------------- */}
        <View style={styles.helpCard}>
          <View style={styles.helpIcon}>
            <Ionicons name="headset-outline" size={18} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.helpTitle}>Need help?</Text>
            <Text style={styles.helpSub}>Our support team is here for you 24/7.</Text>
          </View>
          <Pressable style={styles.helpCta} onPress={callSupport}>
            <Ionicons name="call" size={13} color={C.green} />
            <Text style={styles.helpCtaText}>Contact Support</Text>
          </Pressable>
        </View>

        {/* ---------------- REFER & EARN ---------------- */}
        <LinearGradient
          colors={[C.green, C.greenDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.refer}
        >
          <View style={styles.referIcon}>
            <Ionicons name="gift" size={20} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.referTitle}>Refer &amp; Earn</Text>
            <Text style={styles.referSub}>
              Invite your friends and earn exciting rewards on every referral.
            </Text>
          </View>
          <Pressable style={styles.referBtn} onPress={invite}>
            <Text style={styles.referBtnText}>Invite Now</Text>
            <Ionicons name="chevron-forward" size={13} color={C.green} />
          </Pressable>
        </LinearGradient>
      </ScrollView>

      {/* ---------------- BOTTOM TAB BAR ---------------- */}
      <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8 }]}>
        {[
          { icon: 'home-outline', label: 'Home', on: goHome },
          { icon: 'list', label: 'Bookings', active: true, on: goBookings },
          { icon: 'wallet-outline', label: 'Wallet', on: goHome },
          { icon: 'chatbubble-outline', label: 'Inbox', badge: '2', on: goHome },
          { icon: 'person-outline', label: 'Profile', on: goProfile },
        ].map((t) => (
          <Pressable key={t.label} style={styles.tab} onPress={t.on} hitSlop={6}>
            {t.active && <View style={styles.tabActiveBar} />}
            <View>
              <Ionicons
                name={t.icon as keyof typeof Ionicons.glyphMap}
                size={21}
                color={t.active ? C.green : colors.neutral[400]}
              />
              {t.badge && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{t.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, t.active && { color: C.green, fontFamily: fontFamily.bold }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {toast && (
        <Animated.View
          style={[styles.toast, { opacity: toastO, bottom: insets.bottom + 90 }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.common.white },
  centre: { alignItems: 'center', justifyContent: 'center' },

  /* hero */
  hero: { height: HERO_H, width: '100%', backgroundColor: C.pageTop },
  heroScooter: {
    position: 'absolute',
    right: -SCREEN_W * 0.02,
    top: HERO_H * 0.2,
    width: SCREEN_W * 0.62,
    height: HERO_H * 0.66,
  },
  leaves: {
    position: 'absolute',
    left: SCREEN_W * 0.34,
    top: HERO_H * 0.22,
    width: SCREEN_W * 0.24,
    height: HERO_H * 0.22,
  },
  leavesImg: { width: '100%', height: '100%' },
  topRow: {
    position: 'absolute',
    left: H_PAD,
    right: H_PAD,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.common.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[100],
    boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 8, color: 'rgba(0,0,0,0.10)' }],
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: colors.common.white,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 8, color: 'rgba(0,0,0,0.10)' }],
  },
  helpBtnText: { fontFamily: fontFamily.semibold, fontSize: 12.5, color: colors.text.primary },

  /* headline */
  headline: { paddingHorizontal: H_PAD, marginTop: -HERO_H * 0.22 },
  check: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.common.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 14, color: 'rgba(16,185,129,0.22)' }],
  },
  h1: {
    fontFamily: fontFamily.extrabold,
    fontSize: 33,
    lineHeight: 37,
    letterSpacing: -0.6,
    color: C.ink,
  },
  sub: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.secondary,
    marginTop: 10,
  },
  idPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.common.white,
    borderWidth: 1,
    borderColor: C.borderGreen,
    boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 8, color: 'rgba(0,0,0,0.06)' }],
  },
  idText: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.text.secondary },
  idStrong: { fontFamily: fontFamily.bold, color: C.ink },

  /* reminder dark card */
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: H_PAD,
    marginTop: 22,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.ink,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitle: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.common.white },
  reminderSub: { fontFamily: fontFamily.regular, fontSize: 11.5, color: C.inkSub, marginTop: 2 },
  reminderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: C.green,
  },
  reminderBtnText: { fontFamily: fontFamily.bold, fontSize: 12.5, color: C.green },

  /* what's next card */
  card: {
    marginHorizontal: H_PAD,
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: colors.common.white,
    paddingHorizontal: 18,
    paddingVertical: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral[100],
    boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 24, color: 'rgba(16,40,54,0.08)' }],
  },
  wnScan: {
    position: 'absolute',
    right: -22,
    bottom: -6,
    width: SCREEN_W * 0.34,
    height: 190,
  },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: 19, color: C.ink, marginBottom: 16 },
  steps: { paddingRight: SCREEN_W * 0.2 },
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 18 },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: C.green,
    backgroundColor: colors.common.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontFamily: fontFamily.bold, fontSize: 9.5, color: C.green },
  stepLine: {
    flex: 1,
    width: 0,
    borderLeftWidth: 1.5,
    borderColor: C.green,
    borderStyle: 'dashed',
    marginVertical: 3,
    opacity: 0.55,
  },
  stepBody: { flex: 1, paddingBottom: 16 },
  stepTitle: { fontFamily: fontFamily.semibold, fontSize: 13.5, color: C.ink, marginTop: -2 },
  stepText: { fontFamily: fontFamily.regular, fontSize: 11.5, lineHeight: 15.5, color: colors.text.secondary, marginTop: 3 },

  /* need help */
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: H_PAD,
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: C.tint,
    borderWidth: 1,
    borderColor: colors.common.white,
  },
  helpIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.common.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: { fontFamily: fontFamily.bold, fontSize: 13.5, color: C.ink },
  helpSub: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.text.secondary, marginTop: 1 },
  helpCta: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: colors.common.white,
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  helpCtaText: { fontFamily: fontFamily.bold, fontSize: 11, color: C.green },

  /* refer & earn */
  refer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: H_PAD,
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
  },
  referIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.common.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referTitle: { fontFamily: fontFamily.bold, fontSize: 15.5, color: colors.common.white },
  referSub: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  referBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: colors.common.white,
  },
  referBtnText: { fontFamily: fontFamily.bold, fontSize: 11.5, color: C.green },

  /* tab bar */
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 10,
    backgroundColor: colors.common.white,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  tab: { alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 8, position: 'relative' },
  tabActiveBar: {
    position: 'absolute',
    top: -10,
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.green,
  },
  tabLabel: { fontFamily: fontFamily.medium, fontSize: 10.5, color: colors.neutral[400], marginTop: 3 },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -7,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 7,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: { fontFamily: fontFamily.bold, fontSize: 8, color: colors.common.white },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: C.ink,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.common.white },
});
