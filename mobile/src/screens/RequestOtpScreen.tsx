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
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import { colors, fontFamily, radius, screenPadding, spacing, textStyles } from '../theme';
import { Glass, HeroBlob, NeoSurface, PrimaryButton } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestOtp'>;

export default function RequestOtpScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.round(height * 0.46);

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

          <View style={styles.heroContent} pointerEvents="box-none">
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
                  <Ionicons name="flash" size={15} color={colors.text.inverse} />
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
        <NeoSurface borderRadius={radius.card} style={styles.card}>
          <View style={styles.grabber} />

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
            style={{ marginTop: spacing.md }}
          />

         

          {/* trust badges */}
          <View style={styles.trustRow}>
            <TrustItem icon="shield-checkmark-outline" title="Safe & Secure" sub={'Your safety is\nour priority'} />
            <View style={styles.trustDivider} />
            <TrustItem icon="leaf-outline" title="100% Electric" sub={'Zero emission\nzero pollution'} />
            <View style={styles.trustDivider} />
            <TrustItem icon="headset-outline" title="24/7 Support" sub={"We're here\nfor you"} />
          </View>

          <Text style={styles.footer}>
            New here? <Text style={styles.footerLink}>Create an account</Text>
          </Text>
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
  scroll: { paddingBottom: spacing.xl },

  /* hero */
  hero: { width: '100%', zIndex: 2 }, // paints above the card so the blob curve overlaps it
  heroBlobWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroContent: { flex: 1, paddingHorizontal: screenPadding, paddingTop: 52 },
  wordmarkBlock: { maxWidth: '56%', marginTop: spacing.sm }, // keep text clear of the blob
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
    marginTop: spacing.md,
    marginLeft: spacing.xxl,
    opacity: 0.55,
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.brand.primary, margin: 3.5 },

  brand: { ...textStyles.display, color: colors.text.primary },
  brandGreen: { color: colors.brand.primary },
  youRow: { flexDirection: 'row', alignItems: 'center' },
  boltO: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    transform: [{ translateY: 1 }],
  },
  subtitle: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.text.secondary, marginTop: spacing.xs },
  greenDivider: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brand.primary,
    marginVertical: spacing.sm,
  },
  tagline: { ...textStyles.bodySmall, color: colors.text.secondary },

  /* card */
  card: {
    zIndex: 1,
    marginHorizontal: spacing.md,
    marginTop: -70,
    paddingHorizontal: spacing.lg,
    paddingTop: 60, // clears the blob curve overlapping the top
    paddingBottom: spacing.lg,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  welcomeTitle: { fontFamily: fontFamily.bold, fontSize: 21, color: colors.text.primary },
  welcomeSub: { ...textStyles.bodySmall, color: colors.text.secondary, marginTop: 3 },
  shieldBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand.mint,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  phoneRow: { flexDirection: 'row', gap: spacing.sm },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  countryText: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text.primary },
  phoneField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  fieldDivider: { width: 1, height: 22, backgroundColor: colors.border },
  phoneInput: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, color: colors.text.primary },

  error: { ...textStyles.bodySmall, color: colors.status.error, marginTop: spacing.sm, textAlign: 'center' },

  trustRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  trustItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  trustIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
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

  footer: { ...textStyles.bodySmall, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.lg },
  footerLink: { color: colors.brand.link, fontFamily: fontFamily.semibold },
});
