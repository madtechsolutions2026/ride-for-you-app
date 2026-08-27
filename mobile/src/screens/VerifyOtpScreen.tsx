import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { apiClient } from '../api/client';
import { setTokens } from '../api/tokenStore';

type Props = {
  route: {
    params: {
      challengeId: string;
      phone: string;
    };
  };
  navigation: any;
  onLoginSuccess: () => void;
};

const { width, height } = Dimensions.get('window');

// Custom Coded Vector Line-Art Icons
const ShieldIcon = () => (
  <View style={styles.vectorIconContainer}>
    <View style={styles.vectorShield}>
      <View style={styles.vectorShieldCheck} />
    </View>
  </View>
);

const LeafIcon = () => (
  <View style={styles.vectorIconContainer}>
    <View style={styles.vectorLeaf}>
      <View style={styles.vectorLeafVein} />
    </View>
  </View>
);

const HeadsetIcon = () => (
  <View style={styles.vectorIconContainer}>
    <View style={styles.vectorHeadsetBand} />
    <View style={[styles.vectorHeadsetCup, { left: 8 }]} />
    <View style={[styles.vectorHeadsetCup, { right: 8 }]} />
  </View>
);

export default function VerifyOtpScreen({ route, navigation, onLoginSuccess }: Props) {
  const { phone } = route.params;
  const [challengeId, setChallengeId] = useState(route.params.challengeId);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef<TextInput>(null);

  // Countdown timer logic
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleVerifyOtp = async () => {
    setError('');
    Keyboard.dismiss();

    if (otp.length !== 6 || isNaN(Number(otp))) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/otp/verify', {
        challengeId,
        otp,
      });

      const { tokens } = response.data;
      await setTokens(tokens.accessToken, tokens.refreshToken);
      onLoginSuccess();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Verification failed. Please check the code.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setResending(true);
    try {
      const response = await apiClient.post('/auth/otp/request', { phone });
      setChallengeId(response.data.challengeId);
      setResendTimer(response.data.resendAvailableIn || 30);
      setOtp('');
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed to resend code.';
      setError(errMsg);
    } finally {
      setResending(false);
    }
  };

  const formatPhoneNumber = (num: string) => {
    if (num.length >= 10) {
      return `${num.slice(0, 7)} ${num.slice(7).replace(/./g, 'X')}`;
    }
    return num;
  };

  const heroSectionHeight = height * 0.46;

  return (
    <View style={styles.mainContainer}>
      
      {/* 1. FIXED BACKGROUND S-CURVE */}
      <View style={[styles.organicBackgroundContainer, { height: heroSectionHeight }]}>
        <Svg width={width} height={heroSectionHeight} style={StyleSheet.absoluteFill}>
          {/* Coded S-curve organic gradient backing */}
          <Path
            d={`M ${width * 0.58} 0 
                C ${width * 0.12} ${heroSectionHeight * 0.28}, ${width * 0.48} ${heroSectionHeight * 0.70}, ${width * 0.95} ${heroSectionHeight}
                L ${width} ${heroSectionHeight}
                L ${width} 0 Z`}
            fill="#EAF5FA"
          />

          {/* Soft stroke highlight tracing along the S-curve boundary */}
          <Path
            d={`M ${width * 0.58} 0 
                C ${width * 0.12} ${heroSectionHeight * 0.28}, ${width * 0.48} ${heroSectionHeight * 0.70}, ${width * 0.95} ${heroSectionHeight}`}
            fill="none"
            stroke="#18B878"
            strokeWidth={2.5}
            opacity={0.12}
          />

          {/* 4x4 Dot matrix decoration pattern in the center */}
          {Array.from({ length: 4 }).map((_, colIndex) => (
            Array.from({ length: 4 }).map((_, rowIndex) => (
              <Circle 
                key={`${colIndex}-${rowIndex}`}
                cx={width * 0.445 + colIndex * 8} 
                cy={heroSectionHeight * 0.23 + rowIndex * 8} 
                r={1.8} 
                fill="#18B878" 
                opacity={0.3} 
              />
            ))
          ))}
        </Svg>
      </View>

      {/* 2. SCROLLABLE FOREGROUND VIEWPORT */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Section containing back action and Scooter Overlay */}
          <View style={[styles.heroWrapper, { height: heroSectionHeight }]}>
            
            {/* Floating Back Button */}
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.brandPlaceholder} />
            
            {/* Specifying unclipped scooter image overlay */}
            <Image 
              source={require('../../assets/scooter.png')} 
              style={styles.scooterImage}
            />
          </View>

          {/* 3. Floating White Neumorphic Verification Card */}
          <View style={styles.loginCard}>
            <View style={styles.cardCurveAccent} />

            {/* Header info */}
            <View style={styles.cardHeader}>
              <View style={styles.welcomeTextGroup}>
                <Text style={styles.welcomeTitle}>Verify your number</Text>
                <Text style={styles.welcomeSubtitle}>
                  We've sent a code to <Text style={styles.boldPhone}>{formatPhoneNumber(phone)}</Text>
                  {'  '}
                  <Text style={styles.editLink} onPress={() => navigation.goBack()}>Edit</Text>
                </Text>
              </View>
              <View style={styles.shieldBadge}>
                <Text style={styles.shieldIcon}>🛡️</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Enter 6-Digit Code</Text>

            {/* 6-Digit Code Slots */}
            <TouchableWithoutFeedback onPress={() => inputRef.current?.focus()}>
              <View style={styles.otpGrid}>
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const char = otp[index] || '';
                  const isCurrent = index === otp.length;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.otpBox,
                        char ? styles.otpBoxFilled : null,
                        isCurrent && isFocused ? styles.otpBoxActive : null,
                      ]}
                    >
                      <Text style={styles.otpText}>{char}</Text>
                    </View>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>

            {/* Hidden text input */}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={otp}
              onChangeText={(text) => {
                setOtp(text.replace(/[^0-9]/g, ''));
                if (error) setError('');
              }}
              keyboardType="number-pad"
              maxLength={6}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoFocus
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Gradient Continue Button */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.submitButtonWrapper}
              onPress={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
            >
              <LinearGradient
                colors={otp.length === 6 ? ['#18B878', '#42D99A'] : ['#cbd5e1', '#94a3b8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Continue</Text>
                    <View style={styles.arrowCircle}>
                      <Text style={otp.length === 6 ? styles.arrowTextActive : styles.arrowTextDisabled}>➔</Text>
                    </View>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Resend Actions */}
            <View style={styles.resendContainer}>
              {resendTimer > 0 ? (
                <Text style={styles.resendTimerText}>
                  Resend OTP in <Text style={styles.boldTimer}>{resendTimer}s</Text>
                </Text>
              ) : (
                <TouchableOpacity 
                  onPress={handleResendOtp} 
                  disabled={resending}
                  activeOpacity={0.8}
                >
                  {resending ? (
                    <ActivityIndicator size="small" color="#18B878" />
                  ) : (
                    <Text style={styles.resendActiveText}>Resend OTP</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Trust Badges (Coded Vector Outlines with Dividers) */}
            <View style={styles.trustContainer}>
              <View style={styles.trustItem}>
                <ShieldIcon />
                <Text style={styles.trustTitle}>Safe & Secure</Text>
              </View>

              <View style={styles.trustDivider} />

              <View style={styles.trustItem}>
                <LeafIcon />
                <Text style={styles.trustTitle}>100% Electric</Text>
              </View>

              <View style={styles.trustDivider} />

              <View style={styles.trustItem}>
                <HeadsetIcon />
                <Text style={styles.trustTitle}>24/7 Support</Text>
              </View>
            </View>

            <View style={styles.placeholder} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F7F9FB',
  },
  organicBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  keyboardView: {
    flex: 1,
    zIndex: 10,
  },
  scrollContainer: {
    flexGrow: 1,
    zIndex: 10,
  },
  heroWrapper: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    zIndex: 10,
  },
  scooterImage: {
    position: 'absolute',
    top: height * 0.09,
    right: width * 0.02,
    width: width * 0.58,
    height: height * 0.32,
    resizeMode: 'contain',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 40,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 30,
    shadowColor: '#283C50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F3042',
  },
  brandPlaceholder: {
    marginTop: 20,
    width: width * 0.42,
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    marginHorizontal: 20,
    marginBottom: Platform.OS === 'ios' ? 30 : 20,
    shadowColor: '#283C50',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.09,
    shadowRadius: 32,
    elevation: 10,
    zIndex: 20,
  },
  cardCurveAccent: {
    width: 48,
    height: 5,
    backgroundColor: '#EBF3F5',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTextGroup: {
    flex: 1,
    paddingRight: 10,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F3042',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#7F8A99',
    marginTop: 6,
    lineHeight: 18,
  },
  boldPhone: {
    color: '#1F3042',
    fontWeight: '700',
  },
  editLink: {
    color: '#18B878',
    fontWeight: '800',
  },
  shieldBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5F8F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#42D99A',
  },
  shieldIcon: {
    fontSize: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F3042',
    marginBottom: 16,
    textAlign: 'center',
  },
  otpGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  otpBox: {
    width: (width - 48 - 40) / 6,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EBF3F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#283C50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  otpBoxFilled: {
    borderColor: '#18B878',
    backgroundColor: '#FFFFFF',
  },
  otpBoxActive: {
    borderColor: '#18B878',
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  otpText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F3042',
  },
  hiddenInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
    textAlign: 'center',
  },
  submitButtonWrapper: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#18B878',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 15,
    elevation: 4,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  arrowCircle: {
    position: 'absolute',
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#17283A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  arrowTextActive: {
    color: '#18B878',
    fontSize: 14,
    fontWeight: 'bold',
  },
  arrowTextDisabled: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resendContainer: {
    alignItems: 'center',
    marginVertical: 20,
    minHeight: 24,
  },
  resendTimerText: {
    fontSize: 13,
    color: '#7F8A99',
    fontWeight: '600',
  },
  boldTimer: {
    color: '#18B878',
    fontWeight: '700',
  },
  resendActiveText: {
    color: '#18B878',
    fontSize: 13,
    fontWeight: '800',
  },
  trustContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderColor: '#EBF3F5',
    paddingTop: 18,
  },
  trustItem: {
    width: '30%',
    alignItems: 'center',
  },
  trustDivider: {
    width: 1.5,
    height: 28,
    backgroundColor: '#EBF3F5',
    alignSelf: 'center',
    opacity: 0.7,
  },
  placeholder: {
    height: 10,
  },
  
  // Custom Coded Vector Line-Art Icons Styling
  vectorIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5F8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  vectorShield: {
    width: 16,
    height: 18,
    borderWidth: 1.8,
    borderColor: '#18B878',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vectorShieldCheck: {
    width: 4,
    height: 7,
    borderBottomWidth: 1.8,
    borderRightWidth: 1.8,
    borderColor: '#18B878',
    transform: [{ rotate: '45deg' }],
    marginTop: -2,
  },
  vectorLeaf: {
    width: 14,
    height: 14,
    borderWidth: 1.8,
    borderColor: '#18B878',
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 8,
    transform: [{ rotate: '45deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  vectorLeafVein: {
    width: 10,
    height: 1.8,
    backgroundColor: '#18B878',
    transform: [{ rotate: '-45deg' }],
  },
  vectorHeadsetBand: {
    width: 14,
    height: 14,
    borderTopWidth: 1.8,
    borderLeftWidth: 1.8,
    borderRightWidth: 1.8,
    borderColor: '#18B878',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    position: 'absolute',
    top: 8,
  },
  vectorHeadsetCup: {
    width: 3,
    height: 6,
    backgroundColor: '#18B878',
    borderRadius: 1.5,
    position: 'absolute',
    bottom: 8,
  },
  trustTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7F8A99',
    textAlign: 'center',
  },
});
