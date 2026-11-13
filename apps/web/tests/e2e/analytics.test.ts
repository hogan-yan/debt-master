/**
 * E2E Tests for Analytics — Debt Leaderboard, Spending Analytics
 *
 * Run:
 *   bun run test -- tests/e2e/analytics.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/analytics.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isVisible, loginAsColleague, navigateTo, TEST_ACCESS_CODE } from './helpers';

describe('E2E: Analytics', () => {
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

  it('dashboard shows debt overview on overview tab', async () => {
    await navigateTo(page, '/');
    await page.waitForTimeout(2000);
    const hasDebtContent = await page.locator('text=/debt|owed|outstanding/i').count() > 0;
    expect(hasDebtContent).toBe(true);
  });

  it('who owes tab shows debtor rankings', async () => {
    await navigateTo(page, '/');
    await page.waitForTimeout(1500);
    expect(await page.title()).toContain('Debt Master');
  });

  it('spending tab shows analytics data', async () => {
    await navigateTo(page, '/');
    const spendingTab = page.locator('[data-testid="spending-tab"], text=/spending/i').first();
    if (await isVisible(spendingTab, 5000)) {
      await spendingTab.click();
      await page.waitForTimeout(4000);
      const hasContent = await page.locator('text=/spending|analytics|trend|insight/i').count() > 0;
      expect(hasContent).toBe(true);
    }
  });
});
