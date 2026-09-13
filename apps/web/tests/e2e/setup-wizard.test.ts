/**
 * E2E: first-run setup wizard (DEBTCOM-2).
 *
 * Drives the `/setup` browser flow end-to-end: the wizard must render when no
 * admin exists, and submitting it must create the first admin and sign them in
 * (landing on `/`).
 *
 * PRECONDITIONS — unlike the shared authentik smoke suite, this test needs its
 * OWN app instance configured for first-run:
 *   - `AUTH_PROVIDER=better-auth`
 *   - `BETTER_AUTH_SECRET` (>=32 chars) + `BETTER_AUTH_URL` set
 *   - `better_auth_*` tables migrated (`bunx prisma migrate deploy`)
 *   - app reachable at `APP_URL` (default http://localhost:3000)
 *
 * The suite is self-resetting: `beforeAll` clears `better_auth_users`
 * (cascades to sessions/accounts) so the wizard re-arms on every run.
 *
 * Run (needs the better-auth app booted separately — e.g. `bun run dev`):
 *   bunx vitest run tests/e2e/setup-wizard.test.ts --config vitest.e2e.config.ts
 *
 * (Note: `bun run test --` excludes `tests/e2e/**`; the e2e vitest config is
 * the only path that picks this file up.)
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isVisible, navigateTo } from './helpers';
import { AUTH, SETUP } from '../../src/test/test-ids';

const WIZARD_EMAIL = `e2e-admin-${Date.now()}@example.test`;

describe('E2E: first-run setup wizard', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    // Reset to a true first-run state: the wizard locks once any admin
    // exists, so the suite is non-idempotent unless we clear the table.
    // Deleting users cascades to better_auth_sessions/accounts (FK ON DELETE
    // CASCADE) per the add_better_auth_tables migration.
    const { prisma } = await import('../../src/server/infrastructure/prisma');
    await prisma.betterAuthUser.deleteMany({});
    await prisma.$disconnect();

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, 60000);

  afterAll(async () => {
    await browser.close();
  });

  it('renders the wizard form on /setup when no admin exists yet', async () => {
    await navigateTo(page, '/setup');
    expect(await isVisible(page.getByTestId(SETUP.HEADING), 10000)).toBe(true);
    expect(await isVisible(page.getByTestId(SETUP.NAME_INPUT), 5000)).toBe(true);
    expect(await isVisible(page.getByTestId(SETUP.EMAIL_INPUT), 5000)).toBe(true);
    expect(await isVisible(page.getByTestId(SETUP.PASSWORD_INPUT), 5000)).toBe(true);
    expect(await isVisible(page.getByTestId(SETUP.SUBMIT_BTN), 5000)).toBe(true);
  });

  it('creates the first admin and signs them in', async () => {
    await navigateTo(page, '/setup');

    await page.getByTestId(SETUP.NAME_INPUT).fill('E2E Admin');
    await page.getByTestId(SETUP.EMAIL_INPUT).fill(WIZARD_EMAIL);
    await page.getByTestId(SETUP.PASSWORD_INPUT).fill('Str0ng!E2e-Setup-1');

    await page.getByTestId(SETUP.SUBMIT_BTN).click();

    // Successful setup creates the admin, signs them in, and lands on the dashboard.
    await page.waitForURL((url) => /^\/?$/.test(url.pathname), { timeout: 30000 });
    expect(new URL(page.url()).pathname).toBe('/');
  });

  it('locks the wizard once an admin exists (redirects away from /setup)', async () => {
    await navigateTo(page, '/setup');
    // With an admin now present, isFirstRun() returns false → the page bounces
    // to /login/ rather than rendering the form.
    await page.waitForURL((url) => /^\/login\/?$/.test(url.pathname), { timeout: 15000 });
    expect(page.url()).toMatch(/\/login\/?$/);
  });

  it('signs the admin in from the login page', async () => {
    // Clear the session cookie so we exercise the real login flow.
    await page.context().clearCookies();
    await navigateTo(page, '/login');

    await page.getByTestId(AUTH.ADMIN_EMAIL_INPUT).fill(WIZARD_EMAIL);
    await page.getByTestId(AUTH.ADMIN_PASSWORD_INPUT).fill('Str0ng!E2e-Setup-1');
    await page.getByTestId(AUTH.ADMIN_LOGIN_BTN).click();

    // Successful sign-in reloads and lands on the dashboard.
    await page.waitForURL((url) => /^\/?$/.test(url.pathname), { timeout: 30000 });
    expect(new URL(page.url()).pathname).toBe('/');
  });
});
