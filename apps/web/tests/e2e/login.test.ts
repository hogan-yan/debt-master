/**
 * E2E: Better Auth admin login (DEBTM-96 Phase 8).
 *
 * Exercises the email/password admin login form:
 *   - rejects an invalid password with an inline error
 *   - accepts valid credentials and lands on /
 *   - "Forgot password?" link navigates to /forgot-password
 *
 * PRECONDITIONS:
 *   - `AUTH_PROVIDER=better-auth`
 *   - `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` set
 *   - better_auth tables migrated
 *   - app reachable at `APP_URL` (default http://localhost:3000)
 *
 * Run:
 *   bunx vitest run tests/e2e/login.test.ts --config vitest.e2e.config.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { navigateTo } from './helpers';
import { AUTH, SETUP } from '../../src/test/test-ids';

const ADMIN_EMAIL = `e2e-login-${Date.now()}@example.test`;
const ADMIN_PASSWORD = 'Str0ng!Password-1!';

describe('E2E: admin login', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    const { prisma } = await import('../../src/server/infrastructure/prisma');
    await prisma.betterAuthUser.deleteMany({});
    await prisma.$disconnect();

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    await navigateTo(page, '/setup');
    await page.getByTestId(SETUP.NAME_INPUT).fill('E2E Login Admin');
    await page.getByTestId(SETUP.EMAIL_INPUT).fill(ADMIN_EMAIL);
    await page.getByTestId(SETUP.PASSWORD_INPUT).fill(ADMIN_PASSWORD);
    await page.getByTestId(SETUP.SUBMIT_BTN).click();
    await page.waitForURL((url) => /^\/?$/.test(url.pathname), { timeout: 30000 });
  }, 60000);

  afterAll(async () => {
    await browser.close();
  });

  it('rejects invalid credentials with an inline error', async () => {
    await page.context().clearCookies();
    await navigateTo(page, '/login');

    await page.getByTestId(AUTH.ADMIN_EMAIL_INPUT).fill(ADMIN_EMAIL);
    await page.getByTestId(AUTH.ADMIN_PASSWORD_INPUT).fill('wrong-password');
    await page.getByTestId(AUTH.ADMIN_LOGIN_BTN).click();

    await page.getByTestId(AUTH.ADMIN_LOGIN_ERROR).waitFor({ state: 'visible', timeout: 15000 });
    expect(new URL(page.url()).pathname).toMatch(/^\/login\/?$/);
  });

  it('accepts valid credentials and lands on the dashboard', async () => {
    await page.context().clearCookies();
    await navigateTo(page, '/login');

    await page.getByTestId(AUTH.ADMIN_EMAIL_INPUT).fill(ADMIN_EMAIL);
    await page.getByTestId(AUTH.ADMIN_PASSWORD_INPUT).fill(ADMIN_PASSWORD);
    await page.getByTestId(AUTH.ADMIN_LOGIN_BTN).click();

    await page.waitForURL((url) => /^\/?$/.test(url.pathname), { timeout: 30000 });
    expect(new URL(page.url()).pathname).toBe('/');
  });

  it('navigates to the forgot-password page from the login form', async () => {
    await page.context().clearCookies();
    await navigateTo(page, '/login');

    await page.getByRole('link', { name: /forgot password/i }).click();
    await page.waitForURL((url) => /\/forgot-password\/?$/.test(url.pathname), { timeout: 15000 });
    expect(new URL(page.url()).pathname).toMatch(/^\/forgot-password\/?$/);
    expect(await page.getByTestId(AUTH.FORGOT_PASSWORD_HEADING).isVisible()).toBe(true);
  });
});
