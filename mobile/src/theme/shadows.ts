/**
 * shadows.ts
 * ----------
 * Soft "neumorphic" shadows — the puffy, floating look in the mockups.
 *
 * WHY THIS FILE CHANGED
 * ---------------------
 * It used to use `shadowColor` / `shadowOffset` / `shadowOpacity` /
 * `shadowRadius` with an `elevation` number bolted on for Android.
 * That does not work: Android IGNORES all four shadow* props. It only reads
 * `elevation`, which draws a hard, neutral-grey shadow derived from the view's
 * bounds — nothing like the wide, diffuse green-grey glow in the mockup.
 * Two presets were effectively invisible on Android because of it.
 *
 * React Native 0.81 (New Architecture, which Expo SDK 54 enables by default)
 * supports the CSS-style `boxShadow` prop on BOTH platforms — with colour,
 * blur, spread, AND multiple shadows on one view. That last part is what
 * neumorphism actually needs, and the reason the old comment here said
 * "true neumorphism has TWO shadows … later, not now". Later is now.
 *
 * Each preset below is a broad ambient shadow (the soft halo) plus a tighter
 * contact shadow (what stops the card looking like it's floating in space).
 * Measured against the mockup, the real shadows are SOFT — the card interior
 * sits only 4-6 levels below pure white — so opacities here are deliberately
 * low. If it looks too flat on a real screen, raise the ambient opacity first.
 *
 * NOTE: `boxShadow` requires the New Architecture. If it is ever turned off,
 * these shadows silently disappear rather than falling back.
 */

/** The shadow colour everything uses — a cool grey-green, never black. */
const TINT = (a: number) => `rgba(70, 128, 110, ${a})`;

export const shadows = {
  /* Big white panels: the login card, vehicle cards, bottom sheets. */
  card: {
    boxShadow: [
      { offsetX: 0, offsetY: 18, blurRadius: 44, spreadDistance: -10, color: TINT(0.18) },
      { offsetX: 0, offsetY: 4, blurRadius: 12, spreadDistance: -6, color: TINT(0.1) },
    ],
  },

  /* Small raised things: chips, the "+91" pill, the Google button. */
  soft: {
    boxShadow: [
      { offsetX: 0, offsetY: 8, blurRadius: 20, spreadDistance: -6, color: TINT(0.16) },
      { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: -3, color: TINT(0.08) },
    ],
  },

  /*
   * Tiny mint circles (shield badge, trust icons).
   *
   * This preset used to be `elevation: 0` — a deliberate workaround, because
   * Android's elevation draws a SQUARE halo behind a small circle. That meant
   * these had no shadow at all on Android. `boxShadow` follows the view's
   * border radius, so the workaround is no longer needed and they now render.
   */
  subtle: {
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 12, spreadDistance: -3, color: TINT(0.16) }],
  },

  /*
   * The green primary button. Tinted with the brand green rather than the
   * grey-green so the CTA glows instead of casting a shadow.
   *
   * This one was completely invisible on Android before: the old version put
   * `elevation: 9` on a wrapper View that had NO backgroundColor, and Android
   * derives an elevation shadow from the view's background. No background, no
   * shadow. `boxShadow` does not care, but PrimaryButton now sets a background
   * anyway so there is no seam behind the gradient.
   */
  button: {
    boxShadow: [
      { offsetX: 0, offsetY: 10, blurRadius: 24, spreadDistance: -6, color: 'rgba(24, 184, 120, 0.38)' },
      { offsetX: 0, offsetY: 3, blurRadius: 8, spreadDistance: -4, color: 'rgba(24, 184, 120, 0.22)' },
    ],
  },
} as const;
