import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  /** Hub often serves the pack under a subpath; a relative base keeps asset URLs aligned with `index.html` (see `signPublicUrl` in `signRender.ts`). */
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
});
