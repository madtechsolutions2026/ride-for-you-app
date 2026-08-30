import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { images } from '../assets';
import { colors, fontFamily, radius, screenPadding, shadows, spacing, textStyles } from '../theme';
import { Glass, NeoSurface, ThemedModal } from '../components';
import { apiClient } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'VehiclesList'>;

type VehicleItem = {
  id: string;
  name: string;
  category: 'swap' | 'home';
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
  // Battery Swap Category Bikes from rideforyouev.com
  {
    id: 'bm_new_aeroflow',
    name: 'NEW (Aeroflow)',
    category: 'swap',
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
    id: 'bm_esprinto',
    name: 'ESPRINTO',
    category: 'swap',
    tag: '⚡ UNLIMITED SWAPPING',
    tagBg: colors.brand.mint,
    tagColor: colors.brand.primary,
    rangeKm: 100,
    topSpeed: 50,
    batteryPercent: 100,
    pricePerDay: 275,
    pricePerWeek: 1925,
    pricePerMonth: 6999,
    platformFee: 2000,
    bookingFee: 200,
    totalDueToday: 4120,
    image: images.vehicleZ1,
    features: ['Unlimited Free Swaps', 'Urban Delivery Edition', 'Sanitized Helmet', 'GPS Tracked'],
  },
  {
    id: 'bm_odyssey',
    name: 'ODYSSEY',
    category: 'swap',
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
    totalDueToday: 4620,
    image: images.vehicleS1,
    features: ['Unlimited Free Swaps', 'Heavy Duty Cargo Box', 'Dual Disc Brakes', 'Full Insurance'],
  },

  // Home Charge Category Bikes
  {
    id: 'bm_home_pro_x1',
    name: 'HOME PRO X1',
    category: 'home',
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
    totalDueToday: 4120,
    image: images.vehicleX1,
    features: ['Fast Home Charger Included', 'Long Distance Battery', 'Dual Disc Brakes', 'Full Insurance'],
  },
];

type PlanDuration = 'day' | 'week' | 'month';

