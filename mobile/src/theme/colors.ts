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
    primary: '#18B878', // main green — buttons, active icons, links, "YOU"
    dark: '#129461', // pressed states, darker accents
    light: '#4BD49B', // lighter green highlights
    mint: '#E9F7F1', // pale green — icon circles, badges
    // "Continue with OTP" is a left-to-right gradient of these:
    gradientFrom: '#1FAE72',
    gradientTo: '#5FD9A4',
    // The frosted hero blob fades between these top→bottom:
    glassTop: '#EFF7F5',
    glassBottom: '#DCEDE8',
  },

  /* ---- Text ---- */
  text: {
    primary: '#172B3A', // dark navy — headings, body
    secondary: '#8A97A0', // soft cool grey — captions, placeholders, hints
    inverse: '#FFFFFF', // text on top of a green button or dark photo
    link: '#18B878',
  },

  /* ---- Surfaces (backgrounds of things) ---- */
  surface: {
    background: '#F7FAFA', // almost white with a cool mint tint
    backgroundTintTop: '#EFF6F7', // very pale blue-mint, top of the page wash
    backgroundTintBottom: '#FDFEFE', // near-white, bottom of the page wash
    card: '#FFFFFF', // white cards / panels that float on the background
    field: '#FFFFFF', // input backgrounds
  },

  /* ---- Lines & borders ---- */
  border: '#EDF2F1', // hairline dividers only — inputs/cards use shadow, not borders

  /* ---- Status colours (KYC "Pending", errors, etc.) ---- */
  status: {
    success: '#16A34A',
    warning: '#F59E0B', // the amber "Pending" pill on the KYC screen
    error: '#EF4444', // form errors
    info: '#3B82F6',
  },

  /* ---- Raw values you occasionally need directly ---- */
  common: {
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
  },
} as const;

export type Colors = typeof colors;
