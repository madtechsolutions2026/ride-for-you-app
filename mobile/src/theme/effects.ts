/**
 * effects.ts
 * ----------
 * The two surface "materials" from the mockup:
 *
 *   glass  — frosted / see-through (language pill, shield badge, trust circles)
 *   neo    — soft raised white plastic (the login card, the +91 pill, inputs,
 *            the Google button)
 *
 * Screens don't reinvent these — they use <Glass> and <NeoSurface> components
 * (built next) which read from here.
 */

import { colors } from './colors';

/* ---------------- Glassmorphism ---------------- */
/*
 * Real blur comes from <BlurView> (expo-blur). These values sit ON TOP of the
 * blurred area to give it colour + an edge.
 */
export const glass = {
  blurIntensity: 24, // 0–100, how strong the frost is
  blurTint: 'light' as const, // 'light' | 'dark' | 'default'
  fill: 'rgba(255, 255, 255, 0.55)', // white wash over the blur
  border: 'rgba(255, 255, 255, 0.75)', // bright hairline edge = the "glass rim"
  borderWidth: 1,
};

/* ---------------- Neumorphism ---------------- */
/*
 * React Native gives one shadow per view. True neumorphism wants two (a light
 * one top-left + a dark one bottom-right). We fake it with:
 *   - a bright inner-ish border (top highlight)
 *   - one soft grey-green drop shadow (the "sits above the page" feel)
 * Good enough to read as neumorphic; upgrade later if we ever need the real thing.
 */
export const neo = {
  /* A raised white panel: card, Google button, the +91 pill */
  raised: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#5F8375', // muted grey-green
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.45,
    shadowRadius: 48,
    elevation: 18, // Android
  },
  /* A gently pressed-in look: the phone-number text field */
  inset: {
    backgroundColor: '#FBFDFC',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#8AA79B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 1,
  },
} as const;
