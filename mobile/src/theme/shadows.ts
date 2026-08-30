/**
 * shadows.ts
 * ----------
 * Every shadow in the app. These are NOT estimates — each one is read
 * directly out of the Figma export's <filter> definitions ("RIDE FOR YOU",
 * 430x932 frame), so they match the design file exactly.
 *
 * HOW A FIGMA FILTER MAPS TO boxShadow
 * ------------------------------------
 *   <feOffset dy="7"/>              -> offsetY: 7
 *   <feGaussianBlur stdDeviation="14.5"/> -> blurRadius: 29   (always x2)
 *   <feColorMatrix values=... 0.2/> -> colour alpha 0.2
 * Figma writes HALF the blur radius as stdDeviation, which is the single
 * easiest thing to get wrong when copying a shadow by hand.
 *
 * Values are in the 430pt design frame. React Native lays out in dp and the
 * app targets 360dp, so strictly these could be scaled by 0.837 — but shadow
 * blur reads as an optical property rather than a measured one, and scaling
 * it down makes surfaces look flatter than the design. They are left at the
 * design's own values deliberately.
 *
 * WHY boxShadow AND NOT shadow* / elevation
 * -----------------------------------------
 * Android ignores shadowColor/Offset/Opacity/Radius entirely; it reads only
 * `elevation`, which draws a hard grey bounds-shadow. `boxShadow` (RN 0.81 +
 * New Architecture, default in Expo SDK 54) works on both platforms, honours
 * border radius, and supports inset — which Figma uses on two elements here.
 */

export const shadows = {
  /*
   * The big white login card.
   * Figma filter2_d: dy 7, stdDeviation 14.5, #64646F at 20%.
   * Note the colour: a neutral grey-violet, NOT the green-grey that was
   * guessed here previously.
   */
  card: {
    boxShadow: [
      // Figma stacks TWO drop shadows on the card, not one: a tight contact
      // shadow over a broad ambient one. Only the broad one was reproduced
      // before, which is why the card's edge read soft but ungrounded.
      { offsetX: 0, offsetY: 1, blurRadius: 4, spreadDistance: 0, color: 'rgba(0, 0, 0, 0.16)' },
      { offsetX: 0, offsetY: 7, blurRadius: 29, spreadDistance: 0, color: 'rgba(100, 100, 111, 0.2)' },
    ],
  },

  /*
   * Raised controls — the +91 pill, icon circles, floating buttons.
   * Figma filter4_d: dy 4, stdDeviation 6, black at 20%.
   */
  soft: {
    boxShadow: [
      { offsetX: 0, offsetY: 4, blurRadius: 12, spreadDistance: 0, color: 'rgba(0, 0, 0, 0.2)' },
    ],
  },

  /*
   * Small chips and badges — the shield, the trust circles.
   * Figma filter1_d: dy 1, stdDeviation 2, black at 16%.
   * This preset used to be `elevation: 0`, a workaround for Android drawing a
   * square halo behind a small circle. boxShadow follows the border radius,
   * so these finally render on Android.
   */
  subtle: {
    boxShadow: [
      { offsetX: 0, offsetY: 1, blurRadius: 4, spreadDistance: 0, color: 'rgba(0, 0, 0, 0.16)' },
    ],
  },

  /*
   * The primary CTA.
   * Figma filter5_i is an INNER shadow: dy 10, stdDeviation 10, #1FAF7A at 30%
   * — the brand green glowing inward, which is what gives the button its
   * moulded look. It is not a drop shadow, and reproducing it as one is why
   * the button never looked right before.
   */
  button: {
    boxShadow: [
      { offsetX: 0, offsetY: 10, blurRadius: 20, spreadDistance: 0, color: 'rgba(31, 175, 122, 0.3)', inset: true },
    ],
  },

  /*
   * The hero blob's inner shadow.
   * Figma filter0_i: dy 10, stdDeviation 4, #BBDBD8 at full opacity, inset.
   * Applied to the curved image mask so the photo sits *inside* the shape
   * rather than on top of it.
   */
  heroBlob: {
    boxShadow: [
      { offsetX: 0, offsetY: 10, blurRadius: 8, spreadDistance: 0, color: '#BBDBD8', inset: true },
    ],
  },
} as const;
