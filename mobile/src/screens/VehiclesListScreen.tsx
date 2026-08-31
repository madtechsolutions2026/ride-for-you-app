import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { images } from '../assets';
import { colors, fontFamily, radius, screenPadding, shadows, spacing } from '../theme';
import { ThemedModal } from '../components';
import { apiClient } from '../api/client';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - screenPadding * 2 - 12) / 2;

type Props = NativeStackScreenProps<RootStackParamList, 'VehiclesList'>;

export type VehicleItem = {
  id: string;
  name: string;
  category: 'swap' | 'home';
  speedCategory: 'high' | 'low';
  tag: string;
  tagBg: string;
  tagColor: string;
  rangeKm: number;
  topSpeed: number;
  batteryPercent: number;
  pricePerDay: number;
  pricePerWeek: number;
  pricePerMonth: number;
  platformFee: number;
  bookingFee: number;
  totalDueToday: number;
  image: any;
  features: string[];
};

const FLEET_DATA: VehicleItem[] = [
  {
    id: 'bm_sprinto_hs',
    name: 'SPRINTO HS',
    category: 'swap',
    speedCategory: 'high',
    tag: '⚡ UNLIMITED SWAPPING',
    tagBg: colors.brand.mint,
    tagColor: colors.brand.primary,
    rangeKm: 90,
    topSpeed: 45,
    batteryPercent: 100,
    pricePerDay: 235,
    pricePerWeek: 1645,
    pricePerMonth: 5999,
    platformFee: 1500,
    bookingFee: 200,
    totalDueToday: 3345,
    image: images.vehicleS1,
    features: ['Unlimited Free Swaps', 'Delivery Carrier Box', 'Sanitized Helmet', 'Full Insurance'],
  },
  {
    id: 'bm_evtric',
    name: 'EVTRIC',
    category: 'swap',
    speedCategory: 'low',
    tag: '⚡ UNLIMITED SWAPPING',
    tagBg: colors.brand.mint,
    tagColor: colors.brand.primary,
    rangeKm: 90,
    topSpeed: 30,
    batteryPercent: 100,
    pricePerDay: 230,
    pricePerWeek: 1610,
    pricePerMonth: 5899,
    platformFee: 1500,
    bookingFee: 200,
    totalDueToday: 3310,
    image: images.vehicleZ1,
    features: ['Unlimited Free Swaps', 'High Efficiency Motor', 'Sanitized Helmet', 'GPS Tracked'],
  },
  {
    id: 'bm_hala_ckd',
    name: 'HALA CKD',
    category: 'swap',
    speedCategory: 'low',
    tag: '⚡ UNLIMITED SWAPPING',
    tagBg: colors.brand.mint,
    tagColor: colors.brand.primary,
    rangeKm: 90,
    topSpeed: 35,
    batteryPercent: 100,
    pricePerDay: 230,
    pricePerWeek: 1610,
    pricePerMonth: 5899,
    platformFee: 1500,
    bookingFee: 200,
    totalDueToday: 3310,
    image: images.vehicleS1,
    features: ['Unlimited Free Swaps', 'Lightweight City Frame', 'Sanitized Helmet', 'Full Insurance'],
  },
  {
    id: 'bm_sprinto_hs_sun',
    name: 'SPRINTO HS SUN',
    category: 'swap',
    speedCategory: 'low',
    tag: '⚡ UNLIMITED SWAPPING',
    tagBg: colors.brand.mint,
    tagColor: colors.brand.primary,
    rangeKm: 75,
    topSpeed: 30,
    batteryPercent: 100,
    pricePerDay: 275,
    pricePerWeek: 1925,
    pricePerMonth: 6999,
    platformFee: 2000,
    bookingFee: 200,
    totalDueToday: 4125,
    image: images.vehicleZ1,
    features: ['Unlimited Free Swaps', 'Heavy Duty Suspension', 'Sanitized Helmet', 'Zero Downtime'],
  },
  {
    id: 'bm_new_aeroflow',
    name: 'NEW (Aeroflow)',
    category: 'swap',
    speedCategory: 'high',
    tag: '⚡ UNLIMITED SWAPPING',
    tagBg: colors.brand.mint,
    tagColor: colors.brand.primary,
    rangeKm: 110,
    topSpeed: 55,
    batteryPercent: 100,
    pricePerDay: 275,
    pricePerWeek: 1925,
    pricePerMonth: 6999,
    platformFee: 1500,
    bookingFee: 200,
    totalDueToday: 3625,
    image: images.vehicleS1,
    features: ['Unlimited Free Swaps', 'Aeroflow Cargo Carrier', 'Sanitized Helmet', 'Full Insurance'],
  },
  {
    id: 'bm_odyssey',
    name: 'ODYSSEY',
    category: 'swap',
    speedCategory: 'high',
    tag: '⚡ UNLIMITED SWAPPING',
    tagBg: colors.brand.mint,
    tagColor: colors.brand.primary,
    rangeKm: 120,
    topSpeed: 60,
    batteryPercent: 100,
    pricePerDay: 275,
    pricePerWeek: 1925,
    pricePerMonth: 6999,
    platformFee: 2500,
    bookingFee: 200,
    totalDueToday: 4625,
    image: images.vehicleS1,
    features: ['Unlimited Free Swaps', 'Heavy Duty Cargo Box', 'Dual Disc Brakes', 'Full Insurance'],
  },
  {
    id: 'bm_home_pro_x1',
    name: 'HOME PRO X1',
    category: 'home',
    speedCategory: 'high',
    tag: '🔌 3-PIN CHARGER INCLUDED',
    tagBg: colors.status.infoTint,
    tagColor: colors.status.info,
    rangeKm: 130,
    topSpeed: 60,
    batteryPercent: 100,
    pricePerDay: 275,
    pricePerWeek: 1925,
    pricePerMonth: 6999,
    platformFee: 2000,
    bookingFee: 200,
    totalDueToday: 4125,
    image: images.vehicleX1,
    features: ['Fast Home Charger Included', 'Long Distance Battery', 'Dual Disc Brakes', 'Full Insurance'],
  },
];

