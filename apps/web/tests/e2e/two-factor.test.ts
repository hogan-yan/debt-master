/**
 * E2E: two-factor authentication (DEBTM-96 Phase 6).
 *
 * Exercises the TOTP login flow for Better Auth admins:
 *   - enable 2FA for the admin account
 *   - log out and log back in with email/password + TOTP code
 *   - disable 2FA from the settings panel
 *
 * PRECONDITIONS:
 *   - `AUTH_PROVIDER=better-auth`
 *   - `ENABLE_2FA=true`
 *   - `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` set
 *   - better_auth tables migrated
 *   - app reachable at `APP_URL` (default http://localhost:3000)
 *
 * Run:
 *   ENABLE_2FA=true bunx vitest run tests/e2e/two-factor.test.ts --config vitest.e2e.config.ts
 */

import { URI } from 'otpauth';
import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { navigateTo } from './helpers';
import { AUTH, SETUP, TWO_FACTOR } from '../../src/test/test-ids';

const ADMIN_EMAIL = `e2e-2fa-${Date.now()}@example.test`;
const ADMIN_PASSWORD = 'Str0ng!Password-1!';

interface Enable2FAResponse {
  totpURI?: string;
  backupCodes?: string[];
}

describe('E2E: two-factor authentication', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    if (process.env.ENABLE_2FA !== 'true') {
      return;
    }

    const { prisma } = await import('../../src/server/infrastructure/prisma');
    await prisma.betterAuthUser.deleteMany({});
    await prisma.$disconnect();

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Create the first admin via the setup wizard.
    await navigateTo(page, '/setup');
    await page.getByTestId(SETUP.NAME_INPUT).fill('E2E 2FA Admin');
    await page.getByTestId(SETUP.EMAIL_INPUT).fill(ADMIN_EMAIL);
    await page.getByTestId(SETUP.PASSWORD_INPUT).fill(ADMIN_PASSWORD);
    await page.getByTestId(SETUP.SUBMIT_BTN).click();
    await page.waitForURL((url) => /^\/?$/.test(url.pathname), { timeout: 30000 });
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('is skipped when ENABLE_2FA is not true', () => {
    if (process.env.ENABLE_2FA !== 'true') {
      expect(true).toBe(true);
      return;
    }
    expect(process.env.ENABLE_2FA).toBe('true');
  });

  it('enables 2FA and logs in with a TOTP code', async () => {
    if (process.env.ENABLE_2FA !== 'true') {
      return;
    }

    // Enable 2FA through the browser so the session cookie is available.
    const setup = await page.evaluate(async (password: string) => {
      const response = await fetch('/api/auth/two-factor/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      return response.json() as Promise<Enable2FAResponse>;
    }, ADMIN_PASSWORD);

    expect(setup.totpURI).toBeTruthy();
    expect(setup.backupCodes?.length).toBeGreaterThan(0);

    // Better Auth requires the first TOTP code to be verified before 2FA is
    // considered active. Finalize setup using the current logged-in session.
    const totp = URI.parse(setup.totpURI!);
    const verifyResponse = await page.evaluate(async (code: string) => {
      const response = await fetch('/api/auth/two-factor/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      return { status: response.status, body: (await response.json()) as unknown };
    }, totp.generate());

    expect(verifyResponse.status).toBe(200);

    // Generate the current TOTP code from the setup URI for the fresh login.
    const loginCode = totp.generate();

    // Use a fresh incognito context for the 2FA login so the original session
    // (needed by the disable test) stays intact. Clearing cookies on the active
    // page can race with TanStack Router and abort navigation.
    const incognito = await browser.newContext();
    const loginPage = await incognito.newPage();

    await navigateTo(loginPage, '/login');

    await loginPage.getByTestId(AUTH.ADMIN_EMAIL_INPUT).fill(ADMIN_EMAIL);
    await loginPage.getByTestId(AUTH.ADMIN_PASSWORD_INPUT).fill(ADMIN_PASSWORD);
    await loginPage.getByTestId(AUTH.ADMIN_LOGIN_BTN).click();

    await loginPage.getByTestId(AUTH.ADMIN_TOTP_INPUT).waitFor({ state: 'visible', timeout: 15000 });
    await loginPage.getByTestId(AUTH.ADMIN_TOTP_INPUT).fill(loginCode);
    await loginPage.getByTestId(AUTH.ADMIN_TOTP_SUBMIT_BTN).click();

    await loginPage.waitForURL((url) => /^\/?$/.test(url.pathname), { timeout: 30000 });
    expect(new URL(loginPage.url()).pathname).toBe('/');

    await incognito.close();
  }, 60000);

  it('disables 2FA from the security panel', async () => {
    if (process.env.ENABLE_2FA !== 'true') {
      return;
    }

    await navigateTo(page, '/settings');
    await page.getByTestId(TWO_FACTOR.DISABLE_PASSWORD_INPUT).fill(ADMIN_PASSWORD);
    await page.getByTestId(TWO_FACTOR.DISABLE_BTN).click();

    await page.getByTestId(TWO_FACTOR.STATUS_DISABLED).waitFor({ state: 'visible', timeout: 15000 });
    expect(await page.getByTestId(TWO_FACTOR.ENABLE_BTN).isVisible()).toBe(true);
  });
});
