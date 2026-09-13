/**
 * E2E: password recovery (DEBTM-96 Phase 8).
 *
 * Exercises the forgot-password form:
 *   - renders the form
 *   - submits an email and shows the generic success state
 *   - rejects an invalid email before calling the server
 *
 * PRECONDITIONS:
 *   - `AUTH_PROVIDER=better-auth`
 *   - `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` set
 *   - better_auth tables migrated
 *   - app reachable at `APP_URL` (default http://localhost:3000)
 *
 * Run:
 *   bunx vitest run tests/e2e/forgot-password.test.ts --config vitest.e2e.config.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { navigateTo } from './helpers';
import { AUTH } from '../../src/test/test-ids';

describe('E2E: password recovery', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, 60000);

  afterAll(async () => {
    await browser.close();
  });

  it('renders the forgot-password form', async () => {
    await navigateTo(page, '/forgot-password');
    expect(await page.getByTestId(AUTH.FORGOT_PASSWORD_HEADING).isVisible()).toBe(true);
    expect(await page.getByTestId(AUTH.FORGOT_PASSWORD_EMAIL_INPUT).isVisible()).toBe(true);
    expect(await page.getByTestId(AUTH.FORGOT_PASSWORD_SUBMIT_BTN).isVisible()).toBe(true);
  });

  it('shows validation error for an invalid email', async () => {
    await navigateTo(page, '/forgot-password');
    await page.getByTestId(AUTH.FORGOT_PASSWORD_EMAIL_INPUT).fill('not-an-email');
    await page.getByTestId(AUTH.FORGOT_PASSWORD_SUBMIT_BTN).click();

    await page.waitForTimeout(500);
    expect(await page.getByTestId(AUTH.FORGOT_PASSWORD_EMAIL_INPUT).isVisible()).toBe(true);
    expect(new URL(page.url()).pathname).toMatch(/^\/forgot-password\/?$/);
  });

  it('submits a valid email and shows the generic success state', async () => {
    await navigateTo(page, '/forgot-password');
    await page.getByTestId(AUTH.FORGOT_PASSWORD_EMAIL_INPUT).fill('admin@example.test');
    await page.getByTestId(AUTH.FORGOT_PASSWORD_SUBMIT_BTN).click();

    await page
      .getByText(/If an account exists for this email/i)
      .waitFor({ state: 'visible', timeout: 15000 });
    expect(await page.getByRole('link', { name: /back to login/i }).isVisible()).toBe(true);
  });
});
