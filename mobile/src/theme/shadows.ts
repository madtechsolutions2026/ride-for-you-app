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
    shadowColor: '#46806E',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.14,
    shadowRadius: 40,
    elevation: 12, // Android's version — a number, not a colour
  },
  /* Small raised things: chips, the "+91" pill, icon circles */
  soft: {
    shadowColor: '#46806E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  /*
   * Tiny mint circles (shield badge, trust icons).
   * NOTE: Android draws `elevation` shadows from the view's *bounds*, which
   * shows as a square halo behind a small circle on a white card — so this
   * preset deliberately has no elevation and relies on the iOS shadow only.
   */
  subtle: {
    shadowColor: '#46806E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 0,
  },
  /* The green primary button glows slightly green */
  button: {
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 9,
  },
} as const;
