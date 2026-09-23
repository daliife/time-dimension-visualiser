import { defineConfig } from 'vite';

export default defineConfig({
  base: '/time-dimension-visualiser/',
  server: {
    port: 4321,
    strictPort: true,
  },
  preview: {
    port: 4321,
    strictPort: true,
  },
});
