import React, { useState } from 'react';
import {
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
  image: any;
  features: string[];
};

const FLEET_DATA: VehicleItem[] = [
  // Battery Swap Category Bikes
  {
    id: 'bike-s1-pro',
    name: 'RFY Swapper S1 Pro',
    category: 'swap',
    tag: '⚡ Most Popular',
    tagBg: '#DEF7EC',
    tagColor: '#059669',
    rangeKm: 110,
    topSpeed: 55,
    batteryPercent: 100,
    pricePerDay: 249,
    pricePerWeek: 1499,
    pricePerMonth: 5499,
    image: images.vehicleS1,
    features: ['Unlimited Free Swaps', 'Smart Digital Dash', 'Sanitized Helmet', 'Full Insurance'],
  },
  {
    id: 'bike-s1-eco',
    name: 'RFY Swapper S1 Eco',
    category: 'swap',
    tag: '🌱 Maximum Efficiency',
    tagBg: '#DCFCE7',
    tagColor: '#16A34A',
    rangeKm: 95,
    topSpeed: 45,
    batteryPercent: 95,
    pricePerDay: 199,
    pricePerWeek: 1199,
    pricePerMonth: 4499,
    image: images.vehicleZ1,
    features: ['2-Min Station Swap', 'Lightweight Alloy Frame', 'Sanitized Helmet', 'GPS Tracked'],
  },

  // Home Charge Category Bikes
  {
    id: 'bike-x1-max',
    name: 'RFY Home Pro X1 Max',
    category: 'home',
    tag: '🔌 3-Pin Charger Included',
    tagBg: '#E0F2FE',
    tagColor: '#0284C7',
    rangeKm: 130,
    topSpeed: 60,
    batteryPercent: 100,
    pricePerDay: 299,
    pricePerWeek: 1799,
    pricePerMonth: 6499,
    image: images.vehicleX1,
    features: ['Fast Home Charger Included', 'Long Distance Battery', 'Dual Disc Brakes', 'Full Insurance'],
  },
  {
    id: 'bike-x1-city',
    name: 'RFY Home City X1',
    category: 'home',
    tag: '🏠 Daily Commuter',
    tagBg: '#F3E8FF',
    tagColor: '#7E22CE',
    rangeKm: 105,
    topSpeed: 50,
    batteryPercent: 98,
    pricePerDay: 229,
    pricePerWeek: 1399,
    pricePerMonth: 4999,
    image: images.vehicleS1,
    features: ['Standard Portable Charger', 'Regenerative Braking', 'Sanitized Helmet', 'Zero Emissions'],
  },
];

type PlanDuration = 'day' | 'week' | 'month';

