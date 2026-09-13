import { defineConfig } from '@playwright/test';

/**
 * Playwright e2e config for the web app.
 *
 * The suite talks to a real server and a real Postgres: run migrations + seed
 * before launching (CI does this in the test-web job; locally `bun run
 * prisma:migrate && bun run prisma:seed`).
 *
 * The server command expects a production build (`bun run build`) — reuse an
 * already-running server locally so iteration stays fast.
 */
export default defineConfig({
  testDir: './tests/e2e-pw',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'bun ./scripts/server.ts',
    port: Number(process.env.PORT || 3000),
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
