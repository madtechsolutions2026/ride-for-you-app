import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
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
import { setTokens } from '../api/tokenStore';
import { colors, fontFamily, radius, screenPadding, spacing, textStyles } from '../theme';
import { Glass, HeroBlob, NeoSurface, PrimaryButton } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyOtp'> & {
  onLoginSuccess: () => void;
};

const OTP_LENGTH = 6;

/** +919998887776 -> "+91 99988 87776" */
function formatPhone(p: string) {
  const cc = p.slice(0, 3);
  const rest = p.slice(3);
  return `${cc} ${rest.slice(0, 5)} ${rest.slice(5)}`.trim();
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function VerifyOtpScreen({ route, navigation, onLoginSuccess }: Props) {
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.round(height * 0.44);

  const { phone } = route.params;
  const [challengeId, setChallengeId] = useState(route.params.challengeId);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  const handleVerify = async () => {
    setError('');
    Keyboard.dismiss();
    if (otp.length !== OTP_LENGTH) {
      setError('Enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/otp/verify', { challengeId, otp });
      await setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
      onLoginSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Verification failed. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    setError('');
    setResending(true);
    try {
      const res = await apiClient.post('/auth/otp/request', { phone });
      setChallengeId(res.data.challengeId);
      setResendTimer(res.data.resendAvailableIn || 30);
      setOtp('');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not resend the code.');
    } finally {
      setResending(false);
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
        {/* ---------------- HERO ---------------- */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <View style={styles.heroBlobWrap}>
            <HeroBlob width={width} height={heroHeight} overhang={78} />
          </View>

          <View style={styles.heroContent} pointerEvents="box-none">
            <View style={styles.topRow}>
              <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
                <Glass borderRadius={radius.pill} style={styles.iconBtn}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.brand.primary} />
                </Glass>
              </Pressable>

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
              <Text style={styles.brand}>Verify</Text>
              <Text style={[styles.brand, styles.brandGreen]}>your{'\n'}number</Text>

              <Text style={styles.heroSub}>We&apos;ve sent a{'\n'}verification code to</Text>
              <Pressable style={styles.phoneRow} onPress={() => navigation.goBack()} hitSlop={8}>
                <Text style={styles.phoneText}>{formatPhone(phone)}</Text>
                <Ionicons name="create-outline" size={15} color={colors.brand.primary} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ---------------- CARD ---------------- */}
        <NeoSurface borderRadius={radius.card} style={styles.card}>
          <View style={styles.grabber} />

          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.sub}>Enter the 6-digit code sent to your number</Text>

          {/* 6 code boxes over a hidden input */}
          <Pressable style={styles.otpRow} onPress={() => inputRef.current?.focus()}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const char = otp[i] ?? '';
              const isActive = focused && i === otp.length;
              return (
                <View
                  key={i}
                  style={[styles.otpBox, char !== '' && styles.otpBoxFilled, isActive && styles.otpBoxActive]}
                >
                  {char !== '' ? (
                    <Text style={styles.otpChar}>{char}</Text>
                  ) : (
                    <View style={styles.otpPlaceholder} />
                  )}
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={otp}
            onChangeText={(t) => {
              setOtp(t.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH));
              if (error) setError('');
            }}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.resendBlock}>
            <Text style={styles.resendQ}>Didn&apos;t receive the code?</Text>
            <Pressable onPress={handleResend} disabled={resendTimer > 0 || resending} hitSlop={8}>
              <Text style={styles.resendLink}>
                {resending ? 'Sending…' : 'Resend OTP'}
                {resendTimer > 0 ? <Text style={styles.resendTimer}>{`  (${pad2(0)}:${pad2(resendTimer)})`}</Text> : null}
              </Text>
            </Pressable>
          </View>

          <PrimaryButton
            label="Continue"
            onPress={handleVerify}
            loading={loading}
            disabled={otp.length !== OTP_LENGTH}
            style={{ marginTop: spacing.md }}
          />

          {/* secure note */}
          <View style={styles.secureBox}>
            <View style={styles.secureIcon}>
              <Ionicons name="lock-closed" size={16} color={colors.brand.primary} />
            </View>
            <Text style={styles.secureText}>
              Your verification code is 100% secure. Ride For You will never share your data with anyone.
            </Text>
          </View>

          <View style={styles.hr} />

          <View style={styles.helpRow}>
            <View style={styles.helpIcon}>
              <Ionicons name="headset-outline" size={16} color={colors.brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.helpTitle}>Need help?</Text>
              <Pressable hitSlop={6}>
                <Text style={styles.helpLink}>Contact Support ›</Text>
              </Pressable>
            </View>
          </View>
        </NeoSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { paddingBottom: spacing.xl },

  /* hero */
  hero: { width: '100%', zIndex: 2 },
  heroBlobWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroContent: { flex: 1, paddingHorizontal: screenPadding, paddingTop: 52 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
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

  wordmarkBlock: { maxWidth: '50%', marginTop: spacing.sm },
  brand: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 33, color: colors.text.primary },
  brandGreen: { color: colors.brand.primary },
  heroSub: { ...textStyles.bodySmall, color: colors.text.secondary, marginTop: spacing.md },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  phoneText: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text.primary },

  /* card */
  card: {
    zIndex: 1,
    marginHorizontal: spacing.md,
    marginTop: -52,
    paddingHorizontal: spacing.lg,
    paddingTop: 44,
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
  title: { fontFamily: fontFamily.bold, fontSize: 21, color: colors.text.primary },
  sub: { ...textStyles.bodySmall, color: colors.text.secondary, marginTop: 4 },

  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: '#FBFDFC',
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: { borderColor: colors.brand.light, backgroundColor: colors.surface.card },
  otpBoxActive: { borderColor: colors.brand.primary, borderWidth: 2, backgroundColor: colors.surface.card },
  otpChar: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.text.primary },
  otpPlaceholder: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },

  error: { ...textStyles.bodySmall, color: colors.status.error, marginTop: spacing.sm, textAlign: 'center' },

  resendBlock: { alignItems: 'center', marginTop: spacing.lg },
  resendQ: { ...textStyles.bodySmall, color: colors.text.secondary },
  resendLink: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.brand.primary, marginTop: 4 },
  resendTimer: { fontFamily: fontFamily.medium, color: colors.text.secondary },

  secureBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.brand.mint,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  secureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secureText: { flex: 1, fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 15, color: colors.text.secondary },

  hr: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },

  helpRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  helpIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.text.primary },
  helpLink: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.brand.primary, marginTop: 2 },
});
