/**
 * CurvedCardTop.tsx
 * -----------------
 * The soft, asymmetric lip on top of the login/verify card.
 *
 * The card's top edge is not a rounded rectangle — it undulates: it rises from
 * the left, crests early (around 14-19% across), dips through the middle where
 * the hero blob overlaps, and settles lower on the right.
 *
 * THIS PATH IS NOT HAND-TUNED. It is lifted verbatim from the Figma export
 * ("RIDE FOR YOU", 430x932 frame) — the white card-cap shape. Earlier versions
 * of this file approximated the curve with guessed bezier control points and
 * took several passes to look close. Now it is the design's own geometry, so
 * it is exact by construction.
 *
 * The viewBox does the scaling, so the shape stays correct at any card width
 * without touching a single coordinate.
 *
 * Usage — the card sets square top corners and reserves the overhang:
 *
 *   <NeoSurface style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0,
 *                        paddingTop: capOverhang(cardWidth) + 24 }}>
 *     <CurvedCardTop width={cardWidth} />
 *     ...content...
 *   </NeoSurface>
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

/* ---- Geometry straight out of the Figma file (430pt frame coordinates) ---- */

/** The cap path exactly as Figma exported it. */
const FIGMA_PATH =
  'M20 454.744V527L407.871 531.5V447.5C406.671 412.7 376.371 405 362.371 409.5L310.891 ' +
  '425.087C277.871 434.5 246.429 428.42 234.262 425.087L179.871 411C138.271 401 91.8708 ' +
  '400.667 73.8708 401.5C29.4708 399.5 21.3708 433.5 20 454.744Z';

const VB_X = 20; // leftmost x of the shape
const VB_Y = 399.5; // topmost y (the crest)
const VB_W = 387.871; // 407.871 - 20
const VB_H = 132; // 531.5 - 399.5

/**
 * How far the cap rises ABOVE the card body, in design units.
 * The card body's top edge sits at y=455 in the Figma frame; the cap crests at
 * y=399.5. Everything below 455 is drawn behind the card and simply blends in.
 */
const OVERHANG = 455 - VB_Y; // 55.5

/**
 * How much vertical space the cap needs above the card, for a given card width.
 * The card should reserve this much top padding so content clears the curve.
 */
export function capOverhang(cardWidth: number): number {
  return Math.round((OVERHANG / VB_W) * cardWidth);
}

type CurvedCardTopProps = {
  /** The card's own width (screen width minus its horizontal margins). */
  width: number;
  /** Override the fill if the card isn't white. */
  color?: string;
};

export function CurvedCardTop({ width: w, color = colors.surface.card }: CurvedCardTopProps) {
  const scale = w / VB_W;
  const height = VB_H * scale;
  const top = -(OVERHANG * scale);

  return (
    <View style={[styles.wrap, { width: w, height, top }]} pointerEvents="none">
      <Svg width={w} height={height} viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}>
        {/*
          Figma gives this cap its own drop shadow (filter2_d: dy 7, blur 29,
          #64646F at 20%). react-native-svg has no dependable blur filter, so
          it is faked by stacking copies of the same path at decreasing
          offsets and low opacity.

          The offsets are NEGATIVE — upward — on purpose. A blur of 29 against
          an offset of only 7 spills well above the edge, so the shadow reads
          mostly as a halo above the curve. Offsetting downward instead would
          push grey copies past the cap's lower edge and paint a band across
          the white card beneath it; upward copies stay inside the cap's own
          area and are covered by the solid fill drawn last.
        */}
        {SHADOW_STEPS.map(({ dy, opacity }) => (
          <Path
            key={dy}
            d={FIGMA_PATH}
            fill={SHADOW_COLOR}
            opacity={opacity}
            transform={`translate(0, ${dy})`}
          />
        ))}

        <Path d={FIGMA_PATH} fill={color} />
      </Svg>
    </View>
  );
}

/** Stacked offsets approximating a 29px blur above the curve. */
const SHADOW_STEPS = [
  { dy: -10, opacity: 0.035 },
  { dy: -7, opacity: 0.04 },
  { dy: -4.5, opacity: 0.045 },
  { dy: -2.5, opacity: 0.05 },
  { dy: -1, opacity: 0.06 },
];
const SHADOW_COLOR = 'rgb(100, 100, 111)'; // Figma's #64646F

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0 },
});
