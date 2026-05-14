import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: resolve(__dirname, 'src/mobile-renderer'),
  plugins: [react()],
  define: {
    __MOBILE__: JSON.stringify(true),
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@widgets': resolve(__dirname, 'src/widgets'),
      '@mobile-bridge': resolve(__dirname, 'src/mobile-bridge'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/mobile'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/mobile-renderer/index.html'),
    },
  },
});
