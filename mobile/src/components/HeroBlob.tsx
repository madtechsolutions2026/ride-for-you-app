/**
 * HeroBlob.tsx
 * ------------
 * The frosted-teal curved shape at the top of the login screen, with the
 * scooter photo composited inside it and a clean single-sweep curve on the
 * left that fades softly into the page.
 *
 * Layer order (bottom → top), all clipped to the same blob outline:
 *   1. pale teal glass gradient   — the blob's own colour
 *   2. the scooter photo          — cropped to the blob
 *   3. a thin teal wash           — unifies the photo with the glass
 *   4. a white edge-fade          — melts the left edge into the page
 *
 * The blob outline is ONE smooth concave curve (two bezier segments) so it
 * reads clean, not wobbly. Tune the multipliers while watching the emulator.
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
};

// Swap this line if you generate a new hero photo:
const HERO_IMAGE = require('../../assets/loginimg.png');

export function HeroBlob({ width: w, height: h }: HeroBlobProps) {
  // One clean sweep: enters mid-top, bulges out to the left, then the BOTTOM
  // edge curves up to the right so it reads as a soft wave above the card.
  const blob = [
    `M ${w * 0.52} 0`,
    `C ${w * 0.27} ${h * 0.24}, ${w * 0.24} ${h * 0.58}, ${w * 0.42} ${h * 0.8}`,
    `C ${w * 0.56} ${h * 0.97}, ${w * 0.78} ${h * 0.95}, ${w} ${h * 0.72}`,
    `L ${w} 0 Z`,
  ].join(' ');

  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h}>
        <Defs>
          <ClipPath id="heroClip">
            <Path d={blob} />
          </ClipPath>

          {/* pale frosted teal — top to bottom */}
          <LinearGradient id="glassFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.brand.glassTop} />
            <Stop offset="1" stopColor={colors.brand.glassBottom} />
          </LinearGradient>

          {/* opaque page-colour on the far left → transparent by ~30% across.
              Kept short so the teal glass band stays visible. */}
          <LinearGradient id="edgeFade" x1="0" y1="0" x2="1" y2="0.1">
            <Stop offset="0" stopColor={colors.surface.background} stopOpacity={1} />
            <Stop offset="0.3" stopColor={colors.surface.background} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* 1. teal glass base */}
        <Path d={blob} fill="url(#glassFill)" />

        {/* 2. scooter photo, cropped to the blob. The image already has the
              scooter framed on the right + pale space on the left, so we just
              cover the whole hero and let the blob clip the left edge. */}
        <SvgImage
          href={HERO_IMAGE}
          x={0}
          y={0}
          width={w}
          height={h}
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#heroClip)"
        />

        {/* 3. faint teal wash (image is already mint-tinted, so keep it light) */}
        <Path d={blob} fill={colors.brand.glassBottom} opacity={0.12} />

        {/* 4. soft fade on the inner (left) edge */}
        <Path d={blob} fill="url(#edgeFade)" />
      </Svg>
    </View>
  );
}
