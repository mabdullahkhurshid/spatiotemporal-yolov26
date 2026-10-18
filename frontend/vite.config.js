import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Group third-party code into a few long-lived chunks; pages are split per route via React.lazy.
const vendorChunk = (id) => {
  if (!id.includes('node_modules')) return undefined;
  if (/[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap|decimal\.js-light)[\\/]/.test(id)) return 'charts';
  if (/[\\/](socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser)[\\/]/.test(id)) return 'realtime';
  if (/[\\/]lucide-react[\\/]/.test(id)) return 'icons';
  if (/[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run|react-redux|@reduxjs|redux|immer|reselect|use-sync-external-store)[\\/]/.test(id)) {
    return 'react';
  }
  // Everything else is placed by Rollup according to which pages use it (a catch-all "vendor" chunk
  // would mix chart-only dependencies into the entry and force charts to load on every page).
  return undefined;
};

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Alert snapshots are served by the backend.
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
