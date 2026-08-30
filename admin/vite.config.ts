import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:3000',
      '/admin/api': 'http://localhost:3000',
      '/kyc': 'http://localhost:3000',
      '/rental': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
