/**
 * effects.ts
 * ----------
 * The two surface "materials" from the reference design:
 *
 *   glass  — frosted / see-through (language pill, shield badge, trust circles)
 *   neo    — soft raised white plastic (the login card, the +91 pill, inputs,
 *            the Google button)
 *
 * Design rule from the reference: NO hard borders anywhere. Depth comes from
 * large, very diffuse, low-opacity shadows in a cool grey-green — never black.
 *
 * See shadows.ts for why these moved from shadow* + elevation to `boxShadow`:
 * short version, the old props did nothing on Android, and boxShadow lets one
 * view carry several shadows so the neumorphism is real rather than faked.
 */

import { colors } from './colors';

/* ---------------- Glassmorphism ---------------- */
export const glass = {
  blurIntensity: 26, // 0–100, how strong the frost is
  blurTint: 'light' as const,
  fill: 'rgba(255, 255, 255, 0.68)', // white wash over the blur
  border: 'rgba(255, 255, 255, 0.85)', // bright hairline = the "glass rim"
  borderWidth: 1,
};

/* ---------------- Neumorphism ---------------- */
const TINT = (a: number) => `rgba(70, 128, 110, ${a})`;

export const neo = {
  /*
   * The big floating login card.
   *
   * Two shadows: a wide ambient halo, and a tight contact shadow just under
   * the edge. Measured off the mockup, this shadow is subtle — the card sits
   * only a few levels below pure white where it meets the page.
   */
  card: {
    backgroundColor: colors.surface.card,
    boxShadow: [
      { offsetX: 0, offsetY: 18, blurRadius: 44, spreadDistance: -10, color: TINT(0.18) },
      { offsetX: 0, offsetY: 4, blurRadius: 12, spreadDistance: -6, color: TINT(0.1) },
    ],
  },

  /* A raised white control: the +91 pill, the Google button, icon circles. */
  raised: {
    backgroundColor: colors.surface.card,
    boxShadow: [
      { offsetX: 0, offsetY: 8, blurRadius: 20, spreadDistance: -6, color: TINT(0.15) },
      { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: -3, color: TINT(0.08) },
    ],
  },

  /*
   * The phone-number field.
   *
   * Now genuinely inset: an INNER shadow along the top edge reads as "pressed
   * into the card", which is what the mockup shows and what a single outer
   * shadow could never express. Paired with a whisper of outer shadow so the
   * pill still separates from the card behind it.
   */
  inset: {
    backgroundColor: colors.surface.card,
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: TINT(0.14), inset: true },
      { offsetX: 0, offsetY: 1, blurRadius: 3, spreadDistance: 0, color: TINT(0.07) },
    ],
  },
} as const;
