import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'http://localhost:3001/api'),
  },
});
