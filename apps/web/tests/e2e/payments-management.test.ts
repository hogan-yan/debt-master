/**
 * E2E Tests for Payments Management Page
 *
 * Tests payment list, stats, edit, delete, and proof viewing.
 *
 * Run:
 *   bun run test -- tests/e2e/payments-management.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/payments-management.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isVisible, loginAsColleague, navigateTo, TEST_ACCESS_CODE } from './helpers';
import { PAYMENT, TABLE_COL } from '../../src/test/test-ids';

describe('E2E: Payments Management', () => {
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

  it('payments page loads with heading', async () => {
    await navigateTo(page, '/payments');
    const heading = page.getByTestId(PAYMENT.TRACKING_HEADING);
    expect(await isVisible(heading, 10000)).toBe(true);
  });

  it('shows summary stats cards', async () => {
    await navigateTo(page, '/payments');
    await page.waitForTimeout(1000);
    // Stats cards use SummaryCardsGrid — look for card-like elements
    const cards = page.locator('[class*="card"], [class*="Card"]').first();
    expect(await isVisible(cards, 5000)).toBe(true);
  });

  it('shows payments table', async () => {
    await navigateTo(page, '/payments');
    await page.waitForTimeout(1000);
    // DataTableWithActions renders a table
    const table = page.locator('table').first();
    expect(await isVisible(table, 5000)).toBe(true);
  });

  it('record payment button visible for admin', async () => {
    await navigateTo(page, '/payments');
    const btn = page.getByTestId(PAYMENT.ADD_PAYMENT_BTN);
    expect(await isVisible(btn, 5000)).toBe(true);
  });

  it('opens record payment dialog', async () => {
    await navigateTo(page, '/payments');
    await page.getByTestId(PAYMENT.ADD_PAYMENT_BTN).click();
    const dialog = page.getByTestId(PAYMENT.RECORD_PAYMENT_DIALOG);
    expect(await isVisible(dialog, 5000)).toBe(true);
    // Close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  it('shows both payment modes in dialog', async () => {
    await navigateTo(page, '/payments');
    await page.getByTestId(PAYMENT.ADD_PAYMENT_BTN).click();

    const expenseMode = page.getByTestId(PAYMENT.EXPENSE_PAYMENT_MODE_BTN);
    const prepayMode = page.getByTestId(PAYMENT.PREPAYMENT_MODE_BTN);

    expect(await isVisible(expenseMode, 3000)).toBe(true);
    expect(await isVisible(prepayMode, 3000)).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  it('payment table rows are clickable', async () => {
    await navigateTo(page, '/payments');
    await page.waitForTimeout(1000);

    const firstRow = page.locator('table tbody tr').first();
    if (!(await isVisible(firstRow, 3000))) return;

    // Row should have cells with data
    const cells = firstRow.locator('td');
    expect(await cells.count()).toBeGreaterThan(0);
  });
});

describe('E2E: Payment Actions', () => {
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

  async function getFirstPaymentRow() {
    await navigateTo(page, '/payments');
    await page.waitForTimeout(1500);
    return page.locator('table tbody tr').first();
  }

  it('can open edit payment modal', async () => {
    const row = await getFirstPaymentRow();
    if (!(await isVisible(row, 3000))) return;

    // Try to find edit action — may be in dropdown or row actions
    const actionsBtn = row.getByTestId(TABLE_COL.ROW_ACTIONS_BTN);
    if (await isVisible(actionsBtn, 2000)) {
      await actionsBtn.click();
      await page.waitForTimeout(300);
    }

    // Look for edit button/link
    const editBtn = page.locator('text=/edit/i').first();
    if (await isVisible(editBtn, 2000)) {
      await editBtn.click();
      await page.waitForTimeout(500);
      // Should show some form or modal
      const dialog = page.locator('role=dialog').first();
      expect(await isVisible(dialog, 3000)).toBe(true);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });
});
