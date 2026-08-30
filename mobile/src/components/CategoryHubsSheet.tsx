import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, radius, shadows, spacing } from '../theme';
import { apiClient } from '../api/client';

export type CategoryHub = {
  id: string;
  name: string;
  address: string;
  distance: string;
  availableVehicles: number;
  badge: string;
  badgeColor: string;
  badgeBg: string;
};

const SWAP_HUBS: CategoryHub[] = [
  {
    id: 'hub_hitech',
    name: 'Ride For You – Hitech Metro Hub',
    address: 'Near Hitech City Metro Station, Madhapur, Hyderabad',
    distance: '0.6 km away',
    availableVehicles: 14,
    badge: '⚡ 2-Min Swap',
    badgeColor: colors.brand.primary,
    badgeBg: colors.brand.mint,
  },
  {
    id: 'hub_kondapur',
    name: 'Ride For You – Kondapur Hub',
    address: 'RTO Office Road, Near Botanical Garden, Kondapur',
    distance: '1.2 km away',
    availableVehicles: 9,
    badge: '⚡ 2-Min Swap',
    badgeColor: colors.brand.primary,
    badgeBg: colors.brand.mint,
  },
  {
    id: 'hub_gachibowli',
    name: 'Ride For You – Gachibowli Hub',
    address: 'Financial District, Near Wipro Circle, Gachibowli',
    distance: '2.4 km away',
    availableVehicles: 6,
    badge: '⚡ 2-Min Swap',
    badgeColor: colors.brand.primary,
    badgeBg: colors.brand.mint,
  },
];

const HOME_HUBS: CategoryHub[] = [
  {
    id: 'hub_kondapur',
    name: 'Ride For You – Kondapur Hub',
    address: 'RTO Office Road, Near Botanical Garden, Kondapur',
    distance: '1.1 km away',
    availableVehicles: 12,
    badge: '🔌 Charger Included',
    badgeColor: colors.status.info,
    badgeBg: colors.status.infoTint,
  },
  {
    id: 'hub_hitech',
    name: 'Ride For You – Hitech Metro Hub',
    address: 'Near Hitech City Metro Station, Madhapur, Hyderabad',
    distance: '1.8 km away',
    availableVehicles: 8,
    badge: '🔌 Charger Included',
    badgeColor: colors.status.info,
    badgeBg: colors.status.infoTint,
  },
  {
    id: 'hub_gachibowli',
    name: 'Ride For You – Gachibowli Hub',
    address: 'Financial District, Near Wipro Circle, Gachibowli',
    distance: '3.2 km away',
    availableVehicles: 5,
    badge: '🔌 Charger Included',
    badgeColor: colors.status.info,
    badgeBg: colors.status.infoTint,
  },
];

type Props = {
  visible: boolean;
  categoryId: 'swap' | 'home';
  onClose: () => void;
  onSelectHub: (hub: CategoryHub) => void;
};

