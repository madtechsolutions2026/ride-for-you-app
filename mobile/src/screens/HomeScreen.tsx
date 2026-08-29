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

import { apiClient } from '../api/client';
import { clearTokens } from '../api/tokenStore';
import { images } from '../assets';
import { colors, fontFamily, radius, screenPadding, spacing, textStyles } from '../theme';
import {
  Glass,
  NeoSurface,
  QuickAction,
  QuickActionDivider,
  StylizedMap,
  VehicleCard,
  type MapStation,
  type Vehicle,
} from '../components';

type Props = { onLogout: () => void };

type UserProfile = { id: string; phone: string; role: string; accountStatus: string };

// --- mock data (TODO: replace with /vehicles + /stations once the backend has them) ---
const STATIONS: MapStation[] = [
  { id: 's1', x: 0.2, y: 0.42, available: 12 },
  { id: 's2', x: 0.66, y: 0.26, available: 8 },
  { id: 's3', x: 0.42, y: 0.68, available: 5 },
];

const VEHICLES: Vehicle[] = [
  { id: 'rfy-s1', name: 'RFY S1', rangeKm: 110, topSpeed: 50, pricePerDay: 249, image: images.vehicleS1, popular: true },
  { id: 'rfy-x1', name: 'RFY X1', rangeKm: 120, topSpeed: 55, pricePerDay: 299, image: images.vehicleX1 },
  { id: 'rfy-z1', name: 'RFY Z1', rangeKm: 90, topSpeed: 45, pricePerDay: 199, image: images.vehicleZ1 },
];

const TABS = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'bookings', icon: 'receipt-outline', label: 'Bookings' },
  { key: 'wallet', icon: 'wallet-outline', label: 'Wallet' },
  { key: 'inbox', icon: 'chatbubble-outline', label: 'Inbox', badge: '2' },
  { key: 'profile', icon: 'person-outline', label: 'Profile' },
] as const;

