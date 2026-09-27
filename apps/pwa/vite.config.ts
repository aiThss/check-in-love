import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
  },
  optimizeDeps: {
    // Keep MapLibre's module worker beside the package instead of rewriting it
    // into Vite's dependency cache, where WebView cannot resolve the worker URL.
    exclude: ['maplibre-gl'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'http://localhost:3001/api'),
    __GOOGLE_CLIENT_ID__: JSON.stringify(process.env.VITE_GOOGLE_CLIENT_ID || ''),
  },
});
