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
import { unregisterPush } from '../api/push';
import { images } from '../assets';
import { colors, fontFamily, radius, screenPadding, shadows, spacing, textStyles } from '../theme';
import {
  ActiveRideCard,
  type ActiveRental,
  CategoryHubsSheet,
  Glass,
  NearbyHubsSheet,
  NeoSurface,
  NotificationSheet,
  QuickAction,
  QuickActionDivider,
  SideDrawer,
  StylizedMap,
  ThemedModal,
  type CategoryHub,
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

  // Modal & Sheet States
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [notifVisible, setNotifVisible] = useState(false);
  const [hubsSheetVisible, setHubsSheetVisible] = useState(false);
  const [categoryHubsVisible, setCategoryHubsVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'swap' | 'home'>('swap');
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const [activeRental, setActiveRental] = useState<ActiveRental | null>(null);

  const fetchActiveRental = () => {
    apiClient
      .get('/rental/rentals/active')
      .then((r) => setActiveRental(r.data?.rental ?? null))
      .catch(() => {});
  };

  const fetchProfile = () => {
    apiClient
      .get('/auth/me')
      .then((r) => {
        // /auth/me returns { user: {...} }; tolerate a bare object too.
        const u = r.data?.user ?? r.data;
        if (u) setProfile(u);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchProfile();
    fetchActiveRental();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfile();
      fetchActiveRental();
    });
    return unsubscribe;
  }, [navigation]);

  const handleConfirmLogout = async () => {
    setLogoutModalVisible(false);
    await unregisterPush();
    await clearTokens();
    onLogout();
  };

  const handleOpenCategory = (category: 'swap' | 'home') => {
    setSelectedCategory(category);
    setCategoryHubsVisible(true);
  };

  const handleSelectHub = (hub: CategoryHub) => {
    setCategoryHubsVisible(false);
    navigation.navigate('VehiclesList', {
      categoryId: selectedCategory,
      categoryTitle: selectedCategory === 'swap' ? 'Battery Swap Hubs' : 'Home Charging Hubs',
      hubId: hub.id,
      hubName: hub.name,
      hubAddress: hub.address,
    });
  };

  const cardInner = width - screenPadding * 2 - spacing.sm * 2;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ---------------- HERO HEADER ---------------- */}
        <View style={styles.hero}>
          <LinearGradient
            colors={[colors.overlay.heroFadeFrom, colors.overlay.heroFadeTo]}
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

        {/* ---------------- ACTIVE RIDE (only when one is live) ---------------- */}
        <ActiveRideCard
          rental={activeRental}
          onOpen={() => navigation.navigate('MyRental')}
          onPay={(invoiceId) => navigation.navigate('MyRental', { payInvoiceId: invoiceId })}
        />

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
              onPress={() => handleOpenCategory('swap')}
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

        {/* ---------------- TWO RENTAL CATEGORIES ---------------- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Choose Rental Category</Text>
          <Text style={styles.sectionSub}>Select a category to view nearby hubs & available bikes</Text>
        </View>

        <View style={styles.categoriesContainer}>
          {/* Category 1: Battery Swap */}
          <Pressable onPress={() => handleOpenCategory('swap')}>
            <NeoSurface borderRadius={radius.xl} style={styles.catCard}>
              <View style={styles.catCardHeader}>
                <View style={styles.catBadgeSwap}>
                  <Ionicons name="flash" size={13} color={colors.brand.primary} />
                  <Text style={styles.catBadgeSwapText}>Unlimited Swaps</Text>
                </View>
                <View style={styles.availFleetBadge}>
                  <Text style={styles.availFleetText}>29+ Bikes Nearby</Text>
                </View>
              </View>

              <View style={styles.catCardBody}>
                <Image source={images.vehicleS1} style={styles.catScooterImg} contentFit="contain" />

                <View style={styles.catInfo}>
                  <Text style={styles.catTitle}>Battery Swap Hubs</Text>
                  <Text style={styles.catDesc}>
                    Swap drained batteries in 2 minutes at 50+ metro hubs across the city with zero charging wait.
                  </Text>

                  <View style={styles.catChipsRow}>
                    <View style={styles.catChip}>
                      <Ionicons name="sync" size={11} color={colors.brand.primary} />
                      <Text style={styles.catChipText}>2-Min Swap</Text>
                    </View>
                    <View style={styles.catChip}>
                      <Ionicons name="speedometer-outline" size={11} color={colors.brand.primary} />
                      <Text style={styles.catChipText}>110 km Range</Text>
                    </View>
                  </View>

                  <View style={styles.catBtnSwap}>
                    <Text style={styles.catBtnText}>Explore Swap Hubs</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.common.white} />
                  </View>
                </View>
              </View>
            </NeoSurface>
          </Pressable>

          {/* Category 2: Home Charging */}
          <Pressable onPress={() => handleOpenCategory('home')}>
            <NeoSurface borderRadius={radius.xl} style={styles.catCard}>
              <View style={styles.catCardHeader}>
                <View style={styles.catBadgeHome}>
                  <Ionicons name="home" size={13} color={colors.status.info} />
                  <Text style={styles.catBadgeHomeText}>Home Charger Included</Text>
                </View>
                <View style={styles.availFleetBadge}>
                  <Text style={styles.availFleetText}>25+ Bikes Nearby</Text>
                </View>
              </View>

              <View style={styles.catCardBody}>
                <Image source={images.vehicleX1} style={styles.catScooterImg} contentFit="contain" />

                <View style={styles.catInfo}>
                  <Text style={styles.catTitle}>Home Charging Hubs</Text>
                  <Text style={styles.catDesc}>
                    Includes portable 3-pin fast charger. Plug into any normal wall socket overnight at home or office.
                  </Text>

                  <View style={styles.catChipsRow}>
                    <View style={styles.catChip}>
                      <Ionicons name="flash-outline" size={11} color={colors.brand.primary} />
                      <Text style={styles.catChipText}>Fast Charger</Text>
                    </View>
                    <View style={styles.catChip}>
                      <Ionicons name="speedometer-outline" size={11} color={colors.brand.primary} />
                      <Text style={styles.catChipText}>130 km Range</Text>
                    </View>
                  </View>

                  <View style={styles.catBtnHome}>
                    <Text style={styles.catBtnText}>Explore Home Hubs</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.common.white} />
                  </View>
                </View>
              </View>
            </NeoSurface>
          </Pressable>
        </View>

        {/* ---------------- SAFETY PROMISE BANNER ---------------- */}
        <View style={styles.banner}>
          <View style={styles.bannerIconHalo}>
            <Ionicons name="shield-checkmark" size={28} color={colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Ride Safe & Insured</Text>
            <Text style={styles.bannerText}>
              Sanitized helmets, 24/7 roadside assistance & full insurance on every rental.
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
                else if (t.key === 'bookings') navigation.navigate('MyBookings');
                else if (t.key === 'wallet') setDrawerVisible(true);
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
        onNavigateRental={() => navigation.navigate('MyRental')}
        onNavigateBookings={() => navigation.navigate('MyBookings')}
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

      {/* ---------------- CATEGORY HUBS SHEET ---------------- */}
      <CategoryHubsSheet
        visible={categoryHubsVisible}
        categoryId={selectedCategory}
        onClose={() => setCategoryHubsVisible(false)}
        onSelectHub={handleSelectHub}
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

  /* Categories Section */
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
  categoriesContainer: {
    paddingHorizontal: screenPadding,
    gap: spacing.md,
  },
  catCard: {
    padding: spacing.md,
    ...shadows.card,
  },
  catCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  catBadgeSwap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand.mint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  catBadgeSwapText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: colors.brand.primary,
  },
  catBadgeHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.status.infoTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  catBadgeHomeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: colors.status.info,
  },
  availFleetBadge: {
    backgroundColor: colors.neutral[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  availFleetText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10.5,
    color: colors.brand.primary,
  },
  catCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  catScooterImg: {
    width: 100,
    height: 100,
  },
  catInfo: {
    flex: 1,
  },
  catTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text.primary,
  },
  catDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.text.secondary,
    marginTop: 2,
  },
  catChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  catChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    color: colors.text.primary,
  },
  catBtnSwap: {
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
  catBtnHome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accent.teal,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  catBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.common.white,
  },

  /* Safety Banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand.mintSoft,
    borderRadius: radius.lg,
    marginHorizontal: screenPadding,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.brand.mint,
  },
  bannerIconHalo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.mint,
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
    color: colors.common.white,
    fontSize: 8.5,
    fontFamily: fontFamily.bold,
  },
});
