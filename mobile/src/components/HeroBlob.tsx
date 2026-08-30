/**
 * HeroBlob.tsx
 * ------------
 * The curved hero shape at the top of the auth screens, with the scooter photo
 * composited inside it.
 *
 * THIS PATH IS NOT HAND-TUNED. It is the shape exactly as exported from Figma
 * ("RIDE FOR YOU", 430x932 frame — the layer named "Vector 2"). Earlier
 * versions approximated it with guessed control points; this is the real
 * geometry, so it matches the design by construction.
 *
 * Everything is expressed in the Figma frame's own coordinates and scaled by
 * the viewBox, which means the shape stays correct on any screen width without
 * a single number being recalculated.
 *
 * In the frame the shape occupies x 152 -> 430 (it is anchored to the right
 * edge) and y 0 -> 430, so the component renders a square 430x430 viewBox and
 * lets the blob sit in its correct place inside it.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Path, ClipPath, Defs, Image as SvgImage, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../theme';
import { images } from '../assets';

/** The blob outline, verbatim from the Figma export. */
const FIGMA_BLOB =
  'M430.094 375V0H279.094C249.894 37.6 249.761 80.6667 253.094 98.5C256.594 138.5 232.761 ' +
  '170.833 219.094 180.5L201.094 197L184.594 214C122.594 281.5 163.093 349.5 191.093 ' +
  '371L204.593 382L242.093 407.5L279.094 430C347.094 425.5 405.094 390 430.094 375Z';

/** The design frame's width, and the blob's vertical extent within it. */
const FRAME_W = 430;
const BLOB_H = 430;

/** Blob height as a multiple of screen width — use this to size the hero area. */
export const HERO_RATIO = BLOB_H / FRAME_W; // 1.0

type HeroBlobProps = {
  /** Full screen width. The blob positions itself against the right edge. */
  width: number;
};

export function HeroBlob({ width: w }: HeroBlobProps) {
  const h = w * HERO_RATIO;

  return (
    <View style={{ width: w, height: h }} pointerEvents="none">
      <Svg width={w} height={h} viewBox={`0 0 ${FRAME_W} ${BLOB_H}`}>
        <Defs>
          <ClipPath id="heroClip">
            <Path d={FIGMA_BLOB} />
          </ClipPath>

          {/*
            Figma applies an inner shadow to this shape: dy 10, blur 8,
            #BBDBD8. SVG has no inner-shadow primitive, so it is drawn as a
            soft stroke clipped to the shape's own outline — the stroke's
            outer half is cut away, leaving only the inside edge.
          */}
          <LinearGradient id="blobSheen" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.overlay.blobSheen} stopOpacity={0.55} />
            <Stop offset="0.35" stopColor={colors.overlay.blobSheen} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/*
          1. The photo, cropped to the blob outline.

          These four numbers are not a guess. Figma fills this shape with a
          pattern carrying the transform:

            matrix(0.00117371 0 0 0.000759073 -0.000828276 -0.0801645)

          in objectBoundingBox units against the shape's 278.094 x 430 box.
          Decoded against the source image (852 x 1846) that resolves to the
          placement below, at a uniform 0.3264 scale on both axes — so the
          photo is neither stretched nor cropped differently from the design.

          Note the negative y: the image is taller than the shape and sits
          pulled upward, which is what frames the scooter where it should be.
        */}
        <SvgImage
          href={images.authHero}
          x={151.77}
          y={-34.471}
          width={278.094}
          height={602.537}
          preserveAspectRatio="none"
          clipPath="url(#heroClip)"
        />

        {/*
          2. Figma's inner shadow (dy 10, blur 8, #BBDBD8).

          This was previously drawn as a 16-wide stroke clipped to the outline.
          That is not an inner shadow — it rendered as a hard mint BORDER
          around the whole shape. SVG has no inner-shadow primitive and
          react-native-svg's filter support is unreliable, so the honest
          options are "soft and subtle" or "absent". A thin, low-opacity edge
          hints at the depth without drawing a ring.
        */}
        <Path
          d={FIGMA_BLOB}
          stroke="#BBDBD8"
          strokeWidth={3}
          fill="none"
          opacity={0.35}
          transform="translate(0, 6)"
          clipPath="url(#heroClip)"
        />
      </Svg>
    </View>
  );
}
