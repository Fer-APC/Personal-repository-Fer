import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built app works from a domain root, a GitHub Pages
// project subpath, or straight off the filesystem without reconfiguration.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
});
