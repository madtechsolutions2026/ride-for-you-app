/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#62CE90',
          dark: '#38A169',
          light: '#85E3AA',
          mint: '#EAF8F1',
          mintSoft: '#F3FCF7',
          ground: '#F8F7FD',
          navy: '#172B3A',
          grey: '#8A97A0',
        },
      },
      boxShadow: {
        'neo': '8px 8px 20px rgba(180, 185, 210, 0.22), -8px -8px 20px rgba(255, 255, 255, 0.95)',
        'neo-sm': '4px 4px 12px rgba(180, 185, 210, 0.18), -4px -4px 12px rgba(255, 255, 255, 0.9)',
        'neo-btn': '0 8px 20px rgba(98, 206, 144, 0.35)',
        'neo-inset': 'inset 2px 2px 5px rgba(180, 185, 210, 0.25), inset -2px -2px 5px rgba(255, 255, 255, 0.9)',
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
