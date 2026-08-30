/**
 * HeroBlob.tsx
 * ------------
 * The frosted-teal curved shape at the top of the login screen with the
 * scooter photo composited inside. One clean sweep on the left; the bottom
 * edge dips in the centre and drapes over the login card, with a soft
 * shadow along that edge so the blob reads as a raised layer (neumorphic).
 *
 * `overhang` lets the SVG draw BELOW its nominal height so the curve can
 * spill over the top of the card (the card gets matching top padding + a
 * lower zIndex).
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
import { images } from '../assets';

type HeroBlobProps = {
  width: number;
  height: number;
  /** extra pixels to draw below `height` so the curve can overlap the card */
  overhang?: number;
};


export function HeroBlob({ width: w, height: h, overhang = 0 }: HeroBlobProps) {
  const svgH = h + overhang;

  // Left edge: one smooth S past the wordmark (card's top-left stays clear).
  // Bottom edge: dips in the centre, rises to the right where the card tucks under.
  const bottomEdge =
    `C ${w * 0.32} ${h * 0.74}, ${w * 0.46} ${h * 0.78}, ${w * 0.62} ${h * 0.83} ` +
    `C ${w * 0.76} ${h * 0.87}, ${w * 0.9} ${h * 0.8}, ${w} ${h * 0.66}`;

  const blob = [
    `M ${w * 0.46} 0`,
    `C ${w * 0.28} ${h * 0.18}, ${w * 0.19} ${h * 0.45}, ${w * 0.26} ${h * 0.68}`,
    bottomEdge,
    `L ${w} 0 Z`,
  ].join(' ');

  // just the bottom curve, for the drop shadow
  const seam = `M ${w * 0.26} ${h * 0.68} ${bottomEdge}`;

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
            <Stop offset="0.2" stopColor={colors.surface.background} stopOpacity={0} />
          </LinearGradient>

          <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.78" stopColor={colors.brand.glassBottom} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.brand.glassBottom} stopOpacity={0.55} />
          </LinearGradient>
        </Defs>

        {/* ---- soft shadow UNDER the curve (drawn first, so it sits on the card) ---- */}
        <Path d={seam} transform="translate(0, 7)" stroke={colors.overlay.blobShade} strokeWidth={16} fill="none" strokeLinecap="round" />
        <Path d={seam} transform="translate(0, 4)" stroke={colors.overlay.blobShade} strokeWidth={9} fill="none" strokeLinecap="round" />

        {/* 1. teal glass base */}
        <Path d={blob} fill="url(#glassFill)" />

        {/* 2. scooter photo, cropped to the blob.
              The source photo is portrait (1086x1448) but the hero is roughly
              square, so the rect is given the PHOTO's aspect ratio (0.75) and
              offset upward — otherwise "slice" crops the scooter's wheels off. */}
        <SvgImage
          href={images.authHero}
          x={w * 0.13}
          y={-h * 0.2}
          width={w * 0.87}
          height={h * 1.19}
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#heroClip)"
        />

        {/* 3. NO teal wash — the v2 photo is already cool-toned. Washing it here is
              what made the hero read pale and blurry. */}

        {/* 4. soft fade on the inner (left) edge */}
        <Path d={blob} fill="url(#edgeFade)" />

        {/* 5. fade the bottom so the seam with the card is soft */}
        <Path d={blob} fill="url(#bottomFade)" />

        {/* 6. a bright hairline along the top of the curve (neumorphic highlight) */}
        <Path d={seam} stroke={colors.overlay.blobSheen} strokeWidth={1.5} fill="none" />
      </Svg>
    </View>
  );
}
