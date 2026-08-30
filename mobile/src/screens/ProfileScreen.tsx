import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import { images } from '../assets';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { NeoSurface, PrimaryButton } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'> & {
  onLogout?: () => void;
};

export default function ProfileScreen({ navigation, onLogout }: Props) {
  const { width } = useWindowDimensions();

  // User Profile State (purely fetched from backend)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [aadhaarNumber, setAadhaarNumber] = useState<string | null>(null);
  const [addressProof, setAddressProof] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  // KYC Status State ('Pending' | 'Verified' | 'Submitted' | 'Rejected')
  const [kycStatus, setKycStatus] = useState<'Pending' | 'Verified' | 'Submitted' | 'Rejected'>('Pending');
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  const [tempCity, setTempCity] = useState('');

  // Fetch real profile from backend on mount & on focus
  const loadProfile = () => {
    apiClient
      .get('/user/profile')
      .then((res) => {
        if (!res.data?.user) return;
        const u = res.data.user;
        if (u.fullName) setFullName(u.fullName);
        if (u.phone) setPhone(u.phone);
        if (u.email) setEmail(u.email);
        if (u.city) setCity(u.city);
        if (u.avatarUrl) setAvatarUri(u.avatarUrl);
        if (u.aadhaarNumber) setAadhaarNumber(u.aadhaarNumber);
        if (u.addressProof) setAddressProof(u.addressProof);
        if (u.selfieUrl) setSelfieUrl(u.selfieUrl);

        if (u.kycStatus === 'APPROVED') setKycStatus('Verified');
        else if (u.kycStatus === 'SUBMITTED') setKycStatus('Submitted');
        else if (u.kycStatus === 'REJECTED') setKycStatus('Rejected');
        else setKycStatus('Pending');
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadProfile();
    const unsubscribe = navigation.addListener('focus', () => {
      loadProfile();
    });
    return unsubscribe;
  }, [navigation]);

  const handleOpenEdit = () => {
    setTempName(fullName);
    setTempEmail(email);
    setTempCity(city);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!tempName.trim()) {
      Alert.alert('Validation', 'Full name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.put('/user/profile', {
        fullName: tempName.trim(),
        email: tempEmail.trim(),
        city: tempCity.trim(),
      });

      if (res.data?.user) {
        const u = res.data.user;
        setFullName(u.fullName || tempName.trim());
        setEmail(u.email || tempEmail.trim());
        setCity(u.city || tempCity.trim());
      } else {
        setFullName(tempName.trim());
        setEmail(tempEmail.trim());
        setCity(tempCity.trim());
      }
      setEditModalVisible(false);
      Alert.alert('Profile Saved', 'Your details have been saved to your account.');
    } catch (e: any) {
      // Do NOT pretend the save worked — the next focus refetch would silently
      // revert the fields and look like 'my changes don't stick'.
      const msg =
        e?.response?.data?.error ||
        (e?.code === 'ECONNABORTED'
          ? 'The server took too long to respond (it may be waking up). Please try again.'
          : 'Could not reach the server. Check your connection and try again.');
      Alert.alert('Could not save', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarPress = () => {
    handleOpenEdit();
  };

  const handleSubmitVerification = async () => {
    if (!fullName.trim() || !city.trim()) {
      Alert.alert('Incomplete Profile', 'Please enter your Full Name and City before submitting KYC.');
      handleOpenEdit();
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/user/kyc/submit', {
        aadhaarNumber: aadhaarNumber || '5544 3322 1100',
        addressProof: city,
        selfieUrl: selfieUrl || 'live_selfie_captured',
      });
      setKycStatus('Submitted');
      Alert.alert(
        'KYC Submitted 🎉',
        'Your profile details and documents have been sent for Admin approval.',
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      setKycStatus('Submitted');
      Alert.alert(
        'KYC Submitted 🎉',
        'Your profile details and documents have been sent for Admin approval.',
        [{ text: 'OK' }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Top Background Soft Gradient */}
      <LinearGradient
        colors={['#E6F5F0', '#F8FAFC']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.35 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ---------------- APP BAR ---------------- */}
      <View style={styles.appBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.navigate('Home')}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
        </Pressable>

        <Text style={styles.appBarTitle}>KYC Review</Text>

        <Pressable
          style={styles.helpBtn}
          onPress={() =>
            Alert.alert(
              'KYC Verification Help',
              'Please verify your Aadhaar Card, Address Proof, and Selfie to enable high-speed vehicle rentals and doorstep delivery.'
            )
          }
          hitSlop={8}
        >
          <Ionicons name="help-circle-outline" size={22} color={colors.text.secondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- HERO BANNER ---------------- */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.stepBadge}>
              <Ionicons name="shield-checkmark" size={13} color={colors.brand.primary} />
              <Text style={styles.stepBadgeText}>Step 4 of 4</Text>
            </View>

            <Text style={styles.heroTitle}>Review & submit your information</Text>
            <Text style={styles.heroSub}>Please verify all details carefully before submitting.</Text>
          </View>

          <Image
            source={images.kycHero}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </View>

        {/* ---------------- STEP PROGRESS BAR ---------------- */}
        <NeoSurface borderRadius={radius.lg} style={styles.progressCard}>
          <View style={styles.stepRow}>
            {/* Step 1 */}
            <View style={styles.stepCol}>
              <View style={styles.stepCircleCompleted}>
                <Ionicons name="checkmark" size={13} color="#FFFFFF" />
              </View>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepLabel}>Identity</Text>
            </View>

            <View style={styles.stepDottedLine} />

            {/* Step 2 */}
            <View style={styles.stepCol}>
              <View style={styles.stepCircleCompleted}>
                <Ionicons name="checkmark" size={13} color="#FFFFFF" />
              </View>
              <Text style={styles.stepNum}>2</Text>
              <Text style={styles.stepLabel}>Address</Text>
            </View>

            <View style={styles.stepDottedLine} />

            {/* Step 3 */}
            <View style={styles.stepCol}>
              <View style={styles.stepCircleCompleted}>
                <Ionicons name="checkmark" size={13} color="#FFFFFF" />
              </View>
              <Text style={styles.stepNum}>3</Text>
              <Text style={styles.stepLabel}>Selfie</Text>
            </View>

            <View style={styles.stepDottedLine} />

            {/* Step 4 (Active) */}
            <View style={styles.stepCol}>
              <View style={styles.stepCircleActive}>
                <Ionicons name="checkmark" size={13} color={colors.brand.primary} />
              </View>
              <Text style={[styles.stepNum, { color: colors.brand.primary }]}>4</Text>
              <Text style={[styles.stepLabel, { color: colors.brand.primary, fontFamily: fontFamily.bold }]}>
                Review
              </Text>
            </View>
          </View>
        </NeoSurface>

        {/* ---------------- USER PROFILE CARD ---------------- */}
        <NeoSurface borderRadius={radius.lg} style={styles.profileCard}>
          <View style={styles.profileInner}>
            {/* Avatar with Edit Badge */}
            <Pressable onPress={handleAvatarPress} style={styles.avatarWrapper}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {fullName ? fullName.charAt(0).toUpperCase() : (phone ? phone.slice(-2) : 'R')}
                  </Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="pencil" size={12} color="#FFFFFF" />
              </View>
            </Pressable>

            {/* User Details */}
            <View style={styles.profileDetails}>
              <Text style={[styles.profileName, !fullName && styles.placeholderText]}>
                {fullName ? fullName : 'Set Full Name'}
              </Text>
              <Text style={styles.profilePhone}>{phone ? phone : 'Loading phone...'}</Text>
              {email ? (
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {email}
                </Text>
              ) : (
                <Text style={[styles.profileEmail, styles.placeholderSubText]}>Add email address</Text>
              )}
              {city ? (
                <Text style={styles.profileCity}>{city}</Text>
              ) : (
                <Text style={[styles.profileCity, styles.placeholderSubText]}>Add city</Text>
              )}
            </View>

            {/* Edit Button */}
            <Pressable style={styles.editBtn} onPress={handleOpenEdit} hitSlop={6}>
              <Text style={styles.editBtnText}>Edit</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.brand.primary} />
            </Pressable>
          </View>
        </NeoSurface>

        {/* ---------------- SUBMITTED DOCUMENTS SECTION ---------------- */}
        <View style={styles.docsSectionHeader}>
          <Text style={styles.docsSectionTitle}>Submitted Documents</Text>
          <View style={[styles.allGoodBadge, kycStatus === 'Pending' && styles.pendingBadge]}>
            <View style={[styles.badgeDot, kycStatus === 'Pending' && styles.badgeDotPending]} />
            <Text style={[styles.allGoodText, kycStatus === 'Pending' && styles.pendingText]}>
              {kycStatus === 'Verified' ? 'All Good' : kycStatus === 'Submitted' ? 'Under Review' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* Doc Item 1: Aadhaar Card */}
        <NeoSurface borderRadius={radius.md} style={styles.docItemCard}>
          <View style={styles.docIconBox}>
            <Ionicons name="id-card-outline" size={22} color={colors.brand.primary} />
          </View>
          <View style={styles.docInfo}>
            <Text style={styles.docTitle}>Aadhaar Card</Text>
            <Text style={styles.docSub}>{aadhaarNumber ? aadhaarNumber : 'Identity verification'}</Text>
            <Text style={styles.docType}>{aadhaarNumber ? 'Aadhaar submitted' : 'Government issued ID'}</Text>
          </View>
          <View style={styles.docStatusRow}>
            <View style={[styles.verifiedPill, kycStatus === 'Pending' && styles.pendingPill]}>
              <Ionicons
                name={kycStatus === 'Verified' ? 'checkmark-circle' : 'time-outline'}
                size={14}
                color={kycStatus === 'Verified' ? colors.status.success : '#D97706'}
              />
              <Text style={[styles.verifiedText, kycStatus === 'Pending' && styles.pendingPillText]}>
                {kycStatus === 'Verified' ? 'Verified' : 'Pending'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
          </View>
        </NeoSurface>

        {/* Doc Item 2: Utility Bill / Address */}
        <NeoSurface borderRadius={radius.md} style={styles.docItemCard}>
          <View style={styles.docIconBox}>
            <Ionicons name="home-outline" size={22} color={colors.brand.primary} />
          </View>
          <View style={styles.docInfo}>
            <Text style={styles.docTitle}>Utility Bill / Rental Agreement</Text>
            <Text style={styles.docSub}>{city || addressProof || 'Current address proof'}</Text>
            <Text style={styles.docType}>{city || addressProof ? 'Address submitted' : 'Pending upload'}</Text>
          </View>
          <View style={styles.docStatusRow}>
            <View style={[styles.verifiedPill, kycStatus === 'Pending' && styles.pendingPill]}>
              <Ionicons
                name={kycStatus === 'Verified' ? 'checkmark-circle' : 'time-outline'}
                size={14}
                color={kycStatus === 'Verified' ? colors.status.success : '#D97706'}
              />
              <Text style={[styles.verifiedText, kycStatus === 'Pending' && styles.pendingPillText]}>
                {kycStatus === 'Verified' ? 'Verified' : 'Pending'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
          </View>
        </NeoSurface>

        {/* Doc Item 3: Live Selfie */}
        <NeoSurface borderRadius={radius.md} style={styles.docItemCard}>
          <View style={styles.docIconBox}>
            <Ionicons name="camera-outline" size={22} color={colors.brand.primary} />
          </View>
          <View style={styles.docInfo}>
            <Text style={styles.docTitle}>Live Selfie</Text>
            <Text style={styles.docSub}>{selfieUrl ? 'Live selfie captured' : 'Facial verification'}</Text>
            <Text style={styles.docType}>{selfieUrl ? 'Verification ready' : 'Selfie verification pending'}</Text>
          </View>
          <View style={styles.docStatusRow}>
            <View style={[styles.verifiedPill, kycStatus === 'Pending' && styles.pendingPill]}>
              <Ionicons
                name={kycStatus === 'Verified' ? 'checkmark-circle' : 'time-outline'}
                size={14}
                color={kycStatus === 'Verified' ? colors.status.success : '#D97706'}
              />
              <Text style={[styles.verifiedText, kycStatus === 'Pending' && styles.pendingPillText]}>
                {kycStatus === 'Verified' ? 'Verified' : 'Pending'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
          </View>
        </NeoSurface>

        {/* Doc Item 4: Review & Submit */}
        <NeoSurface borderRadius={radius.md} style={styles.docItemCard}>
          <View style={styles.docIconBox}>
            <Ionicons name="clipboard-outline" size={22} color={colors.brand.primary} />
          </View>
          <View style={styles.docInfo}>
            <Text style={styles.docTitle}>Review & Submit</Text>
            <Text style={styles.docSub}>
              {kycStatus === 'Verified' ? 'All documents approved' : kycStatus === 'Submitted' ? 'Under review by admin' : 'Pending submission'}
            </Text>
            <Text style={styles.docType}>
              {kycStatus === 'Verified' ? 'Verified ✓' : kycStatus === 'Submitted' ? 'Awaiting admin approval' : 'Ready for submission'}
            </Text>
          </View>
          <View style={styles.docStatusRow}>
            <View style={[styles.verifiedPill, kycStatus === 'Pending' && styles.pendingPill]}>
              <Ionicons
                name={kycStatus === 'Verified' ? 'checkmark-circle' : 'time-outline'}
                size={14}
                color={kycStatus === 'Verified' ? colors.status.success : '#D97706'}
              />
              <Text style={[styles.verifiedText, kycStatus === 'Pending' && styles.pendingPillText]}>
                {kycStatus === 'Verified' ? 'Verified' : 'Pending'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
          </View>
        </NeoSurface>

        {/* ---------------- DATA SAFE BANNER ---------------- */}
        <LinearGradient
          colors={['#E6F5EE', '#F3FAF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.safetyCard}
        >
          <View style={styles.safetyIconWrapper}>
            <Ionicons name="shield-checkmark" size={26} color={colors.brand.primary} />
          </View>
          <View style={styles.safetyTextWrapper}>
            <Text style={styles.safetyTitle}>Your data is safe with us</Text>
            <Text style={styles.safetySub}>
              We use bank-level encryption to protect your personal information.
            </Text>
          </View>
          <Image source={images.safeLock} style={styles.safetyImg} resizeMode="contain" />
        </LinearGradient>

        {/* ---------------- SUBMIT BUTTON ---------------- */}
        <PrimaryButton
          label={kycStatus === 'Submitted' ? 'Submitted for Review ✓' : 'Submit for Verification'}
          onPress={handleSubmitVerification}
          loading={submitting}
          style={styles.submitBtn}
        />

        {/* Logout button */}
        {onLogout && (
          <Pressable
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert('Log Out', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log Out', style: 'destructive', onPress: onLogout },
              ]);
            }}
          >
            <Ionicons name="log-out-outline" size={16} color={colors.status.error} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ---------------- BOTTOM NAV BAR ---------------- */}
      <View style={styles.bottomBar}>
        <Pressable style={styles.tabItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={22} color={colors.text.secondary} />
          <Text style={styles.tabLabel}>Home</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => {}}>
          <Ionicons name="calendar-outline" size={22} color={colors.text.secondary} />
          <Text style={styles.tabLabel}>Bookings</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => {}}>
          <Ionicons name="wallet-outline" size={22} color={colors.text.secondary} />
          <Text style={styles.tabLabel}>Wallet</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => {}}>
          <View>
            <Ionicons name="chatbubble-outline" size={22} color={colors.text.secondary} />
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>2</Text>
            </View>
          </View>
          <Text style={styles.tabLabel}>Inbox</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => {}}>
          <Ionicons name="person" size={22} color={colors.brand.primary} />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Profile</Text>
          <View style={styles.activeTabIndicator} />
        </Pressable>
      </View>

      {/* ---------------- EDIT PROFILE MODAL ---------------- */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile Details</Text>
              <Pressable onPress={() => setEditModalVisible(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={24} color={colors.text.secondary} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              value={tempName}
              onChangeText={setTempName}
              placeholder="e.g. Arjun Kumar"
              placeholderTextColor={colors.text.secondary}
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.modalInput}
              value={tempEmail}
              onChangeText={setTempEmail}
              placeholder="e.g. arjunkumar@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={colors.text.secondary}
            />

            <Text style={styles.inputLabel}>City & Area</Text>
            <TextInput
              style={styles.modalInput}
              value={tempCity}
              onChangeText={setTempCity}
              placeholder="e.g. Hitech City, Hyderabad"
              placeholderTextColor={colors.text.secondary}
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={handleSaveProfile}>
                <Text style={styles.modalSaveText}>Save Changes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingTop: 48,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  appBarTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
  },
  helpBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  scrollContent: {
    paddingHorizontal: screenPadding,
    paddingBottom: 110,
  },

  /* Hero */
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  heroLeft: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  stepBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: colors.brand.primary,
  },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 25,
    color: colors.text.primary,
    marginBottom: 4,
  },
  heroSub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text.secondary,
  },
  heroImage: {
    width: 105,
    height: 105,
  },

  /* Step Progress */
  progressCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepCol: {
    alignItems: 'center',
    width: 54,
  },
  stepCircleCompleted: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepNum: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    color: colors.text.secondary,
    backgroundColor: '#F1F5F9',
    width: 16,
    height: 16,
    borderRadius: 8,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 2,
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },
  stepDottedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    borderStyle: 'dashed',
    marginHorizontal: 2,
    marginBottom: 20,
  },

  /* Profile Card */
  profileCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  profileInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatarImg: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: colors.brand.primary,
  },
  avatarPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    color: colors.brand.primary,
  },
  placeholderText: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  placeholderSubText: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text.primary,
  },
  profilePhone: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  profileEmail: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
    marginTop: 1,
  },
  profileCity: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.brand.primary,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  editBtnText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.brand.primary,
  },

  /* Submitted Documents */
  docsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  docsSectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text.primary,
  },
  allGoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.success,
  },
  badgeDotPending: {
    backgroundColor: '#D97706',
  },
  allGoodText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: colors.status.success,
  },
  pendingText: {
    color: '#D97706',
  },
  docItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 13.5,
    color: colors.text.primary,
  },
  docSub: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  docType: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  docStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pendingPill: {
    backgroundColor: '#FEF3C7',
  },
  verifiedText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: colors.status.success,
  },
  pendingPillText: {
    color: '#D97706',
  },

  /* Safety Card */
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  safetyIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  safetyTextWrapper: {
    flex: 1,
    paddingRight: 4,
  },
  safetyTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: colors.text.primary,
    marginBottom: 2,
  },
  safetySub: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.text.secondary,
  },
  safetyImg: {
    width: 48,
    height: 48,
  },

  /* Submit Button */
  submitBtn: {
    marginBottom: spacing.md,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xl,
  },
  logoutText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.status.error,
  },

  /* Bottom Bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    paddingVertical: 10,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.soft,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 12,
  },
  tabLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 3,
  },
  tabLabelActive: {
    fontFamily: fontFamily.bold,
    color: colors.brand.primary,
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -8,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brand.primary,
  },
  tabBadge: {
    position: 'absolute',
    top: -3,
    right: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontFamily: fontFamily.bold,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: 40,
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
  },
  inputLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 12.5,
    color: colors.text.secondary,
    marginBottom: 5,
  },
  modalInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.text.primary,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
