import React, { useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import { colors, fontFamily, radius, screenPadding, shadows, spacing, textStyles } from '../theme';
import { CurvedCardTop, Glass, HeroBlob, NeoSurface, PrimaryButton } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestOtp'>;

/** Card gutter — shared by the card style and the curved cap's width. */
const CARD_MARGIN = 18;

export default function RequestOtpScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  // Real status-bar height. This used to be a hardcoded `paddingTop: 46`,
  // which only happened to look right on one device — Android status bars run
  // 24-48dp depending on hardware, and SDK 54 draws edge-to-edge by default.
  const insets = useSafeAreaInsets();
  const heroHeight = Math.round(height * 0.44);
  const cardWidth = width - CARD_MARGIN * 2;

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOtp = async () => {
    setError('');
    Keyboard.dismiss();

    const raw = phone.trim();
    if (raw.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    const fullPhone = `+91${raw}`;
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/otp/request', { phone: fullPhone });
      navigation.navigate('VerifyOtp', { challengeId: res.data.challengeId, phone: fullPhone });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to request OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* page wash — pale blue-mint at the top fading to near-white */}
      <LinearGradient
        colors={[colors.surface.backgroundTintTop, colors.surface.backgroundTintBottom]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------- HERO ---------------------- */}
        <View style={[styles.hero, { height: heroHeight }]}>
          {/* blob draws 78px past the hero and sits above the card (zIndex) */}
          <View style={styles.heroBlobWrap}>
            <HeroBlob width={width} height={heroHeight} overhang={78} />
          </View>

          <View
            style={[styles.heroContent, { paddingTop: insets.top + spacing.lg }]}
            pointerEvents="box-none"
          >
            <View style={styles.topRow}>
              <Glass borderRadius={radius.md} style={styles.logoMark}>
                <Ionicons name="flash" size={22} color={colors.brand.primary} />
              </Glass>

              <Glass style={styles.langPill}>
                <Ionicons name="globe-outline" size={14} color={colors.text.primary} />
                <Text style={styles.langText}>English</Text>
                <Ionicons name="chevron-down" size={12} color={colors.text.secondary} />
              </Glass>
            </View>

            <View style={styles.dotGrid}>
              {Array.from({ length: 16 }).map((_, i) => (
                <View key={i} style={styles.dot} />
              ))}
            </View>

            <View style={styles.wordmarkBlock}>
              <Text style={styles.brand}>RIDE</Text>
              <Text style={styles.brand}>FOR</Text>
              <View style={styles.youRow}>
                <Text style={[styles.brand, styles.brandGreen]}>Y</Text>
                <View style={styles.boltO}>
                  <Ionicons name="flash" size={13} color={colors.text.inverse} />
                </View>
                <Text style={[styles.brand, styles.brandGreen]}>U</Text>
              </View>

              <Text style={styles.subtitle}>EV Bike Rental</Text>
              <View style={styles.greenDivider} />
              <Text style={styles.tagline}>Smart rides.</Text>
              <Text style={styles.tagline}>Sustainable future.</Text>
            </View>
          </View>
        </View>

        {/* ---------------------- LOGIN CARD ---------------------- */}
        <NeoSurface variant="card" borderRadius={radius.card} style={styles.card}>
          {/* soft asymmetric lip that echoes the hero curve above */}
          <CurvedCardTop width={cardWidth} />

          <View style={styles.cardHeader}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={styles.welcomeTitle}>Welcome back</Text>
              <Text style={styles.welcomeSub}>Login to continue your journey</Text>
            </View>
            <View style={styles.shieldBadge}>
              <Ionicons name="shield-checkmark" size={20} color={colors.brand.primary} />
            </View>
          </View>

          {/* phone number row: [ +91 v ] [  (icon) Enter mobile number  ] */}
          <View style={styles.phoneRow}>
            <NeoSurface borderRadius={radius.pill} style={styles.countryPill}>
              <Text style={styles.countryText}>+91</Text>
              <Ionicons name="chevron-down" size={14} color={colors.text.secondary} />
            </NeoSurface>

            <NeoSurface variant="inset" borderRadius={radius.pill} style={styles.phoneField}>
              <Ionicons name="call-outline" size={17} color={colors.brand.primary} />
              <View style={styles.fieldDivider} />
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter mobile number"
                placeholderTextColor={colors.text.secondary}
                keyboardType="number-pad"
                maxLength={10}
                value={phone}
                onChangeText={(t) => {
                  setPhone(t.replace(/[^0-9]/g, ''));
                  if (error) setError('');
                }}
                editable={!loading}
              />
            </NeoSurface>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            label="Continue with OTP"
            onPress={handleRequestOtp}
            loading={loading}
            style={{ marginTop: spacing.lg }}
          />

          {/* V1 is phone + OTP only — there is no separate account to create,
              so the OR divider, Google sign-in and "Create an account" link
              that the mockup shows are deliberately not built. */}

          {/* Takes up the slack so the trust badges settle at the foot of the
              card instead of floating just under the CTA. */}
          <View style={styles.spacer} />

          {/* trust badges */}
          <View style={styles.trustRow}>
            <TrustItem icon="shield-checkmark-outline" title="Safe & Secure" sub={'Your safety is\nour priority'} />
            <View style={styles.trustDivider} />
            <TrustItem icon="leaf-outline" title="100% Electric" sub={'Zero emission\nzero pollution'} />
            <View style={styles.trustDivider} />
            <TrustItem icon="headset-outline" title="24/7 Support" sub={"We're here\nfor you"} />
          </View>

        </NeoSurface>
      </ScrollView>
    </View>
  );
}

