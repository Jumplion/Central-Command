import { resolve } from 'node:path';

export default {
  test: {
    environment: 'jsdom',
    environmentMatchGlobs: [['src/main/**', 'node']],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/renderer/src/main.tsx',
        'src/renderer/src/vite-env.d.ts',
      ]
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@widgets': resolve(__dirname, 'src/widgets'),
      '@main': resolve(__dirname, 'src/main')
    }
  }
};
