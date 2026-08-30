/**
 * typography.ts
 * -------------
 * Font names + ready-made text styles.
 *
 * React Native does NOT ship nice fonts. You must load a font file into the app
 * before you can use it (we do that in App.tsx — see next step). Once loaded,
 * you refer to it by these string names.
 *
 * We're starting with "Poppins" (free, geometric, rounded — closest to the
 * mockups). To swap in a different / custom font later, you only change:
 *   1. the font files loaded in App.tsx
 *   2. the five strings in `fontFamily` below
 * Nothing else in the app changes.
 */

export const fontFamily = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
  black: 'Poppins_900Black', // the giant "RIDE FOR YOU" hero text
} as const;

/**
 * Named text styles. Spread one of these into a Text's style:
 *   <Text style={[textStyles.h1, { color: colors.text.primary }]}>Welcome back</Text>
 */
export const textStyles = {
  /*
   * "RIDE / FOR / YOU" giant hero text.
   *
   * Measured off the login mockup rather than eyeballed:
   *   cap height of RIDE / FOR  = 25.2dp / 26.1dp
   *   line pitch (top to top)   = 34.2dp, consistent across both gaps
   * Poppins' cap height is 0.70em, so a 25.5dp cap means ~36px, not 40px —
   * and the lines sit 34dp apart, not 42dp. The old values made the wordmark
   * both too large and too loosely stacked, which is what read as "wrong".
   */
  display: {
    fontFamily: fontFamily.black,
    fontSize: 36,
    lineHeight: 34,
    letterSpacing: -1,
  },
  /* Screen titles: "Welcome back", "Let's verify your identity" */
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  /* Section headers: "Identity Document", "Rental plans" */
  h2: {
    fontFamily: fontFamily.semibold,
    fontSize: 17,
    lineHeight: 24,
  },
  /* Default paragraph / list text */
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  /* Slightly smaller supporting text */
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  /* Tiny labels, captions, "Pending" pills, helper hints */
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  /* Text inside buttons */
  button: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
} as const;
