/**
 * CurvedCardTop.tsx
 * -----------------
 * The soft, asymmetric curved lip that sits on top of the login/verify card.
 *
 * The reference design's card is NOT a plain rounded rectangle — its top edge
 * sweeps up from the left, crests just left of centre, and settles lower on
 * the right, echoing the hero blob's curve above it.
 *
 * React Native can't express that with `borderRadius`, so we draw it as an SVG
 * "cap" filled in the card's own colour and place it directly above the card
 * (whose own top corners are square). Cap + card read as one shape.
 *
 * Usage — the card must set `borderTopLeftRadius: 0` / `borderTopRightRadius: 0`
 * and reserve `height` px of top padding for the cap:
 *
 *   <View style={{ paddingTop: CARD_CAP_HEIGHT + 24 }}>
 *     <CurvedCardTop width={cardWidth} />
 *     ...content...
 *   </View>
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

/** How tall the curved lip is. Content should clear this. */
export const CARD_CAP_HEIGHT = 52;

type CurvedCardTopProps = {
  /** The card's own width (screen width minus its horizontal margins). */
  width: number;
  /** Override the fill if the card isn't white. */
  color?: string;
};

export function CurvedCardTop({ width: w, color = colors.surface.card }: CurvedCardTopProps) {
  const C = CARD_CAP_HEIGHT;

  // Corner softness at the two ends of the lip.
  const r = 30;
  // Where each end of the curve sits vertically inside the cap.
  const leftY = 22;
  const rightY = 30;

  const path = [
    `M 0 ${C}`,
    `L 0 ${leftY + r}`,
    `Q 0 ${leftY}, ${r} ${leftY - 6}`, // rounded top-left, already rising
    `C ${w * 0.22} ${6}, ${w * 0.34} ${2}, ${w * 0.52} ${8}`, // crest, just left of centre
    `C ${w * 0.72} ${14}, ${w * 0.86} ${rightY - 12}, ${w - r} ${rightY - 4}`,
    `Q ${w} ${rightY}, ${w} ${rightY + r}`, // rounded top-right
    `L ${w} ${C}`,
    'Z',
  ].join(' ');

  return (
    <View style={[styles.wrap, { width: w, height: C }]} pointerEvents="none">
      <Svg width={w} height={C}>
        <Path d={path} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits just above the card body; the card reserves matching top padding.
  wrap: { position: 'absolute', top: -CARD_CAP_HEIGHT, left: 0 },
});
