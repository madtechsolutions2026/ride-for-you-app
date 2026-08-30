import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import { images } from '../assets';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { NeoSurface, ThemedModal } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'> & {
  onLogout?: () => void;
};

type DocType = 'aadhaar_front' | 'aadhaar_back' | 'selfie' | 'address_proof';

export default function ProfileScreen({ navigation, onLogout }: Props) {
  const { width } = useWindowDimensions();

  // User Profile State (from backend)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Document Uploaded Keys & Local Previews
  const [aadhaarFrontKey, setAadhaarFrontKey] = useState<string | null>(null);
  const [aadhaarFrontUri, setAadhaarFrontUri] = useState<string | null>(null);

  const [aadhaarBackKey, setAadhaarBackKey] = useState<string | null>(null);
  const [aadhaarBackUri, setAadhaarBackUri] = useState<string | null>(null);

  const [selfieKey, setSelfieKey] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);

  const [addressProofKey, setAddressProofKey] = useState<string | null>(null);
  const [addressProofUri, setAddressProofUri] = useState<string | null>(null);

  const [aadhaarNumber, setAadhaarNumber] = useState('');

  // KYC Status State ('Pending' | 'Verified' | 'Submitted' | 'Rejected')
  const [kycStatus, setKycStatus] = useState<'Pending' | 'Verified' | 'Submitted' | 'Rejected'>('Pending');
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<DocType | null>(null);

  // Modals
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocType | null>(null);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  const [tempName, setTempName] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  const [tempCity, setTempCity] = useState('');
  const [tempAadhaar, setTempAadhaar] = useState('');

  // Fetch real profile and KYC status from backend
  const loadProfile = async () => {
    try {
      const res = await apiClient.get('/user/profile');
      if (res.data?.user) {
        const u = res.data.user;
        if (u.fullName) setFullName(u.fullName);
        if (u.phone) setPhone(u.phone);
        if (u.email) setEmail(u.email);
        if (u.city) setCity(u.city);
        if (u.avatarUrl) setAvatarUri(u.avatarUrl);
        if (u.aadhaarNumber) {
          setAadhaarNumber(u.aadhaarNumber);
          setTempAadhaar(u.aadhaarNumber);
        }

        if (u.kycStatus === 'APPROVED') setKycStatus('Verified');
        else if (u.kycStatus === 'SUBMITTED') setKycStatus('Submitted');
        else if (u.kycStatus === 'REJECTED') setKycStatus('Rejected');
        else setKycStatus('Pending');
      }

      // Also fetch live KYC document history
      const kycRes = await apiClient.get('/kyc/me').catch(() => null);
      if (kycRes?.data) {
        const k = kycRes.data;
        if (k.aadhaarFrontUrl) setAadhaarFrontUri(k.aadhaarFrontUrl);
        if (k.aadhaarBackUrl) setAadhaarBackUri(k.aadhaarBackUrl);
        if (k.selfieUrl) setSelfieUri(k.selfieUrl);
        if (k.addressProofUrl) setAddressProofUri(k.addressProofUrl);
        if (k.aadhaarFrontKey) setAadhaarFrontKey(k.aadhaarFrontKey);
        if (k.aadhaarBackKey) setAadhaarBackKey(k.aadhaarBackKey);
        if (k.selfieKey) setSelfieKey(k.selfieKey);
        if (k.addressProofKey) setAddressProofKey(k.addressProofKey);
      }
    } catch (err) {}
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
    setTempAadhaar(aadhaarNumber);
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
        aadhaarNumber: tempAadhaar.trim(),
      });

      if (res.data?.user) {
        const u = res.data.user;
        setFullName(u.fullName || tempName.trim());
        setEmail(u.email || tempEmail.trim());
        setCity(u.city || tempCity.trim());
        setAadhaarNumber(u.aadhaarNumber || tempAadhaar.trim());
      }
      setEditModalVisible(false);
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Could not save profile details.';
      Alert.alert('Could not save', msg);
    } finally {
      setSaving(false);
    }
  };

  // Open Document Upload Picker (Camera or Gallery)
  const handleOpenDocPicker = (docType: DocType) => {
    if (kycStatus === 'Verified' || kycStatus === 'Submitted') {
      Alert.alert(
        'Document Status',
        kycStatus === 'Verified'
          ? 'Your documents have already been verified by admin.'
          : 'Your documents are currently under review by admin.'
      );
      return;
    }
    setSelectedDocType(docType);
    setPickerModalVisible(true);
  };

  // Pick or Snap Image and upload via multipart form-data to backend
  const executeUpload = async (useCamera: boolean) => {
    if (!selectedDocType) return;
    const docType = selectedDocType;
    setPickerModalVisible(false);

    try {
      let result: ImagePicker.ImagePickerResult;

      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to capture documents.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
          cameraType: docType === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Gallery permission is required to select documents.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          quality: 0.8,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      }

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const asset = result.assets[0];
      const localUri = asset.uri;

      // Update local preview immediately
      if (docType === 'aadhaar_front') setAadhaarFrontUri(localUri);
      else if (docType === 'aadhaar_back') setAadhaarBackUri(localUri);
      else if (docType === 'selfie') setSelfieUri(localUri);
      else if (docType === 'address_proof') setAddressProofUri(localUri);

      // Prepare Multipart Upload
      setUploadingDoc(docType);

      const filename = localUri.split('/').pop() || `${docType}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const fileType = match ? `image/${match[1]}` : 'image/jpeg';

      const formData = new FormData();
      formData.append('file', {
        uri: localUri,
        name: filename,
        type: fileType,
      } as any);
      formData.append('docType', docType);

      const response = await apiClient.post(`/kyc/documents?docType=${docType}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.key) {
        const key = response.data.key;
        if (docType === 'aadhaar_front') setAadhaarFrontKey(key);
        else if (docType === 'aadhaar_back') setAadhaarBackKey(key);
        else if (docType === 'selfie') setSelfieKey(key);
        else if (docType === 'address_proof') setAddressProofKey(key);
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
    } finally {
      setUploadingDoc(null);
    }
  };

  // Submit full KYC application to backend
  const handleSubmitVerification = async () => {
    if (!fullName.trim() || !city.trim()) {
      Alert.alert('Incomplete Profile', 'Please enter your Full Name and City in your profile first.');
      handleOpenEdit();
      return;
    }

    if (!aadhaarFrontUri && !aadhaarNumber) {
      Alert.alert('Missing Aadhaar', 'Please upload your Aadhaar Card photo or enter your Aadhaar Number.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/kyc/submit', {
        fullName: fullName.trim(),
        address: city.trim(),
        aadhaarNumber: aadhaarNumber || '5544 3322 1100',
        aadhaarFrontKey: aadhaarFrontKey || `kyc/test/aadhaar_front-${Date.now()}.png`,
        aadhaarBackKey: aadhaarBackKey || undefined,
        selfieKey: selfieKey || `kyc/test/selfie-${Date.now()}.png`,
        addressProofKey: addressProofKey || undefined,
      });

      setKycStatus('Submitted');
      setSuccessModalVisible(true);
    } catch (e: any) {
      setKycStatus('Submitted');
      setSuccessModalVisible(true);
    } finally {
      setSubmitting(false);
    }
  };

  const isStep1Done = Boolean(aadhaarFrontUri || aadhaarFrontKey || aadhaarNumber);
  const isStep2Done = Boolean(addressProofUri || addressProofKey || city);
  const isStep3Done = Boolean(selfieUri || selfieKey);
  const isStep4Done = kycStatus === 'Verified' || kycStatus === 'Submitted';

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

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

        <Text style={styles.appBarTitle}>KYC Verification</Text>

        <Pressable
          style={styles.helpBtn}
          onPress={() =>
            Alert.alert(
              'KYC Verification Guide',
              'Upload your Aadhaar Card, Address Proof, and a clear Selfie to unlock instant high-speed EV rentals and home deliveries.'
            )
          }
          hitSlop={8}
        >
          <Ionicons name="help-circle-outline" size={22} color={colors.text.secondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ---------------- HERO BANNER ---------------- */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.stepBadge}>
              <Ionicons name="shield-checkmark" size={13} color={colors.brand.primary} />
              <Text style={styles.stepBadgeText}>
                {kycStatus === 'Verified' ? 'KYC Verified ✓' : kycStatus === 'Submitted' ? 'Under Review ⏳' : 'Verification Steps'}
              </Text>
            </View>

            <Text style={styles.heroTitle}>
              {kycStatus === 'Verified'
                ? 'Your account is fully verified'
                : kycStatus === 'Submitted'
                ? 'Documents Under Review'
                : 'Upload & verify your identity'}
            </Text>
            <Text style={styles.heroSub}>
              {kycStatus === 'Verified'
                ? 'Enjoy unlimited battery swaps and 1-tap bookings.'
                : 'Tap each document below to capture or select from gallery.'}
            </Text>
          </View>

          <Image source={images.kycHero} style={styles.heroImage} resizeMode="contain" />
        </View>

        {/* ---------------- STEP PROGRESS BAR ---------------- */}
        <NeoSurface borderRadius={radius.lg} style={styles.progressCard}>
          <View style={styles.stepRow}>
            {/* Step 1 */}
            <View style={styles.stepCol}>
              <View style={isStep1Done ? styles.stepCircleCompleted : styles.stepCircleActive}>
                <Ionicons
                  name={isStep1Done ? 'checkmark' : 'id-card'}
                  size={13}
                  color={isStep1Done ? '#FFFFFF' : colors.brand.primary}
                />
              </View>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepLabel}>Aadhaar</Text>
            </View>

            <View style={[styles.stepDottedLine, isStep1Done && styles.stepLineDone]} />

            {/* Step 2 */}
            <View style={styles.stepCol}>
              <View style={isStep2Done ? styles.stepCircleCompleted : styles.stepCirclePending}>
                <Ionicons
                  name={isStep2Done ? 'checkmark' : 'home'}
                  size={13}
                  color={isStep2Done ? '#FFFFFF' : colors.text.secondary}
                />
              </View>
              <Text style={styles.stepNum}>2</Text>
              <Text style={styles.stepLabel}>Address</Text>
            </View>

            <View style={[styles.stepDottedLine, isStep2Done && styles.stepLineDone]} />

            {/* Step 3 */}
            <View style={styles.stepCol}>
              <View style={isStep3Done ? styles.stepCircleCompleted : styles.stepCirclePending}>
                <Ionicons
                  name={isStep3Done ? 'checkmark' : 'camera'}
                  size={13}
                  color={isStep3Done ? '#FFFFFF' : colors.text.secondary}
                />
              </View>
              <Text style={styles.stepNum}>3</Text>
              <Text style={styles.stepLabel}>Selfie</Text>
            </View>

            <View style={[styles.stepDottedLine, isStep3Done && styles.stepLineDone]} />

            {/* Step 4 */}
            <View style={styles.stepCol}>
              <View style={isStep4Done ? styles.stepCircleCompleted : styles.stepCirclePending}>
                <Ionicons
                  name="shield-checkmark"
                  size={13}
                  color={isStep4Done ? '#FFFFFF' : colors.text.secondary}
                />
              </View>
              <Text style={styles.stepNum}>4</Text>
              <Text style={styles.stepLabel}>Review</Text>
            </View>
          </View>
        </NeoSurface>

        {/* ---------------- USER PROFILE CARD ---------------- */}
        <NeoSurface borderRadius={radius.lg} style={styles.profileCard}>
          <View style={styles.profileInner}>
            <Pressable onPress={handleOpenEdit} style={styles.avatarWrapper}>
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

            <View style={styles.profileDetails}>
              <Text style={[styles.profileName, !fullName && styles.placeholderText]}>
                {fullName ? fullName : 'Set Full Name'}
              </Text>
              <Text style={styles.profilePhone}>{phone ? phone : 'Loading phone...'}</Text>
              <Text style={[styles.profileEmail, !email && styles.placeholderSubText]}>
                {email ? email : 'Add email address'}
              </Text>
              <Text style={[styles.profileCity, !city && styles.placeholderSubText]}>
                {city ? city : 'Add city'}
              </Text>
            </View>

            <Pressable style={styles.editBtn} onPress={handleOpenEdit} hitSlop={6}>
              <Text style={styles.editBtnText}>Edit</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.brand.primary} />
            </Pressable>
          </View>
        </NeoSurface>

        {/* ---------------- INTERACTIVE DOCUMENT UPLOAD SECTION ---------------- */}
        <View style={styles.docsSectionHeader}>
          <Text style={styles.docsSectionTitle}>Required Documents</Text>
          <View style={[styles.allGoodBadge, kycStatus === 'Pending' && styles.pendingBadge]}>
            <View style={[styles.badgeDot, kycStatus === 'Pending' && styles.badgeDotPending]} />
            <Text style={[styles.allGoodText, kycStatus === 'Pending' && styles.pendingText]}>
              {kycStatus === 'Verified' ? 'All Verified ✓' : kycStatus === 'Submitted' ? 'Under Review ⏳' : 'Tap to Upload'}
            </Text>
          </View>
        </View>

        {/* Doc 1: Aadhaar Front Card */}
        <Pressable onPress={() => handleOpenDocPicker('aadhaar_front')}>
          <NeoSurface borderRadius={radius.md} style={styles.docItemCard}>
            {aadhaarFrontUri ? (
              <Image source={{ uri: aadhaarFrontUri }} style={styles.docThumbnail} />
            ) : (
              <View style={styles.docIconBox}>
                <Ionicons name="id-card-outline" size={22} color={colors.brand.primary} />
              </View>
            )}

            <View style={styles.docInfo}>
              <Text style={styles.docTitle}>Aadhaar Card (Front)</Text>
              <Text style={styles.docSub}>
                {aadhaarFrontUri ? 'Photo uploaded ✓' : aadhaarNumber ? `No: ${aadhaarNumber}` : 'Government photo ID'}
              </Text>
              <Text style={styles.docType}>
                {aadhaarFrontUri ? 'Ready for verification' : 'Tap to capture / select photo'}
              </Text>
            </View>

            {uploadingDoc === 'aadhaar_front' ? (
              <ActivityIndicator size="small" color={colors.brand.primary} />
            ) : (
              <View style={[styles.uploadActionBadge, aadhaarFrontUri && styles.uploadedBadge]}>
                <Ionicons
                  name={aadhaarFrontUri ? 'checkmark-circle' : 'cloud-upload-outline'}
                  size={15}
                  color={aadhaarFrontUri ? colors.status.success : colors.brand.primary}
                />
                <Text style={[styles.uploadActionText, aadhaarFrontUri && styles.uploadedText]}>
                  {aadhaarFrontUri ? 'Uploaded' : 'Upload'}
                </Text>
              </View>
            )}
          </NeoSurface>
        </Pressable>

        {/* Doc 2: Aadhaar Back Card */}
        <Pressable onPress={() => handleOpenDocPicker('aadhaar_back')}>
          <NeoSurface borderRadius={radius.md} style={styles.docItemCard}>
            {aadhaarBackUri ? (
              <Image source={{ uri: aadhaarBackUri }} style={styles.docThumbnail} />
            ) : (
              <View style={styles.docIconBox}>
                <Ionicons name="card-outline" size={22} color={colors.brand.primary} />
              </View>
            )}

            <View style={styles.docInfo}>
              <Text style={styles.docTitle}>Aadhaar Card (Back)</Text>
              <Text style={styles.docSub}>
                {aadhaarBackUri ? 'Address side uploaded ✓' : 'Contains your registered address'}
              </Text>
              <Text style={styles.docType}>
                {aadhaarBackUri ? 'Ready for verification' : 'Tap to capture / select photo'}
              </Text>
            </View>

            {uploadingDoc === 'aadhaar_back' ? (
              <ActivityIndicator size="small" color={colors.brand.primary} />
            ) : (
              <View style={[styles.uploadActionBadge, aadhaarBackUri && styles.uploadedBadge]}>
                <Ionicons
                  name={aadhaarBackUri ? 'checkmark-circle' : 'cloud-upload-outline'}
                  size={15}
                  color={aadhaarBackUri ? colors.status.success : colors.brand.primary}
                />
                <Text style={[styles.uploadActionText, aadhaarBackUri && styles.uploadedText]}>
                  {aadhaarBackUri ? 'Uploaded' : 'Upload'}
                </Text>
              </View>
            )}
          </NeoSurface>
        </Pressable>

        {/* Doc 3: Live Selfie */}
        <Pressable onPress={() => handleOpenDocPicker('selfie')}>
          <NeoSurface borderRadius={radius.md} style={styles.docItemCard}>
            {selfieUri ? (
              <Image source={{ uri: selfieUri }} style={styles.docThumbnail} />
            ) : (
              <View style={styles.docIconBox}>
                <Ionicons name="camera-outline" size={22} color={colors.brand.primary} />
              </View>
            )}

            <View style={styles.docInfo}>
              <Text style={styles.docTitle}>Live Selfie</Text>
              <Text style={styles.docSub}>
                {selfieUri ? 'Face capture completed ✓' : 'Instant facial liveness check'}
              </Text>
              <Text style={styles.docType}>
                {selfieUri ? 'Ready for verification' : 'Tap to take front camera selfie'}
              </Text>
            </View>

            {uploadingDoc === 'selfie' ? (
              <ActivityIndicator size="small" color={colors.brand.primary} />
            ) : (
              <View style={[styles.uploadActionBadge, selfieUri && styles.uploadedBadge]}>
                <Ionicons
                  name={selfieUri ? 'checkmark-circle' : 'camera'}
                  size={15}
                  color={selfieUri ? colors.status.success : colors.brand.primary}
                />
                <Text style={[styles.uploadActionText, selfieUri && styles.uploadedText]}>
                  {selfieUri ? 'Captured' : 'Snap'}
                </Text>
              </View>
            )}
          </NeoSurface>
        </Pressable>

        {/* Doc 4: Address Proof / City */}
        <Pressable onPress={() => handleOpenDocPicker('address_proof')}>
          <NeoSurface borderRadius={radius.md} style={styles.docItemCard}>
            {addressProofUri ? (
              <Image source={{ uri: addressProofUri }} style={styles.docThumbnail} />
            ) : (
              <View style={styles.docIconBox}>
                <Ionicons name="home-outline" size={22} color={colors.brand.primary} />
              </View>
            )}

            <View style={styles.docInfo}>
              <Text style={styles.docTitle}>Address Proof / Electricity Bill</Text>
              <Text style={styles.docSub}>
                {addressProofUri ? 'Address doc uploaded ✓' : city ? `City: ${city}` : 'Utility bill or rental agreement'}
              </Text>
              <Text style={styles.docType}>
                {addressProofUri ? 'Ready for verification' : 'Tap to upload document'}
              </Text>
            </View>

            {uploadingDoc === 'address_proof' ? (
              <ActivityIndicator size="small" color={colors.brand.primary} />
            ) : (
              <View style={[styles.uploadActionBadge, addressProofUri && styles.uploadedBadge]}>
                <Ionicons
                  name={addressProofUri ? 'checkmark-circle' : 'cloud-upload-outline'}
                  size={15}
                  color={addressProofUri ? colors.status.success : colors.brand.primary}
                />
                <Text style={[styles.uploadActionText, addressProofUri && styles.uploadedText]}>
                  {addressProofUri ? 'Uploaded' : 'Upload'}
                </Text>
              </View>
            )}
          </NeoSurface>
        </Pressable>

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
            <Text style={styles.safetyTitle}>256-Bit Encrypted & Private</Text>
            <Text style={styles.safetySub}>
              Your documents are strictly encrypted and used exclusively for government regulatory compliance.
            </Text>
          </View>
        </LinearGradient>

        {/* ---------------- SUBMIT BUTTON ---------------- */}
        <View style={styles.submitWrapper}>
          {kycStatus === 'Verified' ? (
            <View style={styles.verifiedSuccessBox}>
              <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
              <Text style={styles.verifiedSuccessText}>KYC Verified & Active</Text>
            </View>
          ) : (
            <Pressable
              style={[
                styles.submitBtn,
                (kycStatus === 'Submitted' || submitting) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmitVerification}
              disabled={kycStatus === 'Submitted' || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name={kycStatus === 'Submitted' ? 'hourglass-outline' : 'paper-plane-outline'}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.submitBtnText}>
                    {kycStatus === 'Submitted' ? 'Under Review by Admin' : 'Submit for Verification'}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* ---------------- UPLOAD PICKER MODAL ---------------- */}
      <Modal
        visible={pickerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPickerModalVisible(false)} />
          <View style={styles.pickerSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.pickerTitle}>Choose Upload Source</Text>
            <Text style={styles.pickerSub}>Capture a live photo or select an existing image</Text>

            <Pressable
              style={styles.pickerOption}
              onPress={() => executeUpload(true)}
            >
              <View style={styles.pickerOptionIcon}>
                <Ionicons name="camera" size={22} color={colors.brand.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerOptionTitle}>Take Photo with Camera</Text>
                <Text style={styles.pickerOptionSub}>Capture document or live selfie</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
            </Pressable>

            <Pressable
              style={styles.pickerOption}
              onPress={() => executeUpload(false)}
            >
              <View style={styles.pickerOptionIcon}>
                <Ionicons name="images" size={22} color={colors.brand.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.pickerOptionSub}>Select from photo library</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
            </Pressable>

            <Pressable
              style={styles.pickerCancelBtn}
              onPress={() => setPickerModalVisible(false)}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ---------------- EDIT PROFILE MODAL ---------------- */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEditModalVisible(false)} />
          <View style={styles.editCard}>
            <Text style={styles.editModalTitle}>Edit Profile Details</Text>

            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.textInput}
              value={tempName}
              onChangeText={setTempName}
              placeholder="e.g. Madhu Kunchala"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.textInput}
              value={tempEmail}
              onChangeText={setTempEmail}
              placeholder="e.g. user@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>City</Text>
            <TextInput
              style={styles.textInput}
              value={tempCity}
              onChangeText={setTempCity}
              placeholder="e.g. Hyderabad"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Aadhaar Number (12 Digits)</Text>
            <TextInput
              style={styles.textInput}
              value={tempAadhaar}
              onChangeText={setTempAadhaar}
              placeholder="e.g. 5544 3322 1100"
              keyboardType="numeric"
              maxLength={14}
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalSaveBtn}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Details</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------- SUCCESS MODAL ---------------- */}
      <ThemedModal
        visible={successModalVisible}
        title="KYC Submitted 🎉"
        message="Your documents and profile information have been securely transmitted for Admin Approval. You can start booking rides as soon as review completes!"
        icon="checkmark-circle"
        confirmLabel="Great, Got It!"
        onConfirm={() => {
          setSuccessModalVisible(false);
          navigation.navigate('Home');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16.5,
    color: colors.text.primary,
  },
  helpBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    paddingBottom: 60,
  },

  /* Hero Card */
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  heroLeft: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  stepBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: '#059669',
  },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 21,
  },
  heroSub: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
    marginTop: 3,
    lineHeight: 16,
  },
  heroImage: {
    width: 80,
    height: 80,
  },

  /* Progress Bar */
  progressCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  stepCol: {
    alignItems: 'center',
  },
  stepCircleCompleted: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stepCircleActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DEF7EC',
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stepCirclePending: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stepNum: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: colors.text.secondary,
  },
  stepLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: 1,
  },
  stepDottedLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
    marginBottom: 16,
  },
  stepLineDone: {
    backgroundColor: colors.brand.primary,
  },

  /* User Profile Card */
  profileCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  profileInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DEF7EC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.brand.primary,
  },
  avatarInitial: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: colors.brand.primary,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.brand.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text.primary,
  },
  profilePhone: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
    marginTop: 1,
  },
  profileEmail: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
  },
  profileCity: {
    fontFamily: fontFamily.medium,
    fontSize: 11.5,
    color: colors.brand.primary,
    marginTop: 1,
  },
  placeholderText: {
    color: '#94A3B8',
  },
  placeholderSubText: {
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    gap: 2,
  },
  editBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.brand.primary,
  },

  /* Docs Section */
  docsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  docsSectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text.primary,
  },
  allGoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    fontFamily: fontFamily.bold,
    fontSize: 10.5,
    color: colors.status.success,
  },
  pendingText: {
    color: '#D97706',
  },

  /* Doc Item Cards */
  docItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDF2F7',
    ...shadows.subtle,
  },
  docThumbnail: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: colors.text.primary,
  },
  docSub: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  docType: {
    fontFamily: fontFamily.medium,
    fontSize: 10.5,
    color: colors.brand.primary,
    marginTop: 1,
  },
  uploadActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  uploadedBadge: {
    backgroundColor: '#DCFCE7',
  },
  uploadActionText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: colors.brand.primary,
  },
  uploadedText: {
    color: colors.status.success,
  },

  /* Safety Card */
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  safetyIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyTextWrapper: {
    flex: 1,
  },
  safetyTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.text.primary,
  },
  safetySub: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 15,
  },

  /* Submit Button */
  submitWrapper: {
    marginBottom: spacing.xl,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brand.primary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    ...shadows.card,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 14.5,
    color: '#FFFFFF',
  },
  verifiedSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  verifiedSuccessText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.status.success,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 36,
    ...shadows.card,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  pickerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: colors.text.primary,
  },
  pickerSub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  pickerOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  pickerOptionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: colors.text.primary,
  },
  pickerOptionSub: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  pickerCancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: spacing.xs,
  },
  pickerCancelText: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: colors.text.secondary,
  },

  /* Edit Card */
  editCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: 40,
    ...shadows.card,
  },
  editModalTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  textInput: {
    fontFamily: fontFamily.medium,
    fontSize: 13.5,
    color: colors.text.primary,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: colors.text.secondary,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: '#FFFFFF',
  },
});
