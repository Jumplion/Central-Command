export default {
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/widgets/job-aggregator/{api,parsers,utils}.ts']
    }
  },
  resolve: {
    alias: {
      '@shared': '/src/shared',
      '@renderer': '/src/renderer/src',
      '@widgets': '/src/widgets',
      '@main': '/src/main'
    }
  }
};
