import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = process.env.VITE_API_URL || env.VITE_API_URL || 'http://localhost:3001/api';

  return {
    build: {
      outDir: 'dist',
    },
    define: {
      __API_URL__: JSON.stringify(apiUrl),
    },
  };
});
