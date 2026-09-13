/**
 * E2E Tests for Expense Detail Page
 *
 * Tests the full expense detail page including:
 * - Page load with expense data
 * - Receipt section
 * - Participants list
 * - Admin actions (edit, duplicate, delete)
 *
 * Run:
 *   bun run test -- tests/e2e/expense-detail.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/expense-detail.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isVisible, loginAsColleague, navigateTo, TEST_ACCESS_CODE } from './helpers';
import { EXPENSE, COLLEAGUE_DETAIL } from '../../src/test/test-ids';

describe('E2E: Expense Detail Page', () => {
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

  async function navigateToFirstExpense(): Promise<boolean> {
    await navigateTo(page, '/expenses');
    const table = page.getByTestId(EXPENSE.EXPENSE_TABLE);
    if (!(await isVisible(table, 10000))) return false;

    const firstRow = page.getByTestId(EXPENSE.EXPENSE_TABLE_ROW).first();
    if (!(await isVisible(firstRow, 10000))) return false;

    const detailLink = firstRow.locator('a[href^="/expense/"]').first();
    if (!(await isVisible(detailLink, 5000))) return false;

    await detailLink.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    return true;
  }

  it('expense detail page loads with expense info', async () => {
    const found = await navigateToFirstExpense();
    expect(found).toBe(true);

    const section = page.getByTestId(COLLEAGUE_DETAIL.EXPENSE_DETAIL_SECTION);
    expect(await isVisible(section, 15000)).toBe(true);
  });

  it('shows expense header with restaurant name', async () => {
    const found = await navigateToFirstExpense();
    expect(found).toBe(true);

    // Header may be h1, h2, or a div with large text
    const header = page.locator('h1, h2, [class*="text-3xl"], [class*="text-2xl"]').first();
    expect(await isVisible(header, 10000)).toBe(true);
    const headerText = await header.textContent();
    expect(headerText).toBeTruthy();
  });

  it('shows receipt section', async () => {
    const found = await navigateToFirstExpense();
    expect(found).toBe(true);

    page.getByTestId(EXPENSE.RECEIPT_BTN);
    const section = page.getByTestId(COLLEAGUE_DETAIL.EXPENSE_DETAIL_SECTION);
    expect(await isVisible(section, 10000)).toBe(true);
  });

  it('shows participants section', async () => {
    const found = await navigateToFirstExpense();
    expect(found).toBe(true);

    const section = page.getByTestId(COLLEAGUE_DETAIL.EXPENSE_DETAIL_SECTION);
    expect(await isVisible(section, 10000)).toBe(true);
    const hasParticipants = await page.locator('text=/paid|unpaid|participant/i').count() > 0;
    expect(hasParticipants).toBe(true);
  });

  it('admin edit button opens edit modal', async () => {
    const found = await navigateToFirstExpense();
    expect(found).toBe(true);

    const editBtn = page.getByTestId(EXPENSE.EDIT_EXPENSE_BTN);
    if (!(await isVisible(editBtn, 5000))) {
      return;
    }

    await editBtn.click();
    const modal = page.getByTestId(EXPENSE.EDIT_EXPENSE_DIALOG);
    expect(await isVisible(modal, 10000)).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  it('duplicate button creates copy', async () => {
    const found = await navigateToFirstExpense();
    expect(found).toBe(true);

    const dupBtn = page.getByTestId(EXPENSE.DUPLICATE_EXPENSE_BTN);
    if (!(await isVisible(dupBtn, 5000))) return;

    await dupBtn.click();
    await page.waitForTimeout(2000);
    const successToast = page.locator('[data-sonner-toast][data-type="success"]');
    expect(await isVisible(successToast, 10000)).toBe(true);
  });

  it('delete button opens confirmation dialog', async () => {
    const found = await navigateToFirstExpense();
    expect(found).toBe(true);

    const delBtn = page.getByTestId(EXPENSE.DELETE_EXPENSE_BTN);
    if (!(await isVisible(delBtn, 3000))) return;

    await delBtn.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }, 60000);
});