function TrustItem({ icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <View style={styles.trustItem}>
      <View style={styles.trustIcon}>
        <Ionicons name={icon} size={16} color={colors.brand.primary} />
      </View>
      <Text style={styles.trustTitle}>{title}</Text>
      <Text style={styles.trustSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  // flexGrow lets the card below stretch into whatever height is left over.
  // Without it the ScrollView only ever sizes to its content, which is why
  // dropping the Google button left a gap at the bottom of the screen.
  scroll: { flexGrow: 1, paddingBottom: spacing.lg },

  /* hero */
  hero: { width: '100%', zIndex: 2 }, // paints above the card so the blob curve overlaps it
  heroBlobWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  // paddingTop is applied inline from the safe-area inset, not fixed here.
  heroContent: { flex: 1, paddingHorizontal: screenPadding },
  wordmarkBlock: { maxWidth: '56%' }, // keep text clear of the blob
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoMark: { width: 54, height: 42, alignItems: 'center', justifyContent: 'center' },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  langText: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.text.primary },

  dotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 44,
    marginTop: spacing.sm,
    marginLeft: spacing.xxl,
    opacity: 0.55,
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.brand.primary, margin: 3.5 },

  brand: { ...textStyles.display, color: colors.text.primary },
  brandGreen: { color: colors.brand.primary },
  youRow: { flexDirection: 'row', alignItems: 'center' },
  // The "O" of YOU. Measured in the mockup at ~22dp wide — it stands in for a
  // letter whose cap height is 25dp, so it must sit just inside that, not
  // above it. At 34dp it was half again too big and pushed Y and U apart,
  // which is the main reason the wordmark read as wrong.
  boltO: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    transform: [{ translateY: 1 }],
  },
  subtitle: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.text.secondary, marginTop: spacing.xs },
  greenDivider: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brand.primary,
    marginVertical: 6,
  },
  tagline: { ...textStyles.bodySmall, color: colors.text.secondary },

  /* card */
  card: {
    zIndex: 1,
    // Fill the height the hero doesn't use, so the card always reaches the
    // bottom of the screen regardless of how much content it holds.
    flex: 1,
    marginHorizontal: CARD_MARGIN,
    // the cap draws CARD_CAP_HEIGHT above this box, so the card's *visual*
    // top is that much higher than its layout box
    marginTop: -20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: 0, // the curved cap supplies the top edge
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
  },
  // The card used to draw a small grey "grabber" pill here. The mockup has no
  // such element — the card is not a draggable sheet — so it was removed.
  // Its old top spacing is folded into cardHeader's marginTop below.
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  welcomeTitle: { fontFamily: fontFamily.bold, fontSize: 23, color: colors.text.primary },
  welcomeSub: { ...textStyles.bodySmall, color: colors.text.secondary, marginTop: 4 },
  shieldBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },

  phoneRow: { flexDirection: 'row', gap: spacing.sm },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    height: 56,
  },
  countryText: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.text.primary },
  phoneField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: spacing.md,
    height: 56,
  },
  fieldDivider: { width: 1, height: 22, backgroundColor: colors.border },
  phoneInput: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, color: colors.text.primary },

  error: { ...textStyles.bodySmall, color: colors.status.error, marginTop: spacing.sm, textAlign: 'center' },

  // Grows to absorb leftover height, but never collapses below a sensible gap
  // when the keyboard is up and space is tight.
  spacer: { flex: 1, minHeight: spacing.xl },

  trustRow: {
    flexDirection: 'row',
    marginTop: 0,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  trustItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  trustIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
    ...shadows.subtle,
  },
  trustTitle: { fontFamily: fontFamily.semibold, fontSize: 10.5, color: colors.text.primary, textAlign: 'center' },
  trustSub: {
    fontFamily: fontFamily.regular,
    fontSize: 9,
    lineHeight: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 3,
  },
  trustDivider: { width: 1, backgroundColor: colors.border, marginVertical: 2 },
});
