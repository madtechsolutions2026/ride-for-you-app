import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../api/client';
import { clearTokens } from '../api/tokenStore';

type Props = {
  onLogout: () => void;
};

interface UserProfile {
  id: string;
  phone: string;
  role: string;
  accountStatus: string;
}

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ onLogout }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [selectedHub, setSelectedHub] = useState<string | null>('Greenville Hub');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await apiClient.get('/auth/me');
        setProfile(response.data);
      } catch (err: any) {
        const errMsg = err.response?.data?.error || 'Failed to fetch user profile';
        setError(errMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiClient.post('/auth/logout', {});
    } catch (err) {
      console.warn('Backend logout api failed:', err);
    } finally {
      await clearTokens();
      setLoggingOut(false);
      onLogout();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#20C77A" />
          <Text style={styles.loadingText}>Loading EV Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.mainContainer}>
      
      {/* 1. STYLIZED SIMULATED GPS MAP CANVAS */}
      <View style={styles.mapCanvas}>
        {/* Abstract Dark Grid & Coordinates */}
        <View style={styles.mapGridLineH1} />
        <View style={styles.mapGridLineH2} />
        <View style={styles.mapGridLineV1} />
        <View style={styles.mapGridLineV2} />
        
        {/* Abstract roads (vector boxes) */}
        <View style={[styles.mapRoad, { top: height * 0.12, height: 28, width: '100%' }]} />
        <View style={[styles.mapRoad, { left: width * 0.45, width: 32, height: '60%' }]} />

        {/* EV Station Pins & Nearby Bikes */}
        
        {/* Hub A - Greenville Hub */}
        <TouchableOpacity 
          style={[styles.stationPin, { top: height * 0.08, left: width * 0.15 }]}
          onPress={() => setSelectedHub('Greenville Hub')}
          activeOpacity={0.8}
        >
          <View style={[styles.pinDot, selectedHub === 'Greenville Hub' ? styles.pinDotActive : null]} />
          <View style={styles.pinBubble}>
            <Text style={styles.pinText}>⚡ Greenville (3)</Text>
          </View>
        </TouchableOpacity>

        {/* Floating bike indicator near Greenville */}
        <View style={[styles.bikeIndicator, { top: height * 0.15, left: width * 0.22 }]}>
          <Text style={styles.bikeEmoji}>🚲</Text>
          <View style={[styles.batteryBadge, { backgroundColor: '#20C77A' }]}>
            <Text style={styles.batteryText}>92%</Text>
          </View>
        </View>

        {/* Hub B - Downtown Central */}
        <TouchableOpacity 
          style={[styles.stationPin, { top: height * 0.22, left: width * 0.58 }]}
          onPress={() => setSelectedHub('Downtown Central')}
          activeOpacity={0.8}
        >
          <View style={[styles.pinDot, selectedHub === 'Downtown Central' ? styles.pinDotActive : null]} />
          <View style={styles.pinBubble}>
            <Text style={styles.pinText}>⚡ Downtown (5)</Text>
          </View>
        </TouchableOpacity>

        {/* Floating bike indicator near Downtown */}
        <View style={[styles.bikeIndicator, { top: height * 0.26, left: width * 0.52 }]}>
          <Text style={styles.bikeEmoji}>🚲</Text>
          <View style={[styles.batteryBadge, { backgroundColor: '#eab308' }]}>
            <Text style={styles.batteryText}>45%</Text>
          </View>
        </View>
      </View>

      {/* Header HUD Overlay */}
      <SafeAreaView style={styles.hudOverlay}>
        <View style={styles.hudHeader}>
          <View style={styles.hudUserContainer}>
            <View style={styles.hudAvatar}>
              <Text style={styles.hudAvatarText}>⚡</Text>
            </View>
            <View>
              <Text style={styles.hudUserLabel}>RIDER ACCOUNT</Text>
              <Text style={styles.hudUserPhone}>{profile?.phone || 'Guest Rider'}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.hudSupportButton}>
            <Text style={styles.hudSupportText}>🎧 Support</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* 2. STYLISH BOTTOM DASHBOARD PANEL */}
      <View style={styles.dashboardPanel}>
        <View style={styles.cardCurveAccent} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Welcome Title */}
          <Text style={styles.dashboardTitle}>Rent an Electric Bike</Text>
          <Text style={styles.dashboardSubtitle}>Locate a nearby hub, unlock, and ride clean.</Text>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* 3. KYC ONBOARDING CARD (Product Flow Requirement) */}
          <LinearGradient
            colors={['#fffbeb', '#fef3c7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.kycCard}
          >
            <View style={styles.kycHeaderRow}>
              <Text style={styles.kycBadgeText}>⚡ ACTION REQUIRED</Text>
              <Text style={styles.kycStatusTag}>PENDING</Text>
            </View>
            <Text style={styles.kycTitle}>KYC Verification Required</Text>
            <Text style={styles.kycText}>
              In accordance with V1 guidelines, you must upload your Driving Licence and Aadhaar card to unlock EV rentals.
            </Text>
            <TouchableOpacity style={styles.kycButton} activeOpacity={0.8}>
              <Text style={styles.kycButtonText}>Complete KYC Profile →</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Selected Station Specifications */}
          <View style={styles.stationInfoSection}>
            <Text style={styles.sectionHeader}>Selected Station</Text>
            <View style={styles.stationDetailCard}>
              <View style={styles.stationRow}>
                <Text style={styles.stationName}>{selectedHub || 'Select a hub on map'}</Text>
                <Text style={styles.stationDistance}>• 150m away</Text>
              </View>
              
              <View style={styles.stationStatusGrid}>
                <View style={styles.statusItem}>
                  <Text style={styles.statusNumber}>
                    {selectedHub === 'Greenville Hub' ? '3' : '5'}
                  </Text>
                  <Text style={styles.statusLabel}>EV Bikes Available</Text>
                </View>
                <View style={styles.statusItem}>
                  <Text style={styles.statusNumber}>
                    {selectedHub === 'Greenville Hub' ? '2' : '1'}
                  </Text>
                  <Text style={styles.statusLabel}>Charging Docks Free</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.bookCTA} activeOpacity={0.9}>
                <LinearGradient
                  colors={['#20C77A', '#10B981']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.bookCTAGradient}
                >
                  <Text style={styles.bookCTAText}>Reserve Bike at Station</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* User Account details */}
          <View style={styles.credentialsCard}>
            <Text style={styles.sectionHeader}>Rider Metadata</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>ID</Text>
              <Text style={styles.metaValue} numberOfLines={1}>{profile?.id}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Role</Text>
              <Text style={styles.roleTag}>{profile?.role}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Account Status</Text>
              <Text style={styles.statusTag}>{profile?.accountStatus}</Text>
            </View>
          </View>

          {/* Logout Section */}
          <TouchableOpacity
            style={[styles.logoutButton, loggingOut ? styles.logoutButtonDisabled : null]}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.8}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Text style={styles.logoutButtonText}>Log Out Session</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#0f172a', // deep slate base
  },
  safeArea: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  mapCanvas: {
    width: width,
    height: height * 0.45,
    backgroundColor: '#0f172a', // Sleek dark map canvas
    position: 'absolute',
    top: 0,
  },
  mapGridLineH1: {
    position: 'absolute',
    top: height * 0.15,
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mapGridLineH2: {
    position: 'absolute',
    top: height * 0.3,
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mapGridLineV1: {
    position: 'absolute',
    left: width * 0.33,
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mapGridLineV2: {
    position: 'absolute',
    left: width * 0.66,
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mapRoad: {
    position: 'absolute',
    backgroundColor: '#1e293b',
    opacity: 0.8,
    borderRadius: 8,
  },
  stationPin: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#20C77A',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#20C77A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  pinDotActive: {
    backgroundColor: '#3b82f6', // highlight blue
    scaleX: 1.2,
    scaleY: 1.2,
  },
  pinBubble: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  pinText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bikeIndicator: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bikeEmoji: {
    fontSize: 12,
    marginRight: 2,
  },
  batteryBadge: {
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  batteryText: {
    fontSize: 9,
    fontWeight: '950',
    color: '#FFFFFF',
  },
  hudOverlay: {
    position: 'absolute',
    top: 0,
    width: width,
    zIndex: 20,
  },
  hudHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: Platform.OS === 'android' ? 15 : 0,
    alignItems: 'center',
  },
  hudUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  hudAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#20C77A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  hudAvatarText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  hudUserLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },
  hudUserPhone: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hudSupportButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  hudSupportText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dashboardPanel: {
    flex: 1,
    marginTop: height * 0.35,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 24,
  },
  cardCurveAccent: {
    width: 48,
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  dashboardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#17283A',
  },
  dashboardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 20,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  kycCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  kycHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kycBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#b45309',
  },
  kycStatusTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#b45309',
    backgroundColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  kycTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#78350f',
    marginBottom: 6,
  },
  kycText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 12,
  },
  kycButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#78350f',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  kycButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  stationInfoSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  stationDetailCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#17283A',
  },
  stationDistance: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 6,
    fontWeight: '500',
  },
  stationStatusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusItem: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statusNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#17283A',
  },
  statusLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  bookCTA: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  bookCTAGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  bookCTAText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  credentialsCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  metaLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 13,
    color: '#17283A',
    fontWeight: '700',
    maxWidth: '65%',
  },
  roleTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#20C77A',
    backgroundColor: '#DDF8ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10b981',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  logoutButton: {
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff5f5',
  },
  logoutButtonDisabled: {
    opacity: 0.5,
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
  },
});
