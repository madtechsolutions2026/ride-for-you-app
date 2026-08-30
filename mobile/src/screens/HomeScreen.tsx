import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import { clearTokens } from '../api/tokenStore';
import { images } from '../assets';
import { colors, fontFamily, radius, screenPadding, shadows, spacing, textStyles } from '../theme';
import {
  Glass,
  NeoSurface,
  NearbyHubsSheet,
  NotificationSheet,
  QuickAction,
  QuickActionDivider,
  SideDrawer,
  StylizedMap,
  ThemedModal,
  type MapStation,
} from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'> & {
  onLogout: () => void;
};

type UserProfile = {
  id: string;
  phone: string;
  fullName?: string | null;
  role: string;
  accountStatus: string;
  kycStatus?: string;
};

const STATIONS: MapStation[] = [
  { id: 's1', x: 0.2, y: 0.35, available: 14, name: 'Hitech Metro Hub' },
  { id: 's2', x: 0.68, y: 0.28, available: 9, name: 'Cyber Towers Hub' },
  { id: 's3', x: 0.45, y: 0.72, available: 6, name: 'Bio-Diversity Hub' },
];

const TABS = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'bookings', icon: 'receipt-outline', label: 'Bookings' },
  { key: 'wallet', icon: 'wallet-outline', label: 'Wallet' },
  { key: 'inbox', icon: 'chatbubble-outline', label: 'Inbox', badge: '2' },
  { key: 'profile', icon: 'person-outline', label: 'Profile' },
] as const;

