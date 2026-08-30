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
          primary: '#0B6623',
          dark: '#064E3B',
          light: '#10B981',
          mint: '#D1FAE5',
          mintSoft: '#ECFDF5',
          accent: '#00C9A7',
        },
        sidebar: '#0F172A',
        surface: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
