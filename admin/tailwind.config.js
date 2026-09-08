/** @type {import('tailwindcss').Config} */

/* Editorial Classic — ink on paper, hairline rules, no shadows.
   The slate/emerald/blue scales are deliberately remapped onto this
   palette so pages still using stock Tailwind colours inherit the
   theme without being rewritten. */

const warm = {
  50: '#FAF9F7', 100: '#F4F2ED', 200: '#E5E2DB', 300: '#D6D2C8',
  400: '#A39D91', 500: '#7A756B', 600: '#5C584F', 700: '#4A4740',
  800: '#2E2C26', 900: '#16150F', 950: '#0C0B07',
};

const green = {
  50: '#F1F6F3', 100: '#EDF3EF', 200: '#D3E4DA', 300: '#A9C9B7',
  400: '#6FA588', 500: '#3F8760', 600: '#1F6F43', 700: '#1A5C38',
  800: '#155232', 900: '#113F27', 950: '#0A2617',
};

const navy = {
  50: '#F2F5F8', 100: '#EDF1F6', 200: '#D8E1EB', 300: '#B3C4D6',
  400: '#7E97B4', 500: '#4E6D91', 600: '#2F5480', 700: '#1F4E79',
  800: '#1A3E60', 900: '#152F49', 950: '#0D1D2E',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF9F7',
        shell: '#F4F2ED',
        surface: '#FFFFFF',
        ink: { DEFAULT: '#16150F', muted: '#4A4740', soft: '#7A756B', faint: '#A39D91' },
        rule: { DEFAULT: '#E5E2DB', strong: '#D6D2C8', soft: '#EFEDE8' },
        accent: { DEFAULT: '#1F6F43', deep: '#155232', soft: '#EDF3EF', line: '#D3E4DA' },
        signal: {
          amber: '#8A5A00', amberSoft: '#FBF3E2', amberLine: '#EEDCB4',
          red: '#A02724', redSoft: '#FBEDEC', redLine: '#EFD2D0',
          blue: '#1F4E79', blueSoft: '#EDF1F6', blueLine: '#D8E1EB',
        },

        slate: warm,
        gray: warm,
        neutral: warm,
        stone: warm,
        zinc: warm,
        emerald: green,
        green: green,
        teal: green,
        blue: navy,
        indigo: navy,
        sky: navy,
      },

      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'Cambria', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },

      /* Flatten every radius the pages already use. */
      borderRadius: {
        none: '0', sm: '2px', DEFAULT: '3px', md: '4px', lg: '4px',
        xl: '5px', '2xl': '6px', '3xl': '8px', full: '9999px',
      },

      /* Editorial has no drop shadows; overlays get the only real one.
         The old neo-* keys are kept as no-ops so existing pages compile. */
      boxShadow: {
        none: 'none', sm: 'none', DEFAULT: 'none', md: 'none', lg: 'none',
        xl: '0 12px 32px -10px rgba(22,21,15,0.16)',
        '2xl': '0 20px 56px -14px rgba(22,21,15,0.22)',
        overlay: '0 20px 56px -14px rgba(22,21,15,0.22)',
        neo: 'none', 'neo-sm': 'none', 'neo-btn': 'none', 'neo-inset': 'none',
      },

      letterSpacing: { label: '0.08em' },
    },
  },
  plugins: [],
};