export default function HomeScreen({ navigation, onLogout }: Props) {
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Modal / Sheet States
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [notifVisible, setNotifVisible] = useState(false);
  const [hubsSheetVisible, setHubsSheetVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'swap' | 'home'>('swap');

  const fetchProfile = () => {
    apiClient
      .get('/auth/me')
      .then((r) => {
        if (r.data) setProfile(r.data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchProfile();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfile();
    });
    return unsubscribe;
  }, [navigation]);

  const handleConfirmLogout = async () => {
    setLogoutModalVisible(false);
    await clearTokens();
    onLogout();
  };

  const handleBookVehicle = (plan: 'swap' | 'home') => {
    setSelectedPlan(plan);
    setBookingModalVisible(true);
  };

  const cardInner = width - screenPadding * 2 - spacing.sm * 2;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ---------------- HERO HEADER ---------------- */}
        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(211,232,224,0.55)', 'rgba(239,242,240,0)']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.3, y: 0.7 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Image source={images.heroScooter} style={styles.heroImg} contentFit="contain" />

          <View style={styles.heroContent} pointerEvents="box-none">
            <View style={styles.topRow}>
              <Pressable onPress={() => setDrawerVisible(true)} hitSlop={6}>
                <Glass borderRadius={radius.md} style={styles.iconBtn}>
                  <Ionicons name="menu" size={22} color={colors.text.primary} />
                </Glass>
              </Pressable>

              <Pressable onPress={() => setNotifVisible(true)} hitSlop={6}>
                <Glass borderRadius={radius.md} style={styles.iconBtn}>
                  <Ionicons name="notifications-outline" size={20} color={colors.text.primary} />
                  <View style={styles.notifDot} />
                </Glass>
              </Pressable>
            </View>

            <Text style={styles.hello}>
              Hello, {profile?.fullName?.trim() ? profile.fullName.trim() : 'Rider'} 👋
            </Text>
            <Text style={styles.h1}>Where are you</Text>
            <Text style={[styles.h1, styles.h1green]}>going today?</Text>
            <Text style={styles.tagline}>Smart rides. Sustainable future.</Text>
          </View>
        </View>

        {/* ---------------- ENLARGED MAP + QUICK ACTIONS ---------------- */}
        <NeoSurface borderRadius={radius.lg} style={styles.mapCard}>
          <StylizedMap width={cardInner} height={250} stations={STATIONS} />
          
          <View style={styles.actionsRow}>
            <QuickAction
              icon="bicycle-outline"
              label={'Nearby\nStations'}
              onPress={() => setHubsSheetVisible(true)}
            />
            <QuickActionDivider />
            <QuickAction
              icon="battery-charging-outline"
              label={'Battery\nSwap'}
              badge="New"
              onPress={() => handleBookVehicle('swap')}
            />
            <QuickActionDivider />
            <QuickAction
              icon="headset-outline"
              label={'Support\n24/7'}
              onPress={() => setDrawerVisible(true)}
            />
            <QuickActionDivider />
            <QuickAction
              icon="pricetag-outline"
              label={'Offers &\nDeals'}
              badge="New"
              onPress={() => setNotifVisible(true)}
            />
          </View>
        </NeoSurface>

        {/* ---------------- TWO DEDICATED EV MODEL OPTIONS ---------------- */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Choose Your EV Model</Text>
            <Text style={styles.sectionSub}>Pick the rental plan that fits your commute</Text>
          </View>
        </View>

        <View style={styles.modelsContainer}>
          {/* Option 1: Battery Swap Model */}
          <NeoSurface borderRadius={radius.xl} style={styles.modelCard}>
            <View style={styles.modelCardTop}>
              <View style={styles.modelTagSwap}>
                <Ionicons name="flash" size={13} color="#059669" />
                <Text style={styles.modelTagSwapText}>Unlimited Battery Swaps</Text>
              </View>
              <View style={styles.modelPriceBadge}>
                <Text style={styles.priceSymbol}>₹</Text>
                <Text style={styles.priceAmount}>249</Text>
                <Text style={styles.pricePeriod}>/day</Text>
              </View>
            </View>

            <View style={styles.modelBody}>
              <Image source={images.vehicleS1} style={styles.modelImage} contentFit="contain" />

              <View style={styles.modelDetails}>
                <Text style={styles.modelTitle}>RFY Swapper S1</Text>
                <Text style={styles.modelDescription}>
                  Swap depleted batteries in 2 mins at any metro hub with zero charging wait.
                </Text>

                <View style={styles.specChipsRow}>
                  <View style={styles.specChip}>
                    <Ionicons name="speedometer-outline" size={12} color={colors.brand.primary} />
                    <Text style={styles.specChipText}>110 km Range</Text>
                  </View>
                  <View style={styles.specChip}>
                    <Ionicons name="hardware-chip-outline" size={12} color={colors.brand.primary} />
                    <Text style={styles.specChipText}>50 km/h Top</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.bookBtnSwap}
                  onPress={() => handleBookVehicle('swap')}
                  hitSlop={4}
                >
                  <Text style={styles.bookBtnText}>Book Swapper S1</Text>
                  <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </NeoSurface>

          {/* Option 2: Home Charging Model */}
          <NeoSurface borderRadius={radius.xl} style={styles.modelCard}>
            <View style={styles.modelCardTop}>
              <View style={styles.modelTagHome}>
                <Ionicons name="home" size={13} color="#0284C7" />
                <Text style={styles.modelTagHomeText}>Home Fast Charger Included</Text>
              </View>
              <View style={styles.modelPriceBadge}>
                <Text style={styles.priceSymbol}>₹</Text>
                <Text style={styles.priceAmount}>299</Text>
                <Text style={styles.pricePeriod}>/day</Text>
              </View>
            </View>

            <View style={styles.modelBody}>
              <Image source={images.vehicleX1} style={styles.modelImage} contentFit="contain" />

              <View style={styles.modelDetails}>
                <Text style={styles.modelTitle}>RFY Home Pro X1</Text>
                <Text style={styles.modelDescription}>
                  Includes portable 3-pin charger. Plug into any normal wall socket overnight.
                </Text>

                <View style={styles.specChipsRow}>
                  <View style={styles.specChip}>
                    <Ionicons name="speedometer-outline" size={12} color={colors.brand.primary} />
                    <Text style={styles.specChipText}>130 km Range</Text>
                  </View>
                  <View style={styles.specChip}>
                    <Ionicons name="hardware-chip-outline" size={12} color={colors.brand.primary} />
                    <Text style={styles.specChipText}>55 km/h Top</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.bookBtnHome}
                  onPress={() => handleBookVehicle('home')}
                  hitSlop={4}
                >
                  <Text style={styles.bookBtnText}>Book Home Pro X1</Text>
                  <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </NeoSurface>
        </View>

        {/* ---------------- SAFETY PROMISE BANNER ---------------- */}
        <View style={styles.banner}>
          <View style={styles.bannerIconHalo}>
            <Ionicons name="shield-checkmark" size={28} color={colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Ride Safe & Insured</Text>
            <Text style={styles.bannerText}>
              Sanitized helmets, 24/7 roadside assistance & full coverage on every ride.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ---------------- UNIFIED BOTTOM TAB BAR ---------------- */}
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.key === 'home';
          return (
            <Pressable
              key={t.key}
              style={styles.tab}
              hitSlop={6}
              onPress={() => {
                if (t.key === 'profile') navigation.navigate('Profile');
                else if (t.key === 'inbox') setNotifVisible(true);
                else if (t.key === 'bookings' || t.key === 'wallet') setDrawerVisible(true);
              }}
            >
              <View>
                <Ionicons
                  name={(active ? 'home' : t.icon) as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={active ? colors.brand.primary : colors.text.secondary}
                />
                {'badge' in t && t.badge ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{t.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              {active ? <View style={styles.tabActiveBar} /> : null}
            </Pressable>
          );
        })}
      </View>

      {/* ---------------- SIDE DRAWER MENU ---------------- */}
      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        userName={profile?.fullName || undefined}
        userPhone={profile?.phone || undefined}
        kycStatus={profile?.kycStatus || undefined}
        onNavigateProfile={() => navigation.navigate('Profile')}
        onLogout={() => setLogoutModalVisible(true)}
      />

      {/* ---------------- NOTIFICATION SHEET ---------------- */}
      <NotificationSheet
        visible={notifVisible}
        onClose={() => setNotifVisible(false)}
      />

      {/* ---------------- NEARBY HUBS SHEET ---------------- */}
      <NearbyHubsSheet
        visible={hubsSheetVisible}
        onClose={() => setHubsSheetVisible(false)}
      />

      {/* ---------------- THEMED LOGOUT MODAL ---------------- */}
      <ThemedModal
        visible={logoutModalVisible}
        title="Log Out"
        message="Are you sure you want to end your current session? You will need to verify your phone number to log back in."
        icon="log-out-outline"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        isDestructive
        onConfirm={handleConfirmLogout}
        onCancel={() => setLogoutModalVisible(false)}
      />

      {/* ---------------- BOOKING INTENT MODAL ---------------- */}
      <ThemedModal
        visible={bookingModalVisible}
        title={selectedPlan === 'swap' ? 'RFY Swapper S1' : 'RFY Home Pro X1'}
        message={
          selectedPlan === 'swap'
            ? 'Unlimited battery swaps included. Collect at any nearby station in under 2 minutes!'
            : 'Portable charger included for hassle-free home/office charging with 130 km range.'
        }
        icon={selectedPlan === 'swap' ? 'flash' : 'home'}
        confirmLabel="Proceed to KYC Review"
        cancelLabel="Back"
        onConfirm={() => {
          setBookingModalVisible(false);
          navigation.navigate('Profile');
        }}
        onCancel={() => setBookingModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { paddingBottom: 90 },

  /* Hero */
  hero: { height: 290, width: '100%' },
  heroImg: { position: 'absolute', right: -26, top: 62, width: '52%', height: 200 },
  heroContent: { flex: 1, paddingHorizontal: screenPadding, paddingTop: 48 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadows.subtle,
  },
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.primary,
  },
  hello: {
    fontFamily: fontFamily.semibold,
    fontSize: 14.5,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  h1: { ...textStyles.h1, color: colors.text.primary },
  h1green: { color: colors.brand.primary },
  tagline: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 3,
  },

  /* Map Card */
  mapCard: {
    marginHorizontal: screenPadding,
    marginTop: spacing.sm,
    padding: spacing.sm,
    ...shadows.card,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },

  /* Dedicated Models Section */
  sectionHeader: {
    marginHorizontal: screenPadding,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...textStyles.h2, color: colors.text.primary },
  sectionSub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  modelsContainer: {
    paddingHorizontal: screenPadding,
    gap: spacing.md,
  },
  modelCard: {
    padding: spacing.md,
    ...shadows.card,
  },
  modelCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modelTagSwap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  modelTagSwapText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: '#059669',
  },
  modelTagHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  modelTagHomeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: '#0284C7',
  },
  modelPriceBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceSymbol: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.brand.primary,
  },
  priceAmount: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
  },
  pricePeriod: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.text.secondary,
  },
  modelBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modelImage: {
    width: 100,
    height: 100,
  },
  modelDetails: {
    flex: 1,
  },
  modelTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text.primary,
  },
  modelDescription: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.text.secondary,
    marginTop: 2,
  },
  specChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  specChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10.5,
    color: colors.text.primary,
  },
  bookBtnSwap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brand.primary,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  bookBtnHome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F766E',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  bookBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },

  /* Safety Banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#ECFDF5',
    borderRadius: radius.lg,
    marginHorizontal: screenPadding,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  bannerIconHalo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: colors.text.primary,
  },
  bannerText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.text.secondary,
    marginTop: 2,
  },

  /* Tab Bar */
  tabBar: {
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
  tab: {
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
  tabActiveBar: {
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
});