export function CategoryHubsSheet({
  visible,
  categoryId,
  onClose,
  onSelectHub,
}: Props) {
  const isSwap = categoryId === 'swap';
  const defaultHubs = isSwap ? SWAP_HUBS : HOME_HUBS;
  const [liveHubs, setLiveHubs] = useState<CategoryHub[]>(defaultHubs);

  useEffect(() => {
    if (!visible) return;
    apiClient
      .get('/rental/hubs')
      .then((res) => {
        if (res.data?.hubs && Array.isArray(res.data.hubs) && res.data.hubs.length > 0) {
          const mapped: CategoryHub[] = res.data.hubs.map((h: any, idx: number) => ({
            id: h.id,
            name: h.name,
            address: h.address,
            distance: h.distanceMeters
              ? `${(h.distanceMeters / 1000).toFixed(1)} km away`
              : `${(0.7 + idx * 0.8).toFixed(1)} km away`,
            availableVehicles: isSwap
              ? (h.availableByCategory?.SWAP ?? 6)
              : (h.availableByCategory?.HOME ?? 5),
            badge: isSwap ? '⚡ 2-Min Swap' : '🔌 Charger Included',
            badgeColor: isSwap ? colors.brand.primary : colors.status.info,
            badgeBg: isSwap ? colors.brand.mint : colors.status.infoTint,
          }));
          setLiveHubs(mapped);
        }
      })
      .catch(() => {
        setLiveHubs(defaultHubs);
      });
  }, [visible, categoryId]);

  const hubs = liveHubs;
  const categoryTitle = isSwap ? 'Battery Swap Hubs' : 'Home Charging Hubs';
  const categorySub = isSwap
    ? 'Choose a nearby hub with 2-minute instant battery swapping'
    : 'Choose a hub with portable home chargers included with each bike';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.catBadge,
                    { backgroundColor: isSwap ? colors.brand.mint : colors.status.infoTint },
                  ]}
                >
                  <Ionicons
                    name={isSwap ? 'flash' : 'home'}
                    size={12}
                    color={isSwap ? colors.brand.primary : colors.status.info}
                  />
                  <Text
                    style={[
                      styles.catBadgeText,
                      { color: isSwap ? colors.brand.primary : colors.status.info },
                    ]}
                  >
                    {categoryTitle}
                  </Text>
                </View>
              </View>
              <Text style={styles.title}>Select Nearby Hub</Text>
              <Text style={styles.subTitle}>{categorySub}</Text>
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </Pressable>
          </View>

          {/* Hub List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {hubs.map((hub) => (
              <Pressable
                key={hub.id}
                style={styles.hubCard}
                onPress={() => {
                  onClose();
                  onSelectHub(hub);
                }}
              >
                <View style={styles.hubTopRow}>
                  <View
                    style={[
                      styles.hubIconBox,
                      { backgroundColor: isSwap ? colors.brand.mint : colors.status.infoTint },
                    ]}
                  >
                    <Ionicons
                      name={isSwap ? 'flash' : 'home'}
                      size={20}
                      color={isSwap ? colors.brand.primary : colors.status.info}
                    />
                  </View>

                  <View style={styles.hubInfo}>
                    <Text style={styles.hubName}>{hub.name}</Text>
                    <Text style={styles.hubAddress} numberOfLines={1}>
                      {hub.address}
                    </Text>
                  </View>

                  <View style={styles.availBadge}>
                    <Text style={styles.availCount}>{hub.availableVehicles}</Text>
                    <Text style={styles.availText}>Bikes</Text>
                  </View>
                </View>

                <View style={styles.hubBottomRow}>
                  <View style={styles.tagsRow}>
                    <View style={styles.distanceTag}>
                      <Ionicons
                        name="navigate-circle"
                        size={13}
                        color={colors.brand.primary}
                      />
                      <Text style={styles.distanceText}>{hub.distance}</Text>
                    </View>

                    <View
                      style={[styles.featureTag, { backgroundColor: hub.badgeBg }]}
                    >
                      <Text
                        style={[styles.featureText, { color: hub.badgeColor }]}
                      >
                        {hub.badge}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.viewBikesBtn}>
                    <Text style={styles.viewBikesText}>View Bikes</Text>
                    <Ionicons name="arrow-forward" size={13} color={colors.common.white} />
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 36,
    maxHeight: '80%',
    ...shadows.card,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  badgeRow: {
    marginBottom: 4,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  catBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
  },
  subTitle: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    paddingBottom: spacing.sm,
  },
  hubCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.subtle,
  },
  hubTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  hubIconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  hubInfo: {
    flex: 1,
  },
  hubName: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.text.primary,
  },
  hubAddress: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    color: colors.text.secondary,
    marginTop: 2,
  },
  availBadge: {
    alignItems: 'center',
    backgroundColor: colors.common.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  availCount: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.brand.primary,
  },
  availText: {
    fontFamily: fontFamily.medium,
    fontSize: 9.5,
    color: colors.text.secondary,
  },
  hubBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.brand.mintSoft,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  distanceText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: colors.brand.primary,
  },
  featureTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  featureText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10.5,
  },
  viewBikesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  viewBikesText: {
    fontFamily: fontFamily.bold,
    fontSize: 11.5,
    color: colors.common.white,
  },
});
