/**
 * HeroBlob.tsx
 * ------------
 * The frosted-teal curved shape at the top of the login screen with the
 * scooter photo composited inside, and an organic S-curve on its left + a
 * soft lobe at the bottom-left where it meets the card.
 *
 * `overhang` lets the SVG draw BELOW its nominal height so the blob's curved
 * bottom can spill over the top of the login card (the card is given a
 * matching top padding + lower zIndex).
 *
 * Layer order (all clipped to the blob outline):
 *   1. pale teal glass gradient   — the blob's own colour
 *   2. the scooter photo          — cropped to the blob
 *   3. a faint teal wash          — unifies the photo with the glass
 *   4. a white edge-fade          — melts the left edge into the page
 */

import React from 'react';
import { View } from 'react-native';
import Svg, {
  Path,
  ClipPath,
  Defs,
  Image as SvgImage,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { colors } from '../theme';

type HeroBlobProps = {
  width: number;
  height: number;
  /** extra pixels to draw below `height` so the curve can overlap the card */
  overhang?: number;
};

// Swap this line if you generate a new hero photo:
const HERO_IMAGE = require('../../assets/loginimg.png');

export function HeroBlob({ width: w, height: h, overhang = 0 }: HeroBlobProps) {
  const svgH = h + overhang;

  // Left edge: strong S past the wordmark. Bottom edge: dips into a soft lobe
  // on the left, then sweeps up to the right. Geometry is anchored to `h`.
  const blob = [
    `M ${w * 0.52} 0`,
    `C ${w * 0.3} ${h * 0.17}, ${w * 0.24} ${h * 0.4}, ${w * 0.33} ${h * 0.57}`,
    `C ${w * 0.42} ${h * 0.73}, ${w * 0.31} ${h * 0.85}, ${w * 0.17} ${h * 0.91}`,
    `C ${w * 0.1} ${h * 0.94}, ${w * 0.13} ${h * 1.02}, ${w * 0.33} ${h * 1.03}`,
    `C ${w * 0.57} ${h * 1.04}, ${w * 0.8} ${h * 0.92}, ${w} ${h * 0.64}`,
    `L ${w} 0 Z`,
  ].join(' ');

  return (
    <View style={{ width: w, height: svgH }}>
      <Svg width={w} height={svgH}>
        <Defs>
          <ClipPath id="heroClip">
            <Path d={blob} />
          </ClipPath>

          <LinearGradient id="glassFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.brand.glassTop} />
            <Stop offset="1" stopColor={colors.brand.glassBottom} />
          </LinearGradient>

          <LinearGradient id="edgeFade" x1="0" y1="0" x2="1" y2="0.1">
            <Stop offset="0" stopColor={colors.surface.background} stopOpacity={1} />
            <Stop offset="0.3" stopColor={colors.surface.background} stopOpacity={0} />
          </LinearGradient>

          {/* softens the photo edge where the blob overlaps the card */}
          <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.72" stopColor={colors.brand.glassBottom} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.brand.glassBottom} stopOpacity={0.85} />
          </LinearGradient>
        </Defs>

        {/* 1. teal glass base */}
        <Path d={blob} fill="url(#glassFill)" />

        {/* 2. scooter photo, cropped to the blob */}
        <SvgImage
          href={HERO_IMAGE}
          x={0}
          y={0}
          width={w}
          height={h}
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#heroClip)"
        />

        {/* 3. faint teal wash (image is already mint-tinted) */}
        <Path d={blob} fill={colors.brand.glassBottom} opacity={0.12} />

        {/* 4. soft fade on the inner (left) edge */}
        <Path d={blob} fill="url(#edgeFade)" />

        {/* 5. fade the bottom so the seam with the card is soft, not a photo edge */}
        <Path d={blob} fill="url(#bottomFade)" />
      </Svg>
    </View>
  );
}
