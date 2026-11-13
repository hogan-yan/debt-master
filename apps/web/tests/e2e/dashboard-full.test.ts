/**
 * E2E Tests for Dashboard — Beyond Who Owes
 *
 * Tests overview tab, stats cards, activity feed, colleagues tab,
 * pending payments, charts, and quick payment.
 *
 * Run:
 *   bun run test -- tests/e2e/dashboard-full.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/dashboard-full.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isVisible, loginAsColleague, navigateTo, TEST_ACCESS_CODE } from './helpers';
import { DASHBOARD } from '../../src/test/test-ids';

describe('E2E: Dashboard — Full', () => {
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

  it('dashboard loads with overview tab active', async () => {
    await navigateTo(page, '/');
    const heading = page.getByTestId(DASHBOARD.HEADING);
    expect(await isVisible(heading, 15000)).toBe(true);
  });

  it('overview tab shows stats cards', async () => {
    await navigateTo(page, '/');
    await page.getByTestId(DASHBOARD.OVERVIEW_TAB).click();
    await page.waitForTimeout(1500);
    const cards = page.locator('[class*="card"]').first();
    expect(await isVisible(cards, 10000)).toBe(true);
  });

  it('shows debt overview metrics', async () => {
    await navigateTo(page, '/');
    await page.getByTestId(DASHBOARD.OVERVIEW_TAB).click();
    await page.waitForTimeout(1500);
    const hasMetrics = await page.locator('text=/debt|lunch|average|spent/i').count() > 0;
    expect(hasMetrics).toBe(true);
  });

  it('restaurants tab loads chart data', async () => {
    await navigateTo(page, '/');
    const tab = page.getByTestId(DASHBOARD.RESTAURANTS_TAB);
    expect(await isVisible(tab, 10000)).toBe(true);

    await tab.click();
    await page.waitForTimeout(4000);

    const hasContent = await page.locator('text=/restaurant|chart|visits|popularity/i').count() > 0;
    expect(hasContent).toBe(true);
  });

  it('spending tab loads analytics', async () => {
    await navigateTo(page, '/');
    const tab = page.getByTestId(DASHBOARD.SPENDING_TAB);
    expect(await isVisible(tab, 10000)).toBe(true);

    await tab.click();
    await page.waitForTimeout(4000);

    const hasContent = await page.locator('text=/spending|analytics|trend|insight/i').count() > 0;
    expect(hasContent).toBe(true);
  });
});