export default function VehiclesListScreen({ navigation, route }: Props) {
  const { categoryId, categoryTitle, hubName, hubAddress } = route.params;
  const isSwap = categoryId === 'swap';

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'high-range' | 'top-speed'>('all');
  const [selectedDuration, setSelectedDuration] = useState<Record<string, PlanDuration>>({});
  const [activeBookingBike, setActiveBookingBike] = useState<VehicleItem | null>(null);

  // Filter bikes matching category
  const categoryBikes = FLEET_DATA.filter((b) => b.category === categoryId);

  const filteredBikes = categoryBikes.filter((b) => {
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

      {/* ---------------- HEADER ---------------- */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </Pressable>

        <View style={styles.headerTitleBox}>
          <View style={[styles.catBadge, { backgroundColor: isSwap ? '#DEF7EC' : '#E0F2FE' }]}>
            <Ionicons
              name={isSwap ? 'flash' : 'home'}
              size={12}
              color={isSwap ? '#059669' : '#0284C7'}
            />
            <Text style={[styles.catBadgeText, { color: isSwap ? '#059669' : '#0284C7' }]}>
              {categoryTitle}
            </Text>
          </View>
          <Text style={styles.hubTitle} numberOfLines={1}>
            {hubName}
          </Text>
        </View>

        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* ---------------- HUB BANNER ---------------- */}
      <View style={styles.hubBanner}>
        <Ionicons name="location-sharp" size={16} color={colors.brand.primary} />
        <Text style={styles.hubAddressText} numberOfLines={1}>
          {hubAddress}
        </Text>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{filteredBikes.length} Available</Text>
        </View>
      </View>

      {/* ---------------- FILTER CHIPS ---------------- */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
            All Bikes ({categoryBikes.length})
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
            🚀 55+ km/h
          </Text>
        </Pressable>
      </View>

      {/* ---------------- VEHICLES LIST ---------------- */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {filteredBikes.map((bike) => {
          const duration = selectedDuration[bike.id] || 'day';
          const price = getPrice(bike, duration);

          return (
            <NeoSurface key={bike.id} borderRadius={radius.xl} style={styles.bikeCard}>
              {/* Card Header Tag & Battery */}
              <View style={styles.cardHeader}>
                <View style={[styles.tagPill, { backgroundColor: bike.tagBg }]}>
                  <Text style={[styles.tagPillText, { color: bike.tagColor }]}>
                    {bike.tag}
                  </Text>
                </View>

                <View style={styles.batteryPill}>
                  <Ionicons name="battery-charging" size={14} color="#059669" />
                  <Text style={styles.batteryText}>{bike.batteryPercent}% Charged</Text>
                </View>
              </View>

              {/* Scooter Image & Key Specs */}
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

              {/* Rental Duration Plan Selector */}
              <View style={styles.planSelector}>
                <Pressable
                  style={[styles.planTab, duration === 'day' && styles.planTabActive]}
                  onPress={() => handleSelectDuration(bike.id, 'day')}
                >
                  <Text style={[styles.planTabTitle, duration === 'day' && styles.planTabTitleActive]}>
                    Daily
                  </Text>
                  <Text style={[styles.planTabPrice, duration === 'day' && styles.planTabPriceActive]}>
                    ₹{bike.pricePerDay}
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.planTab, duration === 'week' && styles.planTabActive]}
                  onPress={() => handleSelectDuration(bike.id, 'week')}
                >
                  <Text style={[styles.planTabTitle, duration === 'week' && styles.planTabTitleActive]}>
                    Weekly
                  </Text>
                  <Text style={[styles.planTabPrice, duration === 'week' && styles.planTabPriceActive]}>
                    ₹{bike.pricePerWeek}
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.planTab, duration === 'month' && styles.planTabActive]}
                  onPress={() => handleSelectDuration(bike.id, 'month')}
                >
                  <Text style={[styles.planTabTitle, duration === 'month' && styles.planTabTitleActive]}>
                    Monthly
                  </Text>
                  <Text style={[styles.planTabPrice, duration === 'month' && styles.planTabPriceActive]}>
                    ₹{bike.pricePerMonth}
                  </Text>
                </Pressable>
              </View>

              {/* Features List */}
              <View style={styles.featuresRow}>
                {bike.features.map((feat, idx) => (
                  <View key={idx} style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.brand.primary} />
                    <Text style={styles.featureItemText}>{feat}</Text>
                  </View>
                ))}
              </View>

              {/* Bottom Price & Booking Button */}
              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.footerPricePrefix}>Total Rental</Text>
                  <View style={styles.footerPriceRow}>
                    <Text style={styles.footerPriceSymbol}>₹</Text>
                    <Text style={styles.footerPriceVal}>{price.amount}</Text>
                    <Text style={styles.footerPriceLbl}>{price.label}</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.bookBtn}
                  onPress={() => setActiveBookingBike(bike)}
                  hitSlop={4}
                >
                  <Text style={styles.bookBtnText}>Select & Book</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            </NeoSurface>
          );
        })}
      </ScrollView>

      {/* ---------------- BOOKING CONFIRMATION MODAL ---------------- */}
      {activeBookingBike && (
        <ThemedModal
          visible={Boolean(activeBookingBike)}
          title={`Book ${activeBookingBike.name}`}
          message={`Selected Hub: ${hubName}\nTotal Fare: ₹${
            getPrice(activeBookingBike, selectedDuration[activeBookingBike.id] || 'day').amount
          } ${
            getPrice(activeBookingBike, selectedDuration[activeBookingBike.id] || 'day').label
          }\n\nSanitized helmet, insurance & roadside support are included.`}
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
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#ECFDF5',
    marginHorizontal: screenPadding,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#D1FAE5',
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
    backgroundColor: '#DCFCE7',
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
    backgroundColor: '#F1F5F9',
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
    color: '#FFFFFF',
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
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  batteryText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10.5,
    color: '#059669',
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
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#EDF2F7',
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
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#FFFFFF',
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

  /* Features */
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F8FAFC',
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
    borderTopColor: '#EDF2F7',
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
    color: '#FFFFFF',
  },
});
