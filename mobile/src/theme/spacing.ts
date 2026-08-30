/**
 * spacing.ts
 * ----------
 * Fixed set of gaps and corner radii. Designers (and good apps) don't use
 * random numbers like 13 or 27 for padding — they pick from a small scale so
 * everything lines up. We use a 4-point scale.
 *
 * Usage:  padding: spacing.lg   →  24px
 *         borderRadius: radius.card
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 24,
  card: 28, // the big white login card
  pill: 999, // fully rounded — buttons, chips, the "+91" selector
} as const;

/** Standard screen edge padding (left/right gutter on every screen). */
export const screenPadding = spacing.lg; // 24