export default function HomeScreen({ onLogout }: Props) {
  const { width } = useWindowDimensions();
  const [, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    // keeps the access token warm and proves the session is still valid
    apiClient
      .get('/auth/me')
      .then((r) => setProfile(r.data))
      .catch(() => {});
  }, []);

  const handleProfileTab = async () => {
    // TEMP: no Profile screen yet — long-press logs out.
    await clearTokens();
    onLogout();
  };

  const cardInner = width - screenPadding * 2 - spacing.sm * 2;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ---------------- HERO ---------------- */}
        <View style={styles.hero}>
          <Image source={images.heroScooter} style={styles.heroImg} contentFit="cover" />
          <LinearGradient
            colors={[colors.surface.background, colors.surface.background, 'rgba(239,242,240,0)']}
            locations={[0, 0.28, 0.72]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(239,242,240,0)', colors.surface.background]}
            start={{ x: 0, y: 0.45 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.heroContent} pointerEvents="box-none">
            <View style={styles.topRow}>
              <Glass borderRadius={radius.md} style={styles.iconBtn}>
                <Ionicons name="menu" size={22} color={colors.text.primary} />
              </Glass>
              <View>
                <Glass borderRadius={radius.md} style={styles.iconBtn}>
                  <Ionicons name="notifications-outline" size={20} color={colors.text.primary} />
                </Glass>
                <View style={styles.notifDot} />
              </View>
            </View>

            <Text style={styles.hello}>Hello, Rider 👋</Text>
            <Text style={styles.h1}>Where are you</Text>
            <Text style={[styles.h1, styles.h1green]}>going today?</Text>
            <Text style={styles.tagline}>Smart rides. Sustainable future.</Text>
          </View>
        </View>

        {/* ---------------- PICKUP ---------------- */}
        <NeoSurface borderRadius={radius.lg} style={styles.pickupCard}>
          <View style={styles.pinCircle}>
            <Ionicons name="location" size={18} color={colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pickupLabel}>Pickup location</Text>
            <Text style={styles.pickupValue}>Search pickup location</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
        </NeoSurface>

        {/* ---------------- MAP + QUICK ACTIONS ---------------- */}
        <NeoSurface borderRadius={radius.lg} style={styles.mapCard}>
          <StylizedMap width={cardInner} height={190} stations={STATIONS} />
          <View style={styles.actionsRow}>
            <QuickAction icon="bicycle-outline" label={'Nearby\nStations'} />
            <QuickActionDivider />
            <QuickAction icon="battery-charging-outline" label={'Battery\nSwap'} badge="New" />
            <QuickActionDivider />
            <QuickAction icon="headset-outline" label={'Support\n24/7'} />
            <QuickActionDivider />
            <QuickAction icon="pricetag-outline" label={'Offers &\nDeals'} badge="New" />
          </View>
        </NeoSurface>

        {/* ---------------- RECOMMENDED ---------------- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recommended for you</Text>
          <Pressable hitSlop={6}>
            <Text style={styles.viewAll}>View all ›</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {VEHICLES.map((v) => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </ScrollView>

        {/* ---------------- SAFETY BANNER ---------------- */}
        <View style={styles.banner}>
          <View style={styles.bannerIconHalo}>
            <LinearGradient
              colors={[colors.brand.light, colors.brand.dark]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.bannerShield}
            >
              <Ionicons name="checkmark" size={22} color={colors.text.inverse} />
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Ride safe. Ride smart.</Text>
            <Text style={styles.bannerText}>
              Helmets, insurance and 24/7 support always with you.
            </Text>
          </View>
          <Pressable style={styles.bannerBtn} hitSlop={6}>
            <Text style={styles.bannerBtnText}>Learn More ›</Text>
          </Pressable>
        </View>

      </ScrollView>

      {/* ---------------- BOTTOM TABS (visual; real navigation later) ---------------- */}
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.key === 'home';
          return (
            <Pressable
              key={t.key}
              style={styles.tab}
              hitSlop={4}
              onPress={t.key === 'profile' ? handleProfileTab : undefined}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { paddingBottom: spacing.xl },

  /* hero */
  hero: { height: 296, width: '100%', overflow: 'hidden' },
  heroImg: { position: 'absolute', right: -56, top: -18, width: '70%', height: 300 },
  heroContent: { flex: 1, paddingHorizontal: screenPadding, paddingTop: 52 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  notifDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.brand.primary,
    borderWidth: 2,
    borderColor: colors.surface.background,
  },
  hello: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.text.secondary, marginTop: spacing.lg },
  h1: { fontFamily: fontFamily.bold, fontSize: 27, lineHeight: 33, color: colors.text.primary, marginTop: 2 },
  h1green: { color: colors.brand.primary },
  tagline: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.text.primary, marginTop: spacing.sm },

  /* pickup */
  pickupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: screenPadding,
    marginTop: -28,
    padding: spacing.md,
  },
  pinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupLabel: { fontFamily: fontFamily.semibold, fontSize: 11, color: colors.text.secondary },
  pickupValue: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.text.secondary, marginTop: 2 },

  /* map card */
  mapCard: { marginHorizontal: screenPadding, marginTop: spacing.md, padding: spacing.sm },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },

  /* recommended */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: screenPadding,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...textStyles.h2, color: colors.text.primary },
  viewAll: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.brand.primary },
  carousel: { paddingLeft: screenPadding, paddingRight: spacing.xs, paddingVertical: spacing.xs },

  /* banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand.mint,
    borderRadius: radius.lg,
    marginHorizontal: screenPadding,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  bannerIconHalo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerShield: {
    width: 40,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    // shield silhouette: square top, rounded point at the bottom
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  bannerTitle: { fontFamily: fontFamily.bold, fontSize: 14.5, color: colors.text.primary },
  bannerText: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 15, color: colors.text.secondary, marginTop: 2 },
  bannerBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerBtnText: { fontFamily: fontFamily.semibold, fontSize: 11, color: colors.text.inverse },

  /* tab bar */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontFamily: fontFamily.medium, fontSize: 10, color: colors.text.secondary },
  tabLabelActive: { fontFamily: fontFamily.bold, color: colors.brand.primary },
  tabActiveBar: {
    position: 'absolute',
    bottom: -spacing.sm,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brand.primary,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: { fontFamily: fontFamily.bold, fontSize: 8, color: colors.text.inverse },
});