export default function VehiclesListScreen({ navigation, route }: Props) {
  const { categoryId, categoryTitle, hubName, hubAddress } = route.params;
  const isSwap = categoryId === 'swap';

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'high-range' | 'top-speed'>('all');
  const [selectedDuration, setSelectedDuration] = useState<Record<string, PlanDuration>>({});
  const [activeBookingBike, setActiveBookingBike] = useState<VehicleItem | null>(null);
  const defaultCategoryBikes = FLEET_DATA.filter((b) => b.category === categoryId);
  const [bikesList, setBikesList] = useState<VehicleItem[]>(defaultCategoryBikes);
  const [loading, setLoading] = useState(false);

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
            let totalDue = 4120;
            if (m.name.toUpperCase().includes('NEW') || m.id.includes('new')) {
              platformFee = 1500;
              totalDue = 3625;
            } else if (m.name.toUpperCase().includes('ODYSSEY') || m.id.includes('odyssey')) {
              platformFee = 2500;
              totalDue = 4620;
            }

            return {
              id: m.modelId,
              name: m.name,
              category: m.category.toLowerCase() as 'swap' | 'home',
              tag: m.category === 'SWAP' ? '⚡ UNLIMITED SWAPPING' : '🔌 3-PIN CHARGER INCLUDED',
              tagBg: m.category === 'SWAP' ? colors.brand.mint : colors.status.infoTint,
              tagColor: m.category === 'SWAP' ? colors.brand.primary : colors.status.info,
              rangeKm: m.rangeKm,
              topSpeed: m.topSpeedKmph,
              batteryPercent: 100,
              pricePerDay: dayPlan ? dayPlan.price : 275,
              pricePerWeek: weekPlan ? weekPlan.price : 1925,
              pricePerMonth: monthPlan ? monthPlan.price : 6999,
              platformFee,
              bookingFee: 200,
              totalDueToday: totalDue,
              image: m.imageUrl ? { uri: m.imageUrl } : fallbackImage,
              features:
                m.category === 'SWAP'
                  ? ['Unlimited Free Swaps', 'Delivery Cargo Box Included', 'Sanitized Helmet', 'Full Insurance']
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
    if (selectedFilter === 'high-range') return b.rangeKm >= 110;
    if (selectedFilter === 'top-speed') return b.topSpeed >= 55;
    return true;
  });

  const getPrice = (bike: VehicleItem, duration: PlanDuration) => {
    if (duration === 'week') return { amount: bike.pricePerWeek, label: '/week' };
    if (duration === 'month') return { amount: bike.pricePerMonth, label: '/month' };
    return { amount: bike.pricePerDay, label: '/day' };
  };

  const handleSelectDuration = (bikeId: string, duration: PlanDuration) => {
    setSelectedDuration((prev) => ({ ...prev, [bikeId]: duration }));
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </Pressable>

        <View style={styles.headerTitleBox}>
          <View style={[styles.catBadge, { backgroundColor: isSwap ? colors.brand.mint : colors.status.infoTint }]}>
            <Ionicons
              name={isSwap ? 'flash' : 'home'}
              size={12}
              color={isSwap ? colors.brand.primary : colors.status.info}
            />
            <Text style={[styles.catBadgeText, { color: isSwap ? colors.brand.primary : colors.status.info }]}>
              {categoryTitle}
            </Text>
          </View>
          <Text style={styles.hubTitle} numberOfLines={1}>
            {hubName}
          </Text>
        </View>

        <View style={styles.headerRightPlaceholder} />
      </View>

      <View style={styles.hubBanner}>
        <Ionicons name="location-sharp" size={16} color={colors.brand.primary} />
        <Text style={styles.hubAddressText} numberOfLines={1}>
          {hubAddress}
        </Text>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{filteredBikes.length} Models</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
            All Fleet ({bikesList.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.filterChip, selectedFilter === 'high-range' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('high-range')}
        >
          <Text style={[styles.filterText, selectedFilter === 'high-range' && styles.filterTextActive]}>
            ⚡ Long Range (110+ km)
          </Text>
        </Pressable>

        <Pressable
          style={[styles.filterChip, selectedFilter === 'top-speed' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('top-speed')}
        >
          <Text style={[styles.filterText, selectedFilter === 'top-speed' && styles.filterTextActive]}>
            🏎️ High Speed (55+ km/h)
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollList}
        showsVerticalScrollIndicator={false}
      >
        {filteredBikes.map((bike) => {
          const duration = selectedDuration[bike.id] || 'week';
          const price = getPrice(bike, duration);

          return (
            <NeoSurface key={bike.id} borderRadius={radius.xl} style={styles.bikeCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.tagPill, { backgroundColor: bike.tagBg }]}>
                  <Text style={[styles.tagPillText, { color: bike.tagColor }]}>
                    {bike.tag}
                  </Text>
                </View>

                <View style={styles.batteryPill}>
                  <Ionicons name="battery-charging" size={14} color={colors.brand.primary} />
                  <Text style={styles.batteryText}>{bike.batteryPercent}% Charged</Text>
                </View>
              </View>

              <View style={styles.heroSection}>
                <Image source={bike.image} style={styles.scooterImg} contentFit="contain" />

                <View style={styles.specsColumn}>
                  <Text style={styles.bikeName}>{bike.name}</Text>

                  <View style={styles.specBox}>
                    <Ionicons name="speedometer-outline" size={13} color={colors.brand.primary} />
                    <Text style={styles.specVal}>{bike.rangeKm} km</Text>
                    <Text style={styles.specLbl}>Range</Text>
                  </View>

                  <View style={styles.specBox}>
                    <Ionicons name="hardware-chip-outline" size={13} color={colors.brand.primary} />
                    <Text style={styles.specVal}>{bike.topSpeed} km/h</Text>
                    <Text style={styles.specLbl}>Top Speed</Text>
                  </View>
                </View>
              </View>

              <View style={styles.feeBreakdownBox}>
                <View style={styles.feeRow}>
                  <View>
                    <Text style={styles.feeLabel}>Weekly Rental</Text>
                    <Text style={styles.feeSub}>7 DAYS</Text>
                  </View>
                  <Text style={styles.feeValue}>₹{bike.pricePerWeek}</Text>
                </View>

                <View style={styles.feeRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.feeLabel}>Platform Fee</Text>
                    <View style={styles.nonRefundableBadge}>
                      <Text style={styles.nonRefundableText}>NON-REFUNDABLE</Text>
                    </View>
                  </View>
                  <Text style={styles.feeValue}>₹{bike.platformFee}</Text>
                </View>

                <View style={styles.feeRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.feeLabel}>Booking Fee</Text>
                    <View style={styles.nonRefundableBadge}>
                      <Text style={styles.nonRefundableText}>NON-REFUNDABLE</Text>
                    </View>
                  </View>
                  <Text style={styles.feeValue}>₹{bike.bookingFee}</Text>
                </View>

                <View style={styles.totalDueRow}>
                  <View>
                    <Text style={styles.totalDueLabel}>TOTAL AMOUNT</Text>
                    <Text style={styles.totalDueSub}>Due Today</Text>
                  </View>
                  <Text style={styles.totalDueValue}>₹{bike.totalDueToday}/-</Text>
                </View>
              </View>

              <View style={styles.featuresRow}>
                {bike.features.map((feat, idx) => (
                  <View key={idx} style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.brand.primary} />
                    <Text style={styles.featureItemText}>{feat}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.footerPricePrefix}>Starting Rental</Text>
                  <View style={styles.footerPriceRow}>
                    <Text style={styles.footerPriceSymbol}>₹</Text>
                    <Text style={styles.footerPriceVal}>{bike.pricePerWeek}</Text>
                    <Text style={styles.footerPriceLbl}>/week</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.bookBtn}
                  onPress={() => setActiveBookingBike(bike)}
                  hitSlop={4}
                >
                  <Text style={styles.bookBtnText}>Select & Book</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.common.white} />
                </Pressable>
              </View>
            </NeoSurface>
          );
        })}
      </ScrollView>

      {activeBookingBike && (
        <ThemedModal
          visible={Boolean(activeBookingBike)}
          title={`Book ${activeBookingBike.name}`}
          message={`Selected Hub: ${hubName}\nWeekly Rental: ₹${activeBookingBike.pricePerWeek}\nPlatform Fee: ₹${activeBookingBike.platformFee}\nBooking Fee: ₹${activeBookingBike.bookingFee}\n\nTotal Due Today: ₹${activeBookingBike.totalDueToday}/-\n\nSanitized helmet, delivery cargo carrier & roadside assistance included.`}
          icon={isSwap ? 'flash' : 'home'}
          confirmLabel="Proceed to Verification"
          cancelLabel="Cancel"
          onConfirm={() => {
            setActiveBookingBike(null);
            navigation.navigate('Profile');
          }}
          onCancel={() => setActiveBookingBike(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerTitleBox: {
    flex: 1,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  catBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
  },
  hubTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.text.primary,
  },
  headerRightPlaceholder: {
    width: 40,
  },

  /* Hub Address Banner */
  hubBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand.mintSoft,
    marginHorizontal: screenPadding,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand.mint,
  },
  hubAddressText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 11.5,
    color: colors.text.secondary,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand.mint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.success,
  },
  liveText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: colors.status.success,
  },

  /* Filter Chips */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: screenPadding,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[100],
  },
  filterChipActive: {
    backgroundColor: colors.brand.primary,
  },
  filterText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.common.white,
  },

  /* Scroll List */
  scrollList: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 40,
    gap: spacing.md,
  },

  /* Bike Card */
  bikeCard: {
    padding: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagPillText: {
    fontFamily: fontFamily.bold,
    fontSize: 10.5,
  },
  batteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.brand.mint,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  batteryText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10.5,
    color: colors.brand.primary,
  },

  /* Hero & Specs */
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  scooterImg: {
    width: 120,
    height: 110,
  },
  specsColumn: {
    flex: 1,
    gap: 4,
  },
  bikeName: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: 4,
  },
  specBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutral[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  specVal: {
    fontFamily: fontFamily.bold,
    fontSize: 11.5,
    color: colors.text.primary,
  },
  specLbl: {
    fontFamily: fontFamily.regular,
    fontSize: 10.5,
    color: colors.text.secondary,
  },

  /* Plan Selector Tabs */
  planSelector: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    padding: 3,
    marginVertical: spacing.sm,
    gap: 4,
  },
  planTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  planTabActive: {
    backgroundColor: colors.common.white,
    ...shadows.subtle,
  },
  planTabTitle: {
    fontFamily: fontFamily.medium,
    fontSize: 10.5,
    color: colors.text.secondary,
  },
  planTabTitleActive: {
    fontFamily: fontFamily.bold,
    color: colors.brand.primary,
  },
  planTabPrice: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.text.primary,
    marginTop: 1,
  },
  planTabPriceActive: {
    color: colors.brand.primary,
  },

  /* Fee Breakdown matching website */
  feeBreakdownBox: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  feeLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.text.secondary,
  },
  feeSub: {
    fontFamily: fontFamily.regular,
    fontSize: 9.5,
    color: colors.neutral[400],
  },
  feeValue: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.text.primary,
  },
  nonRefundableBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  nonRefundableText: {
    fontFamily: fontFamily.bold,
    fontSize: 8.5,
    color: colors.text.secondary,
    letterSpacing: 0.3,
  },
  totalDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalDueLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: colors.brand.primary,
    letterSpacing: 0.5,
  },
  totalDueSub: {
    fontFamily: fontFamily.regular,
    fontSize: 9,
    color: colors.text.secondary,
  },
  totalDueValue: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.brand.primary,
  },

  /* Features */
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.neutral[50],
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  featureItemText: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: colors.text.secondary,
  },

  /* Card Footer */
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerPricePrefix: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: colors.text.secondary,
  },
  footerPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  footerPriceSymbol: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.brand.primary,
  },
  footerPriceVal: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
  },
  footerPriceLbl: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.text.secondary,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    ...shadows.subtle,
  },
  bookBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 12.5,
    color: colors.common.white,
  },
});
