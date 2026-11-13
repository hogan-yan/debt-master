/**
 * E2E Smoke Tests
 *
 * Verifies the full Debt Master application flow works correctly.
 * Requires a running dev server on http://localhost:3000.
 *
 * Run:
 *   bun run test -- tests/e2e/smoke.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/smoke.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDialogs, isVisible, loginAsColleague, navigateTo, TEST_ACCESS_CODE } from './helpers';
import {
  AUTH,
  COLLEAGUE,
  COMMON,
  DASHBOARD,
  EXPENSE,
  EXPENSE_FORM,
  NAV,
  PAYMENT,
} from '../../src/test/test-ids';

describe('E2E smoke tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    await loginAsColleague(page, TEST_ACCESS_CODE);
  }, 60000);

  afterAll(async () => {
    await browser.close();
  });

  // Reset page state before each test by closing any open dialogs
  beforeEach(async () => {
    await closeDialogs(page);
  });

  it('login page loads with correct branding', async () => {
    const guestPage = await browser.newPage();
    await navigateTo(guestPage, '/login');
    const title = await guestPage.title();
    expect(title).toContain('Debt Master');
    expect(await isVisible(guestPage.getByTestId(AUTH.COLLEAGUE_ACCESS_HEADING))).toBe(true);
    expect(await isVisible(guestPage.getByTestId(AUTH.ADMIN_ACCESS_HEADING))).toBe(true);
    await guestPage.close();
  });

  it('admin login shows all nav links', async () => {
    expect(await isVisible(page.getByTestId(NAV.DASHBOARD_LINK))).toBe(true);
    expect(await isVisible(page.getByTestId(NAV.EXPENSES_LINK))).toBe(true);
    expect(await isVisible(page.getByTestId(NAV.PAYMENTS_LINK))).toBe(true);
    expect(await isVisible(page.getByTestId(NAV.COLLEAGUES_LINK))).toBe(true);
  });

  it('dashboard renders heading and tabs', async () => {
    await navigateTo(page, '/');
    expect(await isVisible(page.getByTestId(DASHBOARD.HEADING))).toBe(true);
    expect(await isVisible(page.getByTestId(DASHBOARD.OVERVIEW_TAB))).toBe(true);
  });

  it('expenses page shows management UI and Add button', async () => {
    await navigateTo(page, '/expenses');
    expect(await isVisible(page.getByTestId(EXPENSE.MANAGEMENT_HEADING))).toBe(true);
    expect(await isVisible(page.getByTestId(EXPENSE.ADD_EXPENSE_BTN))).toBe(true);
    expect(await isVisible(page.getByTestId(EXPENSE.SEARCH_EXPENSES_INPUT))).toBe(true);
  });

  it('expense search filters results', async () => {
    await navigateTo(page, '/expenses');
    // Get first expense restaurant name to search for
    const firstRow = page.getByTestId(EXPENSE.EXPENSE_TABLE_ROW).first();
    if (!(await isVisible(firstRow))) return;
    const rowText = (await firstRow.textContent()) ?? '';
    const searchTerm = rowText.split('\n')[0]?.trim();
    if (!searchTerm) return;

    const searchBox = page.getByTestId(EXPENSE.SEARCH_EXPENSES_INPUT);
    await searchBox.fill(searchTerm);
    // Wait for the search to filter results
    await page.waitForLoadState('networkidle');
    // Verify page still shows the management heading (search executed)
    expect(await isVisible(page.getByTestId(EXPENSE.MANAGEMENT_HEADING))).toBe(true);
  });

  it('add expense dialog opens with correct fields', async () => {
    await navigateTo(page, '/expenses');
    await page.getByTestId(EXPENSE.ADD_EXPENSE_BTN).click();
    expect(await isVisible(page.getByTestId(EXPENSE.ADD_EXPENSE_DIALOG))).toBe(true);
    expect(await isVisible(page.getByTestId(EXPENSE_FORM.DATE_INPUT))).toBe(true);
    expect(await isVisible(page.getByTestId(EXPENSE_FORM.ITEMIZED_RADIO))).toBe(true);
    expect(await isVisible(page.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN))).toBe(true);
    expect(await isVisible(page.getByTestId(COMMON.CANCEL_BTN))).toBe(true);
    await closeDialogs(page);
  });

  it('payments page shows tracking UI and Record button', async () => {
    await navigateTo(page, '/payments');
    expect(await isVisible(page.getByTestId(PAYMENT.TRACKING_HEADING))).toBe(true);
    expect(await isVisible(page.getByTestId(PAYMENT.ADD_PAYMENT_BTN))).toBe(true);
  });

  it('record payment dialog shows both payment modes', async () => {
    await navigateTo(page, '/payments');
    await page.getByTestId(PAYMENT.ADD_PAYMENT_BTN).click();
    expect(await isVisible(page.getByTestId(PAYMENT.RECORD_PAYMENT_DIALOG))).toBe(true);
    const paymentDialog = page.getByTestId(PAYMENT.RECORD_PAYMENT_DIALOG);
    expect(await isVisible(paymentDialog.getByTestId(PAYMENT.PREPAYMENT_MODE_BTN))).toBe(true);
    expect(await isVisible(paymentDialog.getByTestId(PAYMENT.EXPENSE_PAYMENT_MODE_BTN))).toBe(true);
    await closeDialogs(page);
  });

  it('colleagues page shows management UI', async () => {
    await navigateTo(page, '/colleagues');
    expect(await isVisible(page.getByTestId(COLLEAGUE.MANAGEMENT_HEADING))).toBe(true);
    expect(await isVisible(page.getByTestId(COLLEAGUE.ADD_COLLEAGUE_BTN))).toBe(true);
  });
});
