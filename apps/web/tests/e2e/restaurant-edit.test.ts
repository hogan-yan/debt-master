/**
 * E2E Tests for Restaurant Edit, Pagination, and Charts
 *
 * Run:
 *   bun run test -- tests/e2e/restaurant-edit.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/restaurant-edit.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isVisible, loginAsColleague, navigateTo, TEST_ACCESS_CODE } from './helpers';
import { RESTAURANT, RESTAURANT_DETAIL } from '../../src/test/test-ids';

describe('E2E: Restaurant Edit and Pagination', () => {
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

  it('restaurant detail has edit button', async () => {
    await navigateTo(page, '/restaurants');
    const firstRow = page.getByTestId(RESTAURANT.RESTAURANT_TABLE_ROW).first();
    if (!(await isVisible(firstRow, 10000))) return;

    const viewBtn = firstRow.getByTestId(RESTAURANT.VIEW_DETAILS_MENUITEM);
    if (await isVisible(viewBtn, 5000)) {
      await viewBtn.click();
    } else {
      const link = firstRow.locator('a').first();
      await link.click();
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const editBtn = page.getByTestId(RESTAURANT.EDIT_BTN);
    expect(await isVisible(editBtn, 10000)).toBe(true);
  });

  it('can enter inline edit mode on restaurant detail', async () => {
    await navigateTo(page, '/restaurants');
    const firstRow = page.getByTestId(RESTAURANT.RESTAURANT_TABLE_ROW).first();
    if (!(await isVisible(firstRow, 10000))) return;

    const viewBtn = firstRow.getByTestId(RESTAURANT.VIEW_DETAILS_MENUITEM);
    if (await isVisible(viewBtn, 5000)) {
      await viewBtn.click();
    } else {
      const link = firstRow.locator('a').first();
      await link.click();
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const editBtn = page.getByTestId(RESTAURANT.EDIT_BTN);
    if (!(await isVisible(editBtn, 5000))) return;

    await editBtn.click();
    await page.waitForTimeout(1000);

    // Inline editing shows input fields and save/cancel buttons
    const nameInput = page.getByTestId(RESTAURANT_DETAIL.DETAIL_RESTAURANT_NAME_INPUT);
    const saveBtn = page.getByTestId(RESTAURANT.SAVE_CHANGES_BTN);
    expect(await isVisible(nameInput, 10000) || await isVisible(saveBtn, 10000)).toBe(true);

    // Cancel edit
    const cancelBtn = page.getByTestId('cancel-btn');
    if (await isVisible(cancelBtn, 3000)) {
      await cancelBtn.click();
    }
    await page.waitForTimeout(300);
  });

  it('restaurants page shows table with rows', async () => {
    await navigateTo(page, '/restaurants');
    await page.waitForTimeout(1500);
    const rows = page.getByTestId(RESTAURANT.RESTAURANT_TABLE_ROW);
    expect(await rows.count()).toBeGreaterThan(0);
  });

  it('restaurant detail shows summary cards', async () => {
    await navigateTo(page, '/restaurants');
    const firstRow = page.getByTestId(RESTAURANT.RESTAURANT_TABLE_ROW).first();
    if (!(await isVisible(firstRow, 10000))) return;

    const link = firstRow.locator('a').first();
    await link.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const kpi1 = page.getByTestId(RESTAURANT_DETAIL.TOTAL_EXPENSES_KPI);
    const kpi2 = page.getByTestId(RESTAURANT_DETAIL.TOTAL_AMOUNT_SPENT_KPI);
    expect(await isVisible(kpi1, 10000) || await isVisible(kpi2, 10000)).toBe(true);
  });
});
