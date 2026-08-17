import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
    // Keep the existing React development server while routing API calls
    // to the ASP.NET Core backend on SQL Server Express.
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5080',
        changeOrigin: true,
      },
      '/swagger': {
        target: process.env.VITE_API_URL || 'http://localhost:5080',
        changeOrigin: true,
      },
    },
  },
}));
