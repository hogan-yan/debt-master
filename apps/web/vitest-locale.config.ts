import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/locale-switching.test.ts'],
    exclude: ['node_modules', '.output', 'dist'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
