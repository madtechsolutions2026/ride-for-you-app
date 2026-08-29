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
/*
 * React Native allows one shadow per view, so true two-sided neumorphism
 * isn't free. We approximate the reference with a single large diffuse
 * shadow and NO border — which is what makes it read as "gently raised"
 * rather than "outlined box".
 */
export const neo = {
  /* The big floating login card. */
  card: {
    backgroundColor: colors.surface.card,
    shadowColor: '#46806E',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 45,
    elevation: 16,
  },
  /* A raised white control: the +91 pill, the Google button, icon circles. */
  raised: {
    backgroundColor: colors.surface.card,
    shadowColor: '#46806E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 7,
  },
  /* The phone-number field — a raised white surface, not a bordered input. */
  inset: {
    backgroundColor: colors.surface.card,
    shadowColor: '#46806E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
} as const;
