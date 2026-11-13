import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Shared money/split math is the highest-leverage code in the monorepo —
      // every platform's balances run through it. Same thresholds as the mobile
      // src/lib gate; a drop here is a drop in the money source of truth.
      thresholds: {
        lines: 96,
        statements: 96,
        functions: 96,
        branches: 90,
      },
    },
  },
});
