import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// `base` must match the GitHub Pages sub-path (https://<user>.github.io/Veilbound/).
// Override with VEILBOUND_BASE='/' when serving from a custom domain or user/org root.
const base = process.env.VEILBOUND_BASE ?? '/Veilbound/';

export default defineConfig({
  base,
  plugins: [svelte()],
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
