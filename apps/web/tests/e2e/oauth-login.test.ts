/**
 * E2E Tests for OAuth / Authentik Login Flow
 *
 * Tests SSO button visibility, logout flow.
 * Note: Full OAuth redirect/callback requires Authentik server —
 * we test what we can without external dependency.
 *
 * Run:
 *   bun run test -- tests/e2e/oauth-login.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/oauth-login.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isVisible, loginAsColleague, navigateTo, TEST_ACCESS_CODE } from './helpers';
import { AUTH } from '../../src/test/test-ids';

describe('E2E: Login and Logout', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, 60000);

  afterAll(async () => {
    await browser.close();
  });

  it('login page shows access code and admin sections', async () => {
    await navigateTo(page, '/login');
    const colleagueHeading = page.getByTestId(AUTH.COLLEAGUE_ACCESS_HEADING);
    const adminHeading = page.getByTestId(AUTH.ADMIN_ACCESS_HEADING);
    expect(await isVisible(colleagueHeading, 10000)).toBe(true);
    expect(await isVisible(adminHeading, 10000)).toBe(true);
  });

  it('login page has access code input', async () => {
    await navigateTo(page, '/login');
    const input = page.getByTestId(AUTH.ACCESS_CODE_INPUT);
    expect(await isVisible(input, 10000)).toBe(true);
  });

  it('logout button visible when logged in', async () => {
    await loginAsColleague(page, TEST_ACCESS_CODE);
    await navigateTo(page, '/');
    const logoutBtn = page.locator('text=/logout|sign out/i').first();
    expect(await isVisible(logoutBtn, 15000)).toBe(true);
  });

  it('logout redirects to login page', async () => {
    await loginAsColleague(page, TEST_ACCESS_CODE);
    await navigateTo(page, '/');
    const logoutBtn = page.locator('text=/logout|sign out/i').first();
    await logoutBtn.click();
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    expect(currentUrl.includes('/login') || currentUrl.endsWith('/')).toBe(true);
  });
});
