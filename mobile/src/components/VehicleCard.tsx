/**
 * VehicleCard.tsx
 * ---------------
 * A card in the "Recommended for you" carousel on Home: product photo, name,
 * spec line, price and a green arrow button. Optional "Most Popular" ribbon.
 *
 * The image is expected to be a TRANSPARENT product cutout so it reads as a
 * product sitting on the white card, not a photo tile.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, radius, spacing } from '../theme';
import { NeoSurface } from './NeoSurface';

export type Vehicle = {
  id: string;
  name: string;
  rangeKm: number;
  topSpeed: number;
  pricePerDay: number;
  image: any; // require(...) source
  popular?: boolean;
};

export function VehicleCard({ vehicle, onPress }: { vehicle: Vehicle; onPress?: () => void }) {
  return (
    <NeoSurface borderRadius={radius.lg} style={styles.card}>
      {vehicle.popular ? (
        <View style={styles.ribbon}>
          <Ionicons name="checkmark-circle" size={11} color={colors.brand.primary} />
          <Text style={styles.ribbonText}>Most Popular</Text>
        </View>
      ) : (
        <View style={styles.ribbonSpacer} />
      )}

      <Image source={vehicle.image} style={styles.image} contentFit="contain" transition={150} />

      <Text style={styles.name}>{vehicle.name}</Text>
      <Text style={styles.spec}>
        {vehicle.rangeKm} km range  •  {vehicle.topSpeed} km/h
      </Text>

      <View style={styles.priceRow}>
        <Text style={styles.priceUnit}>
          <Text style={styles.price}>₹{vehicle.pricePerDay}</Text> / day
        </Text>
        <Pressable style={styles.arrow} onPress={onPress} hitSlop={6}>
          <Ionicons name="arrow-forward" size={17} color={colors.text.inverse} />
        </Pressable>
      </View>
    </NeoSurface>
  );
}

const styles = StyleSheet.create({
  card: { width: 204, padding: spacing.md, marginRight: spacing.md },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.brand.mint,
    borderRadius: radius.pill,
    paddingLeft: 7,
    paddingRight: 10,
    paddingVertical: 4,
  },
  ribbonSpacer: { height: 23 },
  ribbonText: { fontFamily: fontFamily.bold, fontSize: 9.5, color: colors.brand.primary },
  image: { width: '100%', height: 106, marginTop: spacing.sm, marginBottom: spacing.md },
  name: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text.primary },
  spec: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.text.secondary, marginTop: 4 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  priceUnit: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.text.secondary },
  price: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.text.primary },
  arrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
