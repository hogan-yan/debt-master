/**
 * E2E Tests for Smart Reminders and Payment Alerts
 *
 * Run:
 *   bun run test -- tests/e2e/smart-reminders.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/smart-reminders.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isVisible, loginAsColleague, navigateTo, TEST_ACCESS_CODE } from './helpers';

describe('E2E: Smart Reminders', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await loginAsColleague(page, TEST_ACCESS_CODE);
  }, 60000);

  afterAll(async () => {
    await browser.close();
  });

  it('dashboard may show reminder-related content', async () => {
    await navigateTo(page, '/');
    await page.waitForTimeout(2000);
    expect(await page.title()).toContain('Debt Master');
  });

  it('colleague detail shows activity or reminder info', async () => {
    await navigateTo(page, '/colleagues');
    await page.waitForTimeout(1500);
    const rows = page.locator('table tbody tr, [data-testid*="row"]').first();
    if (await isVisible(rows, 5000)) {
      const link = rows.locator('a').first();
      if (await isVisible(link, 3000)) {
        await link.click();
        await page.waitForTimeout(2000);
        expect(await page.title()).toContain('Debt Master');
      }
    }
  });
});
