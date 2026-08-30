import React from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, radius, shadows, spacing } from '../theme';

export type StationHub = {
  id: string;
  name: string;
  address: string;
  distance: string;
  availableVehicles: number;
  hasFastSwap: boolean;
  latitude: number;
  longitude: number;
};

export const NEARBY_HUBS: StationHub[] = [
  {
    id: 'hub-1',
    name: 'Hitech City Metro Hub',
    address: 'Near Pillar 1240, Hitech City Main Rd',
    distance: '0.6 km away',
    availableVehicles: 14,
    hasFastSwap: true,
    latitude: 17.4435,
    longitude: 78.3772,
  },
  {
    id: 'hub-2',
    name: 'Madhapur Cyber Towers Hub',
    address: 'Opp. Cyber Gateway, Madhapur',
    distance: '1.2 km away',
    availableVehicles: 9,
    hasFastSwap: true,
    latitude: 17.4504,
    longitude: 78.3808,
  },
  {
    id: 'hub-3',
    name: 'Gachibowli Bio-Diversity Hub',
    address: 'Near Bio-Diversity Junction, Gachibowli',
    distance: '2.4 km away',
    availableVehicles: 6,
    hasFastSwap: false,
    latitude: 17.4334,
    longitude: 78.3668,
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectHub?: (hub: StationHub) => void;
};

export function NearbyHubsSheet({ visible, onClose, onSelectHub }: Props) {
  const handleNavigate = (hub: StationHub) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${hub.latitude},${hub.longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() => {});
  };

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
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Nearby EV Stations</Text>
              <Text style={styles.subTitle}>Select a hub to view vehicles or get directions</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={6}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </Pressable>
          </View>

          {/* Hub List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {NEARBY_HUBS.map((hub) => (
              <View key={hub.id} style={styles.hubCard}>
                <View style={styles.hubTopRow}>
                  <View style={styles.hubIconBox}>
                    <Ionicons name="flash" size={20} color={colors.brand.primary} />
                  </View>

                  <View style={styles.hubInfo}>
                    <Text style={styles.hubName}>{hub.name}</Text>
                    <Text style={styles.hubAddress} numberOfLines={1}>
                      {hub.address}
                    </Text>
                  </View>

                  <View style={styles.availBadge}>
                    <Text style={styles.availCount}>{hub.availableVehicles}</Text>
                    <Text style={styles.availText}>Scooters</Text>
                  </View>
                </View>

                <View style={styles.hubBottomRow}>
                  <View style={styles.tagsRow}>
                    <View style={styles.distanceTag}>
                      <Ionicons name="navigate-circle" size={13} color={colors.brand.primary} />
                      <Text style={styles.distanceText}>{hub.distance}</Text>
                    </View>

                    {hub.hasFastSwap && (
                      <View style={styles.swapTag}>
                        <Ionicons name="sync" size={12} color="#059669" />
                        <Text style={styles.swapText}>2-Min Swap</Text>
                      </View>
                    )}
                  </View>

                  <Pressable
                    style={styles.navigateBtn}
                    onPress={() => handleNavigate(hub)}
                    hitSlop={4}
                  >
                    <Text style={styles.navigateText}>Navigate</Text>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
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
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.text.primary,
  },
  subTitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    paddingBottom: spacing.sm,
  },
  hubCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#DCFCE7',
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
    marginTop: 1,
  },
  availBadge: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
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
    borderTopColor: '#EDF2F7',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  distanceText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: colors.brand.primary,
  },
  swapTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  swapText: {
    fontFamily: fontFamily.medium,
    fontSize: 10.5,
    color: '#059669',
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  navigateText: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});
