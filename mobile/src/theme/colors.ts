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
  /* ---- Brand greens (sampled from the mockup) ---- */
  brand: {
    primary: '#15A55E', // main green — buttons, active icons, links, "YOU"
    dark: '#0E7A44', // pressed states, darker accents
    light: '#3FCB84', // lighter green highlights / borders
    mint: '#E4F2EB', // pale green — icon circles, badges
    // The "Continue with OTP" button is a left-to-right gradient of these two:
    gradientFrom: '#23A968',
    gradientTo: '#5FD79E',
    // The frosted-teal hero blob fades between these top→bottom:
    glassTop: '#EAF4EF',
    glassBottom: '#D3E8E0',
  },

  /* ---- Text ---- */
  text: {
    primary: '#0F241D', // near-black with a green tint — headings, body
    secondary: '#7C8783', // muted grey-green — captions, placeholders, hints
    inverse: '#FFFFFF', // text on top of a green button or dark photo
    link: '#15A55E',
  },

  /* ---- Surfaces (backgrounds of things) ---- */
  surface: {
    background: '#EFF2F0', // the screen behind everything — pale cool grey-green
    card: '#FFFFFF', // white cards / panels that float on the background
    field: '#FFFFFF', // input backgrounds
  },

  /* ---- Lines & borders ---- */
  border: '#E6ECE9', // hairline dividers, input outlines, card outlines

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
