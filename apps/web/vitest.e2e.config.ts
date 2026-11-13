import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths() as ReturnType<typeof tsconfigPaths>],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/e2e/setup.ts',
    include: ['tests/e2e/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.output', 'dist'],
    hookTimeout: 60000,
    testTimeout: 60000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['json'],
      reportsDirectory: './coverage/e2e-vitest',
      thresholds: {
        statements: 54,
        branches: 39,
        functions: 51,
        lines: 54,
      },
      exclude: [
        'node_modules/',
        'src/test/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
      ],
    },
  },
} as unknown as Parameters<typeof defineConfig>[0]);
