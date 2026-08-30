/**
 * effects.ts
 * ----------
 * The two surface "materials" from the design:
 *
 *   glass  — frosted / see-through (language pill, shield badge, trust circles)
 *   neo    — soft raised white plastic (the login card, the +91 pill, inputs)
 *
 * Shadow values come from the Figma export's filter definitions, same source
 * as shadows.ts — see the mapping note there for how a Figma <filter> becomes
 * a boxShadow (in particular: stdDeviation is HALF the blur radius).
 *
 * Design rule: no hard borders. Depth comes from shadow alone.
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
export const neo = {
  /* The big floating login card. Figma filter2_d. */
  card: {
    backgroundColor: colors.surface.card,
    boxShadow: [
      { offsetX: 0, offsetY: 7, blurRadius: 29, spreadDistance: 0, color: 'rgba(100, 100, 111, 0.2)' },
    ],
  },

  /* A raised white control: the +91 pill, icon circles. Figma filter4_d. */
  raised: {
    backgroundColor: colors.surface.card,
    boxShadow: [
      { offsetX: 0, offsetY: 4, blurRadius: 12, spreadDistance: 0, color: 'rgba(0, 0, 0, 0.2)' },
    ],
  },

  /*
   * The phone-number field. Figma draws it as a plain white rounded rect with
   * only a light drop shadow — not the pressed-in inner shadow that was
   * assumed here before. Kept faithful to the file.
   */
  inset: {
    backgroundColor: colors.surface.card,
    boxShadow: [
      { offsetX: 0, offsetY: 1, blurRadius: 4, spreadDistance: 0, color: 'rgba(0, 0, 0, 0.16)' },
    ],
  },
} as const;