type SpeedFilter = 'all' | 'high' | 'low';

export default function VehiclesListScreen({ navigation, route }: Props) {
  const { categoryId, categoryTitle, hubName, hubAddress } = route.params;
  const isSwap = categoryId === 'swap';

  const [selectedFilter, setSelectedFilter] = useState<SpeedFilter>('all');
  const [selectedBike, setSelectedBike] = useState<VehicleItem | null>(null);
  const [activeBookingBike, setActiveBookingBike] = useState<VehicleItem | null>(null);

  // KYC gate — a rider can only book once KYC is APPROVED.
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [kycBlock, setKycBlock] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const kycApproved = kycStatus === 'APPROVED';

  const defaultCategoryBikes = FLEET_DATA.filter((b) => b.category === categoryId);
  const [bikesList, setBikesList] = useState<VehicleItem[]>(defaultCategoryBikes);

  useEffect(() => {
    apiClient
      .get('/user/profile')
      .then((res) => setKycStatus(res.data?.user?.kycStatus ?? null))
      .catch(() => {});
  }, []);

  const handleBookingConfirm = async () => {
    if (creating || !activeBookingBike) return;

    if (!kycApproved) {
      setActiveBookingBike(null);
      setKycBlock(
        kycStatus === 'SUBMITTED'
          ? 'Your KYC is under review. You can book once it is approved — usually within a few hours.'
          : kycStatus === 'REJECTED'
          ? 'Your KYC was rejected. Please re-submit your documents from your profile to book a bike.'
          : 'Complete your KYC verification to book a bike. It only takes a couple of minutes.'
      );
      return;
    }

    setCreating(true);
    try {
      const res = await apiClient.post('/rental/bookings', {
        modelId: activeBookingBike.id,
        hubId: route.params.hubId,
        duration: 'WEEK',
      });
      setActiveBookingBike(null);
      navigation.navigate('BookingPayment', { bookingId: res.data.booking.id });
    } catch (e: any) {
      const data = e?.response?.data;
      setActiveBookingBike(null);
      if (data?.code === 'KYC_REQUIRED') {
        setKycStatus(data.kycStatus ?? kycStatus);
        setKycBlock(data.error || 'Complete your KYC verification to book a bike.');
      } else if (data?.code === 'BOOKING_EXISTS' && data.booking) {
        const b = data.booking;
        if (b.status === 'PENDING') {
          navigation.navigate('BookingPayment', { bookingId: b.id });
        } else {
          navigation.navigate('MyBookings');
        }
      } else {
        setKycBlock(data?.error || 'Could not create the booking. Please try again.');
      }
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    const catQuery = categoryId === 'swap' ? 'SWAP' : 'HOME';
    apiClient
      .get(`/rental/bikes?category=${catQuery}`)
      .then((res) => {
        if (res.data?.bikes && Array.isArray(res.data.bikes) && res.data.bikes.length > 0) {
          const mapped: VehicleItem[] = res.data.bikes.map((m: any, idx: number) => {
            const dayPlan = m.plans?.find((p: any) => p.duration === 'DAY');
            const weekPlan = m.plans?.find((p: any) => p.duration === 'WEEK');
            const monthPlan = m.plans?.find((p: any) => p.duration === 'MONTH');

            const fallbackImage =
              m.category === 'SWAP'
                ? idx % 2 === 0
                  ? images.vehicleS1
                  : images.vehicleZ1
                : idx % 2 === 0
                ? images.vehicleX1
                : images.vehicleS1;

            let platformFee = 2000;
            let totalDue = 4125;
            if (m.name.toUpperCase().includes('NEW') || m.id.includes('new')) {
              platformFee = 1500;
              totalDue = 3625;
            } else if (m.name.toUpperCase().includes('ODYSSEY') || m.id.includes('odyssey')) {
              platformFee = 2500;
              totalDue = 4625;
            } else if (
              m.name.toUpperCase().includes('SPRINTO HS') ||
              m.name.toUpperCase().includes('EVTRIC') ||
              m.name.toUpperCase().includes('HALA')
            ) {
              platformFee = 1500;
              totalDue = (weekPlan?.price || 1610) + 1500 + 200;
            }

            const speed = m.topSpeedKmph || 45;
            const speedCategory: 'high' | 'low' = speed >= 45 ? 'high' : 'low';

            return {
              id: m.modelId,
              name: m.name,
              category: m.category.toLowerCase() as 'swap' | 'home',
              speedCategory,
              tag: m.category === 'SWAP' ? '⚡ UNLIMITED SWAPPING' : '🔌 3-PIN CHARGER INCLUDED',
              tagBg: m.category === 'SWAP' ? colors.brand.mint : colors.status.infoTint,
              tagColor: m.category === 'SWAP' ? colors.brand.primary : colors.status.info,
              rangeKm: m.rangeKm,
              topSpeed: speed,
              batteryPercent: 100,
              pricePerDay: dayPlan ? dayPlan.price : 235,
              pricePerWeek: weekPlan ? weekPlan.price : 1645,
              pricePerMonth: monthPlan ? monthPlan.price : 5999,
              platformFee,
              bookingFee: 200,
              totalDueToday: totalDue,
              image: m.imageUrl ? { uri: m.imageUrl } : fallbackImage,
              features:
                m.category === 'SWAP'
                  ? ['Unlimited Free Swaps', 'Delivery Carrier Box', 'Sanitized Helmet', 'Full Insurance']
                  : ['Fast Home Charger Included', 'Long Distance Battery', 'Dual Disc Brakes', 'Full Insurance'],
            };
          });
          setBikesList(mapped);
        }
      })
      .catch(() => {
        setBikesList(defaultCategoryBikes);
      });
  }, [categoryId]);

  const filteredBikes = bikesList.filter((b) => {
    if (selectedFilter === 'high') return b.speedCategory === 'high' || b.topSpeed >= 40;
    if (selectedFilter === 'low') return b.speedCategory === 'low' || b.topSpeed < 40;
    return true;
  });

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* ---------------- HEADER ---------------- */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>{categoryTitle}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {hubName}
          </Text>
        </View>
      </View>

      {/* ---------------- FILTER PILLS (MATCHING SCREENSHOT) ---------------- */}
      <View style={styles.filterBar}>
        <Pressable
          style={[styles.pill, selectedFilter === 'all' && styles.pillActive]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.pillText, selectedFilter === 'all' && styles.pillTextActive]}>
            All
          </Text>
        </Pressable>

        <Pressable
          style={[styles.pill, selectedFilter === 'high' && styles.pillActive]}
          onPress={() => setSelectedFilter('high')}
        >
          <Text style={[styles.pillText, selectedFilter === 'high' && styles.pillTextActive]}>
            High Speed
          </Text>
        </Pressable>

        <Pressable
          style={[styles.pill, selectedFilter === 'low' && styles.pillActive]}
          onPress={() => setSelectedFilter('low')}
        >
          <Text style={[styles.pillText, selectedFilter === 'low' && styles.pillTextActive]}>
            Low Speed
          </Text>
        </Pressable>
      </View>

      {/* ---------------- 2-COLUMN VEHICLES GRID ---------------- */}
      <ScrollView
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gridRow}>
          {filteredBikes.map((bike) => (
            <Pressable
              key={bike.id}
              style={styles.card}
              onPress={() => setSelectedBike(bike)}
            >
              {/* Scooter Photo */}
              <View style={styles.imgContainer}>
                <Image
                  source={bike.image}
                  style={styles.scooterImage}
                  contentFit="contain"
                />
              </View>

              {/* Bike Name */}
              <Text style={styles.cardTitle} numberOfLines={1}>
                {bike.name}
              </Text>

              {/* Range & Speed Specs */}
              <View style={styles.specsRow}>
                <View style={styles.specItem}>
                  <Ionicons name="location" size={12} color="#00C9A7" />
                  <View style={{ marginLeft: 3 }}>
                    <Text style={styles.specLabel}>Range</Text>
                    <Text style={styles.specValue}>{bike.rangeKm} Kms</Text>
                  </View>
                </View>

                <View style={styles.specItem}>
                  <Ionicons name="speedometer" size={12} color="#00C9A7" />
                  <View style={{ marginLeft: 3 }}>
                    <Text style={styles.specLabel}>Top Speed</Text>
                    <Text style={styles.specValue}>{bike.topSpeed} Kmph</Text>
                  </View>
                </View>
              </View>

              {/* Weekly Price */}
              <View style={styles.priceContainer}>
                <Text style={styles.priceText}>
                  <Text style={styles.priceAmount}>₹{bike.pricePerWeek}</Text>
                  <Text style={styles.priceUnit}>/week</Text>
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* ---------------- VEHICLE DETAILS MODAL (OPENS ON BIKE CLICK) ---------------- */}
      {selectedBike && (
        <Modal
          visible={Boolean(selectedBike)}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedBike(null)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setSelectedBike(null)}
            />

            <View style={styles.detailSheet}>
              {/* Top Handle */}
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <View style={[styles.detailCatBadge, { backgroundColor: selectedBike.tagBg }]}>
                    <Text style={[styles.detailCatBadgeText, { color: selectedBike.tagColor }]}>
                      {selectedBike.tag}
                    </Text>
                  </View>
                  <Text style={styles.detailTitle}>{selectedBike.name}</Text>
                </View>
                <Pressable
                  style={styles.closeBtn}
                  onPress={() => setSelectedBike(null)}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={24} color={colors.text.secondary} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.detailScroll}
              >
                {/* Hero Scooter Shot */}
                <View style={styles.detailHeroBox}>
                  <Image
                    source={selectedBike.image}
                    style={styles.detailHeroImage}
                    contentFit="contain"
                  />
                  <View style={styles.batteryBadge}>
                    <Ionicons name="battery-charging" size={13} color="#00C9A7" />
                    <Text style={styles.batteryBadgeText}>100% Health</Text>
                  </View>
                </View>

                {/* Specs Grid */}
                <View style={styles.detailSpecsGrid}>
                  <View style={styles.detailSpecCard}>
                    <Ionicons name="location-outline" size={18} color={colors.brand.primary} />
                    <Text style={styles.detailSpecVal}>{selectedBike.rangeKm} km</Text>
                    <Text style={styles.detailSpecLbl}>True Range</Text>
                  </View>

                  <View style={styles.detailSpecCard}>
                    <Ionicons name="speedometer-outline" size={18} color={colors.brand.primary} />
                    <Text style={styles.detailSpecVal}>{selectedBike.topSpeed} km/h</Text>
                    <Text style={styles.detailSpecLbl}>Top Speed</Text>
                  </View>

                  <View style={styles.detailSpecCard}>
                    <Ionicons name="flash-outline" size={18} color={colors.brand.primary} />
                    <Text style={styles.detailSpecVal}>2-Min Swap</Text>
                    <Text style={styles.detailSpecLbl}>Unlimited</Text>
                  </View>
                </View>

                {/* Fee Breakdown Card */}
                <View style={styles.breakdownCard}>
                  <Text style={styles.breakdownHeading}>Price & Fee Breakdown</Text>

                  <View style={styles.breakdownRow}>
                    <View>
                      <Text style={styles.breakdownLabel}>Weekly Rental</Text>
                      <Text style={styles.breakdownSub}>7 DAYS</Text>
                    </View>
                    <Text style={styles.breakdownValue}>₹{selectedBike.pricePerWeek}</Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.breakdownLabel}>Platform Fee</Text>
                      <View style={styles.nonRefundTag}>
                        <Text style={styles.nonRefundText}>NON-REFUNDABLE</Text>
                      </View>
                    </View>
                    <Text style={styles.breakdownValue}>₹{selectedBike.platformFee}</Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.breakdownLabel}>Booking Fee</Text>
                      <View style={styles.nonRefundTag}>
                        <Text style={styles.nonRefundText}>NON-REFUNDABLE</Text>
                      </View>
                    </View>
                    <Text style={styles.breakdownValue}>₹{selectedBike.bookingFee}</Text>
                  </View>

                  <View style={styles.breakdownTotalRow}>
                    <View>
                      <Text style={styles.breakdownTotalLabel}>TOTAL AMOUNT</Text>
                      <Text style={styles.breakdownTotalSub}>Due Today</Text>
                    </View>
                    <Text style={styles.breakdownTotalValue}>₹{selectedBike.totalDueToday}/-</Text>
                  </View>
                </View>

                {/* Inclusions */}
                <View style={styles.inclusionsBox}>
                  <Text style={styles.inclusionsTitle}>Included with Rental</Text>
                  {selectedBike.features.map((feat, idx) => (
                    <View key={idx} style={styles.inclusionItem}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.brand.primary} />
                      <Text style={styles.inclusionText}>{feat}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Bottom Sticky Booking CTA */}
              <View style={styles.sheetFooter}>
                <View>
                  <Text style={styles.sheetFooterTotalLbl}>Total Due Today</Text>
                  <Text style={styles.sheetFooterTotalVal}>₹{selectedBike.totalDueToday}/-</Text>
                </View>

                <Pressable
                  style={styles.sheetBookBtn}
                  onPress={() => {
                    const bikeToBook = selectedBike;
                    setSelectedBike(null);
                    setActiveBookingBike(bikeToBook);
                  }}
                >
                  <Text style={styles.sheetBookBtnText}>Proceed to Book</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.common.white} />
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ---------------- CONFIRMATION DIALOG ---------------- */}
      {activeBookingBike && (
        <ThemedModal
          visible={Boolean(activeBookingBike)}
          title={`Confirm ${activeBookingBike.name}`}
          message={
            kycApproved
              ? `Hub: ${hubName}\n\nWeekly Rental: ₹${activeBookingBike.pricePerWeek}\nPlatform Fee: ₹${activeBookingBike.platformFee}\nBooking Fee: ₹${activeBookingBike.bookingFee}\n\nTotal Due Today: ₹${activeBookingBike.totalDueToday}/-\n\nYou'll pay on the next screen. Helmet, cargo carrier & roadside assistance included.`
              : `Hub: ${hubName}\n\nYou need an approved KYC before you can book. We'll take you to your profile to finish it.`
          }
          icon={kycApproved ? (isSwap ? 'flash' : 'home') : 'shield-checkmark-outline'}
          confirmLabel={creating ? 'Please wait…' : kycApproved ? 'Confirm & Pay' : 'Go to KYC'}
          cancelLabel="Cancel"
          onConfirm={handleBookingConfirm}
          onCancel={() => !creating && setActiveBookingBike(null)}
        />
      )}

      {/* ---------------- KYC / BOOKING BLOCK ---------------- */}
      {kycBlock && (
        <ThemedModal
          visible={Boolean(kycBlock)}
          title={kycApproved ? 'Booking not possible' : 'KYC verification needed'}
          message={kycBlock}
          icon="shield-checkmark-outline"
          confirmLabel={kycApproved ? 'OK' : 'Complete KYC'}
          cancelLabel={kycApproved ? undefined : 'Later'}
          onConfirm={() => {
            const goProfile = !kycApproved;
            setKycBlock(null);
            if (goProfile) navigation.navigate('Profile');
          }}
          onCancel={() => setKycBlock(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFCFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.sm,
    backgroundColor: colors.common.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },

  /* Filter Pills */
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
    backgroundColor: colors.common.white,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.common.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillActive: {
    backgroundColor: '#2D3748',
    borderColor: '#2D3748',
  },
  pillText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#4A5568',
  },
  pillTextActive: {
    fontFamily: fontFamily.semibold,
    color: colors.common.white,
  },

  /* 2-Column Grid */
  gridContainer: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.xs,
    paddingBottom: 40,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.common.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    ...shadows.subtle,
  },
  imgContainer: {
    height: 110,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  scooterImage: {
    width: '100%',
    height: '100%',
  },
  cardTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: '#1A202C',
    marginBottom: 8,
  },
  specsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  specLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 9,
    color: '#A0AEC0',
  },
  specValue: {
    fontFamily: fontFamily.semibold,
    fontSize: 10.5,
    color: '#2D3748',
  },
  priceContainer: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F7FAFC',
    alignItems: 'flex-start',
  },
  priceText: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#1A202C',
  },
  priceUnit: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: '#718096',
  },

  /* Detail Bottom Sheet */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  detailSheet: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 24,
    ...shadows.card,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E0',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.xs,
  },
  detailCatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  detailCatBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  detailTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: colors.text.primary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  detailHeroBox: {
    height: 180,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    marginVertical: spacing.sm,
    position: 'relative',
  },
  detailHeroImage: {
    width: '80%',
    height: '80%',
  },
  batteryBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.brand.mint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  batteryBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: colors.brand.primary,
  },
  detailSpecsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: spacing.xs,
  },
  detailSpecCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  detailSpecVal: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.text.primary,
    marginTop: 4,
  },
  detailSpecLbl: {
    fontFamily: fontFamily.regular,
    fontSize: 9.5,
    color: colors.text.secondary,
  },

  /* Fee Breakdown Card */
  breakdownCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: spacing.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  breakdownHeading: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.text.secondary,
  },
  breakdownSub: {
    fontFamily: fontFamily.regular,
    fontSize: 9.5,
    color: colors.neutral[400],
  },
  breakdownValue: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.text.primary,
  },
  nonRefundTag: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  nonRefundText: {
    fontFamily: fontFamily.bold,
    fontSize: 8.5,
    color: '#4A5568',
    letterSpacing: 0.3,
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#CBD5E0',
  },
  breakdownTotalLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.brand.primary,
    letterSpacing: 0.5,
  },
  breakdownTotalSub: {
    fontFamily: fontFamily.regular,
    fontSize: 9.5,
    color: colors.text.secondary,
  },
  breakdownTotalValue: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.brand.primary,
  },

  /* Inclusions */
  inclusionsBox: {
    backgroundColor: colors.common.white,
    borderRadius: 14,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  inclusionsTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  inclusionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  inclusionText: {
    fontFamily: fontFamily.medium,
    fontSize: 11.5,
    color: colors.text.secondary,
  },

  /* Sheet Footer */
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    backgroundColor: colors.common.white,
  },
  sheetFooterTotalLbl: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: colors.text.secondary,
  },
  sheetFooterTotalVal: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.brand.primary,
  },
  sheetBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.pill,
    ...shadows.subtle,
  },
  sheetBookBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    color: colors.common.white,
  },
});
