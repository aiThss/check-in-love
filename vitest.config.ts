import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
  },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
