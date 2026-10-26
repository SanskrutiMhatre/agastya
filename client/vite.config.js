import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The dev server proxies /api to the Agastya server. changeOrigin stays false
// so the Host header the server sees matches the browser's Origin, and the
// server's CSRF Origin check works in development exactly as in production.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3535', changeOrigin: false },
      '/ws': { target: 'ws://127.0.0.1:3535', ws: true, changeOrigin: false },
    },
  },
  // The editor route carries the S1000D content models and Monaco in its own lazily loaded chunks.
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 4500 },
});
