/**
 * StylizedMap.tsx
 * ---------------
 * A decorative, non-interactive "map" — light roads, parks and a river drawn
 * with SVG, plus station pins and the user's location dot on top.
 *
 * This is a PLACEHOLDER. When we add `react-native-maps` (needs a dev build +
 * a Google Maps key) this component gets swapped for a real map with the same
 * props. Until then it matches the mockup's stylised look.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, radius, shadows } from '../theme';

export type MapStation = {
  id: string;
  /** 0–1 position across the map */
  x: number;
  y: number;
  available: number;
};

type StylizedMapProps = {
  width: number;
  height: number;
  stations: MapStation[];
  onRecenter?: () => void;
};

export function StylizedMap({ width: w, height: h, stations, onRecenter }: StylizedMapProps) {
  return (
    <View style={[styles.wrap, { width: w, height: h }]}>
      <Svg width={w} height={h}>
        <Rect x={0} y={0} width={w} height={h} fill="#EEF1EF" />

        {/* parks */}
        <Path d={`M ${w * 0.05} ${h * 0.05} q ${w * 0.12} ${-h * 0.1} ${w * 0.22} ${h * 0.06} q ${h * 0.04} ${w * 0.1} ${-h * 0.06} ${w * 0.14} q ${-w * 0.14} ${h * 0.06} ${-w * 0.18} ${-h * 0.08} Z`} fill="#DDEBDD" />
        <Path d={`M ${w * 0.72} ${h * 0.66} q ${w * 0.16} ${-h * 0.06} ${w * 0.28} ${h * 0.08} l 0 ${h * 0.3} l ${-w * 0.34} 0 Z`} fill="#DDEBDD" />

        {/* river */}
        <Path d={`M ${w * 0.9} 0 C ${w * 0.8} ${h * 0.3}, ${w} ${h * 0.55}, ${w * 0.82} ${h}`} stroke="#CBE3EC" strokeWidth={14} fill="none" strokeLinecap="round" />

        {/* roads */}
        <Path d={`M 0 ${h * 0.42} L ${w} ${h * 0.36}`} stroke="#FFFFFF" strokeWidth={10} fill="none" />
        <Path d={`M ${w * 0.32} 0 L ${w * 0.4} ${h}`} stroke="#FFFFFF" strokeWidth={10} fill="none" />
        <Path d={`M 0 ${h * 0.8} L ${w * 0.75} ${h * 0.72}`} stroke="#FFFFFF" strokeWidth={8} fill="none" />
        <Path d={`M ${w * 0.66} 0 L ${w * 0.6} ${h}`} stroke="#FFFFFF" strokeWidth={6} fill="none" />
      </Svg>

      {/* station pins */}
      {stations.map((s) => (
        <View key={s.id} style={[styles.pin, { left: s.x * w - 20, top: s.y * h - 20 }]}>
          <View style={styles.pinDot}>
            <Ionicons name="flash" size={14} color={colors.text.inverse} />
          </View>
          <View style={styles.pinLabel}>
            <Text style={styles.pinCount}>{s.available}</Text>
            <Text style={styles.pinAvail}>Available</Text>
          </View>
        </View>
      ))}

      {/* user location */}
      <View style={[styles.userWrap, { left: w * 0.5 - 26, top: h * 0.5 - 26 }]}>
        <View style={styles.userHalo} />
        <View style={styles.userDot} />
      </View>

      {/* recenter button */}
      <View style={styles.recenter}>
        <Ionicons name="locate" size={18} color={colors.text.primary} onPress={onRecenter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden' },
  pin: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  pinDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand.primary,
    borderWidth: 3,
    borderColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  pinLabel: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: -6,
    ...shadows.soft,
  },
  pinCount: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.text.primary },
  pinAvail: { fontFamily: fontFamily.regular, fontSize: 9, color: colors.text.secondary },

  userWrap: { position: 'absolute', width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  userHalo: { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(37,99,235,0.15)' },
  userDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2563EB',
    borderWidth: 3,
    borderColor: colors.surface.card,
  },

  recenter: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
});
