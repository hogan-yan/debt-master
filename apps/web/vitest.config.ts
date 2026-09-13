import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths() as ReturnType<typeof tsconfigPaths>],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.output', 'dist', 'tests/e2e/**'],
    hookTimeout: 60000,
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        // Gates set just under the CI (linux) baseline: statements 99.75,
        // branches 99.44, functions 99.94, lines 99.71. CI is the canonical
        // gate - macOS local runs measure slightly higher. Ratchet upward;
        // do not lower.
        statements: 99.7,
        branches: 99.4,
        functions: 99.9,
        lines: 99.7,
      },
      exclude: [
        'node_modules/',
        'src/test/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
        'src/routes/**',
        // Remotion Player composition — browser-only animation surface,
        // verified via Playwright screenshots (see ledger-hero.tsx).
        'src/components/landing/**',
        'src/routeTree.gen.ts',
        'src/paraglide/**',
        'prisma/**',
        'messages/**',
      ],
    },
  },
} as unknown as Parameters<typeof defineConfig>[0]);
