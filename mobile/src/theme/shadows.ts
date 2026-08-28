/**
 * shadows.ts
 * ----------
 * Soft "neumorphic" shadows — the puffy, floating look in the mockups.
 *
 * IMPORTANT limitation: React Native allows only ONE shadow per view
 * (iOS uses shadow*, Android uses `elevation`). True neumorphism has TWO
 * shadows (a light one top-left, a dark one bottom-right). We approximate
 * with a single soft shadow + a hairline border. It reads as "the same"
 * to 95% of people and stays cross-platform. If we ever need the real
 * double-shadow, we nest two views or add a library — later, not now.
 */

import { colors } from './colors';

export const shadows = {
  /* Big white cards (the login card, vehicle card) */
  card: {
    shadowColor: '#1A3A2A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4, // Android's version — a number, not a colour
  },
  /* Small raised things: chips, the "+91" pill, icon circles */
  soft: {
    shadowColor: '#1A3A2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  /* The green primary button glows slightly green */
  button: {
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
