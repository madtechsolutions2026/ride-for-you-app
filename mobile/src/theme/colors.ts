/**
 * colors.ts
 * ---------
 * Every colour used anywhere in the app lives here. Screens and components
 * NEVER write a raw hex value like "#16A34A" — they import from this file.
 *
 * Why: if the client says "make the green a bit darker", you change ONE line
 * here and the whole app updates. This is the single source of truth.
 *
 * Palette is pulled from the Ride For You mockups (green + soft neumorphic UI).
 */

export const colors = {
  /* ---- Brand greens (sampled from the reference) ---- */
  brand: {
    primary: '#1FAF7A', // main green — buttons, active icons, links, "YOU"
    dark: '#129461', // pressed states, darker accents
    light: '#4BD49B', // lighter green highlights
    mint: '#E9F7F1', // pale green — icon circles, badges
    /*
     * Screens had grown FIVE near-identical mints (#DCFCE7, #D1FAE5, #ECFDF5,
     * #F0FDF4, #DEF7EC) plus several one-offs. They are now three deliberate
     * steps. If a new screen needs a mint, it uses one of these - not a
     * sixth invented one.
     */
    mintSoft: '#F3FAF6', // barely-there wash - row backgrounds
    mintStrong: '#DCF0E6', // deeper mint - selected chips, active states
    // "Continue with OTP" is a left-to-right gradient of these:
    gradientFrom: '#62CE90',
    gradientTo: '#B4EBD8',
    gradientEnd: '#B4EBD8', // the pale right-hand end, where the arrow overhangs
    // The frosted hero blob fades between these top→bottom:
    glassTop: '#EFF7F5',
    glassBottom: '#DCEDE8',
  },

  /* ---- Text ---- */
  text: {
    primary: '#334155', // dark navy — headings, body
    secondary: '#6B7280', // soft cool grey — captions, placeholders, hints
    inverse: '#FFFFFF', // text on top of a green button or dark photo
    link: '#1FAF7A',
  },

  /* ---- Surfaces (backgrounds of things) ---- */
  /*
   * Taken from the Figma export ("RIDE FOR YOU", 430x932 frame), not measured
   * off a raster. The frame's background rect is #F8F7FD — a cool blue-violet
   * white, not the mint the earlier guess assumed.
   */
  surface: {
    background: '#F8F7FD', // Figma: the frame background rect
    backgroundTintTop: '#F5F6FB', // slightly cooler wash toward the top
    backgroundTintBottom: '#FDFDFF', // near-white at the bottom
    card: '#FFFFFF', // white cards / panels that float on the background
    field: '#FFFFFF', // input backgrounds
  },

  /* ---- Lines & borders ---- */
  border: '#EDF2F1', // hairline dividers only — inputs/cards use shadow, not borders

  /*
   * ---- Neutral ramp ----
   *
   * Added because screens kept reaching for Tailwind's slate values
   * (#F8FAFC, #F1F5F9, #E2E8F0, #94A3B8) - not because anyone wanted Tailwind,
   * but because this file had no neutral scale to reach for. It does now.
   * These are tuned slightly cool-green rather than Tailwind's blue-grey so
   * they sit correctly against the brand.
   */
  neutral: {
    50: '#F7F9F9', // lightest wash - list backgrounds, disabled fills
    100: '#F0F4F4', // subtle panel behind a card
    200: '#E3EAEA', // dividers on a tinted surface
    300: '#CBD6D6', // disabled borders
    400: '#94A3A8', // muted icons, placeholder glyphs
    500: '#6C7D83', // secondary text on a tinted surface
  },

  /* ---- Status colours (KYC "Pending", errors, etc.) ---- */
  /*
   * Each status now carries a matching `*Tint` for the chip/pill background,
   * so a badge is one token pair instead of two unrelated literals.
   */
  status: {
    success: '#16A34A',
    successTint: '#DCF3E4',
    warning: '#D97706', // the amber "Pending" pill - matches what screens already use
    warningTint: '#FEF3C7',
    error: '#EF4444', // form errors
    errorTint: '#FEE2E2',
    info: '#0284C7', // category chips, informational badges
    infoTint: '#E0F2FE',
  },

  /*
   * ---- Accents ----
   * Non-brand hues that exist to tell categories apart. Deliberately kept:
   * a category chip has to be distinguishable from the brand green, or the
   * whole screen reads as one colour.
   */
  accent: {
    purple: '#7E22CE',
    purpleTint: '#F3E8FF',
    teal: '#0F766E',
  },

  /* ---- Disabled / inactive states ---- */
  state: {
    disabledFrom: '#C7D6CE', // the greyed-out primary button gradient
    disabledMid: '#BFD0C7',
    disabledTo: '#B6C9BF',
  },

  /*
   * ---- Translucent overlays ----
   *
   * Anything semi-transparent lives here. The scrim in particular was drifting:
   * sheets and modals were each using their own opacity (0.45, 0.5, 0.55, and
   * one pure black), so backdrops visibly differed depending on which sheet
   * opened. One token now, used by all of them.
   */
  overlay: {
    scrim: 'rgba(15, 23, 42, 0.5)', // behind every modal, sheet and drawer
    onAccent: 'rgba(255, 255, 255, 0.45)', // hairlines on top of the green CTA
    blobShade: 'rgba(60, 90, 75, 0.10)', // soft shading inside the hero blob
    blobSheen: 'rgba(255, 255, 255, 0.55)', // the light rim on the hero blob
    mapControl: 'rgba(255, 255, 255, 0.92)', // floating controls over the map
    heroFadeFrom: 'rgba(211, 232, 224, 0.55)', // hero gradient wash, top
    heroFadeTo: 'rgba(239, 242, 240, 0)', // hero gradient wash, transparent end
  },

  /* ---- Raw values you occasionally need directly ---- */
  common: {
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
  },
} as const;

export type Colors = typeof colors;
