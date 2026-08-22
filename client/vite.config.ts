import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxying /api and /uploads to the Express server keeps every request
// same-origin in development, so the auth cookie just works and there is no
// CORS configuration to debug.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
