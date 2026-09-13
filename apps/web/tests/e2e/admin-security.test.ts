/**
 * E2E: admin security panel (DEBTM-96 Phase 5).
 *
 * Exercises the `/settings` security panel for Better Auth admins:
 *   - change the admin password
 *   - reject the old password at login
 *   - accept the new password at login
 *   - revoke another active session from the panel
 *
 * PRECONDITIONS:
 *   - `AUTH_PROVIDER=better-auth`
 *   - `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` set
 *   - better_auth tables migrated
 *   - app reachable at `APP_URL` (default http://localhost:3000)
 *
 * Run:
 *   bunx vitest run tests/e2e/admin-security.test.ts --config vitest.e2e.config.ts
 */

import { type Browser, type BrowserContext, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { navigateTo } from './helpers';
import { AUTH, SECURITY, SETUP } from '../../src/test/test-ids';

const ADMIN_EMAIL = `e2e-security-${Date.now()}@example.test`;
const ORIGINAL_PASSWORD = 'Original-Password-1!';
const NEW_PASSWORD = 'New-Password-2!';

describe('E2E: admin security panel', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    const { prisma } = await import('../../src/server/infrastructure/prisma');
    await prisma.betterAuthUser.deleteMany({});
    await prisma.$disconnect();

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();

    // Create the first admin via the setup wizard.
    await navigateTo(page, '/setup');
    await page.getByTestId(SETUP.NAME_INPUT).fill('E2E Security Admin');
    await page.getByTestId(SETUP.EMAIL_INPUT).fill(ADMIN_EMAIL);
    await page.getByTestId(SETUP.PASSWORD_INPUT).fill(ORIGINAL_PASSWORD);
    await page.getByTestId(SETUP.SUBMIT_BTN).click();
    await page.waitForURL((url) => /^\/?$/.test(url.pathname), { timeout: 30000 });
  }, 60000);

  afterAll(async () => {
    await browser.close();
  });

  it('changes the admin password from the security panel', async () => {
    await navigateTo(page, '/settings');

    await page.getByTestId(SECURITY.CURRENT_PASSWORD_INPUT).fill(ORIGINAL_PASSWORD);
    await page.getByTestId(SECURITY.NEW_PASSWORD_INPUT).fill(NEW_PASSWORD);
    await page.getByTestId(SECURITY.CONFIRM_PASSWORD_INPUT).fill(NEW_PASSWORD);
    await page.getByTestId(SECURITY.CHANGE_PASSWORD_SUBMIT_BTN).click();

    // Wait for the change-password submission to finish before asserting.
    await page.getByText('Password changed successfully.').waitFor({ state: 'visible', timeout: 15000 });

    // Audit log should record the password change after reloading the panel.
    await navigateTo(page, '/settings');
    await page.getByTestId(SECURITY.AUDIT_LOG_LIST).waitFor({ state: 'visible', timeout: 15000 });
    expect(await page.getByText('admin.password_changed').count()).toBeGreaterThanOrEqual(1);
  });

  it('rejects the old password after it was changed', async () => {
    await page.context().clearCookies();
    await navigateTo(page, '/login');

    await page.getByTestId(AUTH.ADMIN_EMAIL_INPUT).fill(ADMIN_EMAIL);
    await page.getByTestId(AUTH.ADMIN_PASSWORD_INPUT).fill(ORIGINAL_PASSWORD);
    await page.getByTestId(AUTH.ADMIN_LOGIN_BTN).click();

    await page.waitForTimeout(2000);
    expect(new URL(page.url()).pathname).toMatch(/^\/login\/?$/);
  });

  it('accepts the new password after it was changed', async () => {
    await page.getByTestId(AUTH.ADMIN_EMAIL_INPUT).fill(ADMIN_EMAIL);
    await page.getByTestId(AUTH.ADMIN_PASSWORD_INPUT).fill(NEW_PASSWORD);
    await page.getByTestId(AUTH.ADMIN_LOGIN_BTN).click();

    await page.waitForURL((url) => /^\/?$/.test(url.pathname), { timeout: 30000 });
    expect(new URL(page.url()).pathname).toBe('/');
  });

  it('revokes another active session from the panel', async () => {
    // Open a second browser context so the other session has its own cookie jar.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await navigateTo(otherPage, '/login');
    await otherPage.getByTestId(AUTH.ADMIN_EMAIL_INPUT).fill(ADMIN_EMAIL);
    await otherPage.getByTestId(AUTH.ADMIN_PASSWORD_INPUT).fill(NEW_PASSWORD);
    await otherPage.getByTestId(AUTH.ADMIN_LOGIN_BTN).click();
    await otherPage.waitForURL((url) => /^\/?$/.test(url.pathname), { timeout: 30000 });

    // Back on the admin page, there should now be at least two sessions.
    await navigateTo(page, '/settings');
    await page.getByTestId(SECURITY.SESSIONS_LIST).waitFor({ state: 'visible', timeout: 15000 });
    const sessionCountBefore = await page.getByTestId(SECURITY.SESSION_ITEM).count();
    expect(sessionCountBefore).toBeGreaterThanOrEqual(2);

    // Revoke every non-current session so the other browser context is guaranteed
    // to be invalidated even if there are leftover sessions from earlier steps.
    while ((await page.getByTestId(SECURITY.REVOKE_SESSION_BTN).count()) > 0) {
      await page.getByTestId(SECURITY.REVOKE_SESSION_BTN).first().click();
      await page.waitForTimeout(500);
    }

    // Wait for the list to settle with only the current session remaining.
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="session-item"]').length === 1
    );
    const sessionCountAfter = await page.getByTestId(SECURITY.SESSION_ITEM).count();
    expect(sessionCountAfter).toBe(1);

    // The revoked session should no longer be valid.
    await otherPage.reload();
    await otherPage.waitForURL((url) => /^\/login\/?$/.test(url.pathname), { timeout: 15000 });
    expect(new URL(otherPage.url()).pathname).toMatch(/^\/login\/?$/);

    await otherPage.close();
    await otherContext.close();
  });
});
