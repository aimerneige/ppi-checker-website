import { defineConfig } from 'vite';

// base: './' keeps the build portable (works on GitHub Pages sub-paths or opened from any folder).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2020' },
});
