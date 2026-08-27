import React, { useState } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestOtp'>;
const { width, height } = Dimensions.get('window');

// Premium Custom Coded Vector Line-Art Icons
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

export default function RequestOtpScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOtp = async () => {
    setError('');
    Keyboard.dismiss();

    const rawPhone = phone.trim();
    if (rawPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    const fullPhoneNumber = `+91${rawPhone}`;
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/otp/request', { phone: fullPhoneNumber });
      const { challengeId } = response.data;
      
      // Success -> Navigate to Verify Screen
      navigation.navigate('VerifyOtp', { challengeId, phone: fullPhoneNumber });
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed to request OTP. Please try again.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
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
          {/* Hero Section Container */}
          <View style={[styles.heroWrapper, { height: heroSectionHeight }]}>
            
            {/* Floating Language Dropdown */}
            <TouchableOpacity style={styles.languageSelector} activeOpacity={0.8}>
              <Text style={styles.languageText}>🌐 English </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            {/* Brand Typography */}
            <View style={styles.brandContainer}>
              {/* Coded double-pill brand badge */}
              <View style={styles.logoPill}>
                <View style={styles.logoGreenCircle}>
                  <Text style={styles.logoGreenCircleText}>⚡</Text>
                </View>
                <View style={styles.logoPillRightAccent} />
              </View>

              {/* Title Text */}
              <Text style={styles.brandText}>RIDE</Text>
              <Text style={styles.brandText}>FOR</Text>
              <View style={styles.youRow}>
                <Text style={[styles.brandText, styles.greenText]}>Y</Text>
                {/* Custom circle O with white bolt */}
                <View style={styles.customO}>
                  <Text style={styles.lightningBoltO}>⚡</Text>
                </View>
                <Text style={[styles.brandText, styles.greenText]}>U</Text>
              </View>

              <Text style={styles.brandSubtitle}>EV Bike Rental</Text>
              <View style={styles.greenDivider} />
              
              <Text style={styles.taglineText}>Smart rides.</Text>
              <Text style={styles.taglineText}>Sustainable future.</Text>
            </View>

            {/* Unclipped Scooter Image Overlay */}
            <Image 
              source={require('../../assets/scooter.png')} 
              style={styles.scooterImage}
            />
          </View>

          {/* 3. Floating White Neumorphic Login Card */}
          <View style={styles.loginCard}>
            <View style={styles.cardCurveAccent} />

            {/* Header inside card */}
            <View style={styles.cardHeader}>
              <View style={styles.welcomeTextGroup}>
                <Text style={styles.welcomeTitle}>Welcome back</Text>
                <Text style={styles.welcomeSubtitle}>Login to continue your journey</Text>
              </View>
              {/* Shield badge container */}
              <View style={styles.shieldBadge}>
                <Text style={styles.shieldIcon}>🛡️</Text>
              </View>
            </View>

            {/* Phone Input Box */}
            <View style={styles.inputContainer}>
              {/* Country code selector */}
              <View style={styles.countrySelector}>
                <Text style={styles.countryText}>+91</Text>
                <Text style={styles.countryArrow}>▼</Text>
              </View>

              {/* Input text box */}
              <View style={styles.textFieldContainer}>
                <Text style={styles.phoneIcon}>📞</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter mobile number"
                  placeholderTextColor="#7F8A99"
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text.replace(/[^0-9]/g, ''));
                    if (error) setError('');
                  }}
                  editable={!loading}
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Gradient Submit Button */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.submitButtonWrapper}
              onPress={handleRequestOtp}
              disabled={loading}
            >
              <LinearGradient
                colors={['#18B878', '#42D99A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Continue with OTP</Text>
                    {/* Coded soft raised neumorphic arrow pill overlapping on right */}
                    <View style={styles.arrowCircle}>
                      <Text style={styles.arrowText}>➔</Text>
                    </View>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* OR Divider */}
            <View style={styles.orDividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google signup */}
            <TouchableOpacity style={styles.googleButton} activeOpacity={0.8}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Trust badges with subtle vertical dividers */}
            <View style={styles.trustContainer}>
              <View style={styles.trustItem}>
                <ShieldIcon />
                <Text style={styles.trustTitle}>Safe & Secure</Text>
                <Text style={styles.trustSub}>Your safety is{'\n'}our priority</Text>
              </View>

              <View style={styles.trustDivider} />

              <View style={styles.trustItem}>
                <LeafIcon />
                <Text style={styles.trustTitle}>100% Electric</Text>
                <Text style={styles.trustSub}>Zero emission{'\n'}zero pollution</Text>
              </View>

              <View style={styles.trustDivider} />

              <View style={styles.trustItem}>
                <HeadsetIcon />
                <Text style={styles.trustTitle}>24/7 Support</Text>
                <Text style={styles.trustSub}>We're here{'\n'}for you</Text>
              </View>
            </View>

            {/* Create account link */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerBaseText}>
                New here?{' '}
                <Text style={styles.footerGreenLink}>Create an account</Text>
              </Text>
            </View>
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
  languageSelector: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 40,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 30,
    shadowColor: '#283C50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  languageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F3042',
  },
  dropdownArrow: {
    fontSize: 8,
    color: '#7F8A99',
    marginLeft: 3,
  },
  brandContainer: {
    marginTop: 20,
    width: width * 0.42,
    zIndex: 10,
  },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EBF3F5',
    borderRadius: 22,
    padding: 3,
    width: 64,
    height: 38,
    marginBottom: 12,
    shadowColor: '#283C50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  logoGreenCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5F8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoGreenCircleText: {
    fontSize: 16,
    color: '#18B878',
  },
  logoPillRightAccent: {
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EBF3F5',
    marginLeft: 8,
  },
  brandText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#1F3042',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  youRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenText: {
    color: '#18B878',
  },
  customO: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#18B878',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  lightningBoltO: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  brandSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7F8A99',
    marginTop: 4,
  },
  greenDivider: {
    width: 28,
    height: 3,
    backgroundColor: '#18B878',
    marginVertical: 10,
    borderRadius: 2,
  },
  taglineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7F8A99',
    lineHeight: 18,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EBF3F5',
    borderRadius: 28,
    paddingHorizontal: 16,
    height: 56,
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#283C50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  countryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F3042',
  },
  countryArrow: {
    fontSize: 8,
    color: '#7F8A99',
    marginLeft: 4,
  },
  textFieldContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EBF3F5',
    borderRadius: 28,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#283C50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  phoneIcon: {
    fontSize: 15,
    color: '#18B878',
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F3042',
    fontWeight: '600',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#17283A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  arrowText: {
    color: '#18B878',
    fontSize: 14,
    fontWeight: 'bold',
  },
  orDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#EBF3F5',
  },
  orText: {
    fontSize: 11,
    color: '#7F8A99',
    marginHorizontal: 12,
    fontWeight: '700',
  },
  googleButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EBF3F5',
    borderRadius: 28,
    height: 56,
    marginBottom: 28,
    shadowColor: '#283C50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4285F4',
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 14,
    color: '#1F3042',
    fontWeight: '700',
  },
  trustContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderColor: '#EBF3F5',
    paddingTop: 24,
    marginBottom: 24,
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
  trustTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1F3042',
    textAlign: 'center',
  },
  trustSub: {
    fontSize: 9,
    color: '#7F8A99',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 12,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  footerBaseText: {
    fontSize: 13,
    color: '#7F8A99',
    fontWeight: '500',
  },
  footerGreenLink: {
    color: '#18B878',
    fontWeight: '700',
  },
  
  // Custom Coded Vector Line-Art Icons Styling
  vectorIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5F8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  vectorShield: {
    width: 18,
    height: 20,
    borderWidth: 1.8,
    borderColor: '#18B878',
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vectorShieldCheck: {
    width: 5,
    height: 8,
    borderBottomWidth: 1.8,
    borderRightWidth: 1.8,
    borderColor: '#18B878',
    transform: [{ rotate: '45deg' }],
    marginTop: -2,
  },
  vectorLeaf: {
    width: 16,
    height: 16,
    borderWidth: 1.8,
    borderColor: '#18B878',
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 10,
    transform: [{ rotate: '45deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  vectorLeafVein: {
    width: 12,
    height: 1.8,
    backgroundColor: '#18B878',
    transform: [{ rotate: '-45deg' }],
  },
  vectorHeadsetBand: {
    width: 16,
    height: 16,
    borderTopWidth: 1.8,
    borderLeftWidth: 1.8,
    borderRightWidth: 1.8,
    borderColor: '#18B878',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    position: 'absolute',
    top: 9,
  },
  vectorHeadsetCup: {
    width: 4,
    height: 8,
    backgroundColor: '#18B878',
    borderRadius: 2,
    position: 'absolute',
    bottom: 9,
  },
});
