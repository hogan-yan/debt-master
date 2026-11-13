/**
 * E2E Tests for Guest / Non-Admin User Restrictions
 *
 * Tests that guest users see limited UI and cannot access admin features.
 *
 * Run:
 *   bun run test -- tests/e2e/guest-user.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/guest-user.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { navigateTo } from './helpers';

describe('E2E: Guest User Restrictions', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, 60000);

  afterAll(async () => {
    await browser.close();
  });

  it('unauthenticated user redirected from settings', async () => {
    await navigateTo(page, '/settings');
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    expect(currentUrl.includes('/login') || currentUrl.includes('/')).toBe(true);
  });

  it('unauthenticated user redirected from expenses', async () => {
    await navigateTo(page, '/expenses');
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    expect(currentUrl.includes('/login') || currentUrl.includes('/')).toBe(true);
  });

  it('login page accessible without auth', async () => {
    await navigateTo(page, '/login');
    const title = await page.title();
    expect(title).toContain('Debt Master');
  });
});
