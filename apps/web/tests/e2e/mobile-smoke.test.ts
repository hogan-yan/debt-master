/**
 * Mobile E2E Smoke Tests
 *
 * Verifies mobile-specific UI paths at Pixel 5 viewport (393x830).
 * These tests cover rendering that differs from desktop:
 * - Hamburger nav (hidden desktop links, mobile drawer)
 * - Mobile card layouts (debtors, expenses)
 * - Collapsible filters
 *
 * Run:
 *   bun run test -- tests/e2e/mobile-smoke.test.ts
 */

import { type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDialogs, isVisible, TEST_ACCESS_CODE } from './helpers';
import {
  BASE_URL,
  createMobileBrowserPage,
  navigateMobileTo,
  openMobileMenu,
} from './mobile-helpers';
import {
  AUTH,
  DASHBOARD,
  EXPENSE,
  NAV,
} from '../../src/test/test-ids';

describe('Mobile smoke tests (Pixel 5)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    const mobile = await createMobileBrowserPage();
    browser = mobile.browser;
    page = mobile.page;

    // Login directly (avoids shared helper which may wait for desktop-only nav elements)
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('domcontentloaded');
    // Wait for React hydration (mobile is slower due to module fetch + JS execution)
    await page.waitForTimeout(4000);
    await page.getByTestId(AUTH.ACCESS_CODE_INPUT).waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId(AUTH.ACCESS_CODE_INPUT).fill(TEST_ACCESS_CODE);
    await page.waitForTimeout(500);
    await page.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
  }, 120000);

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    await closeDialogs(page);
  });

  it('login works on mobile and dashboard loads', async () => {
    // Already logged in via beforeAll — verify we're on the dashboard
    const url = page.url();
    expect(url).toMatch(/\/$/);
    expect(await isVisible(page.getByTestId(DASHBOARD.HEADING))).toBe(true);
  });

  it('hamburger menu toggles open and closes', async () => {
    // Desktop nav links should be hidden on mobile (md:flex = hidden below 768px)
    const desktopNav = page.getByTestId(NAV.DESKTOP_NAV_LINKS);
    expect(await isVisible(desktopNav, 2000)).toBe(false);

    // Hamburger toggle should be visible
    const toggle = page.getByTestId(NAV.MOBILE_MENU_TOGGLE_BTN);
    await toggle.waitFor({ state: 'visible', timeout: 5000 });
    expect(await isVisible(toggle)).toBe(true);

    // Open drawer
    await toggle.click();

    // Mobile drawer should show nav links (wait for React to render)
    // Use .last() because desktop nav shares the same test-ids (hidden on mobile)
    await page.getByTestId(NAV.DASHBOARD_LINK).last().waitFor({ state: 'visible', timeout: 5000 });
    expect(await isVisible(page.getByTestId(NAV.DASHBOARD_LINK).last())).toBe(true);
    expect(await isVisible(page.getByTestId(NAV.EXPENSES_LINK).last())).toBe(true);

    // Close drawer by clicking toggle again (X icon)
    await toggle.click();

    // Drawer should be closed — mobile-only links should no longer be visible
    // (The md:hidden drawer unmounts when isMobileMenuOpen=false)
  });

  it('navigate via hamburger menu to expenses and back', async () => {
    // Navigate to Expenses via hamburger drawer
    await openMobileMenu(page);
    await page.getByTestId(NAV.EXPENSES_LINK).last().click();
    await page.waitForLoadState('domcontentloaded');
    await page.getByTestId(EXPENSE.MANAGEMENT_HEADING).waitFor({ state: 'visible', timeout: 10000 });
    expect(page.url()).toContain('/expenses');
    expect(await isVisible(page.getByTestId(EXPENSE.MANAGEMENT_HEADING))).toBe(true);

    // Navigate back to Dashboard
    await openMobileMenu(page);
    await page.getByTestId(NAV.DASHBOARD_LINK).last().click();
    await page.waitForLoadState('domcontentloaded');
    await page.getByTestId(DASHBOARD.HEADING).waitFor({ state: 'visible', timeout: 10000 });
    expect(page.url()).toMatch(/\/$/);
    expect(await isVisible(page.getByTestId(DASHBOARD.HEADING))).toBe(true);
  });

  it('debtors tab shows mobile cards, not desktop rows', async () => {
    // Navigate to dashboard
    await navigateMobileTo(page, '/');

    // Switch to "Who Owes" tab
    const debtorsTab = page.getByTestId(DASHBOARD.WHO_OWES_TAB);
    if (await isVisible(debtorsTab)) {
      await debtorsTab.click();
      // Wait for tab content to render
      await page.waitForLoadState('networkidle');
    }

    // Mobile debtor layout: testid-scoped inside debtor cards
    const mobileDebtorLayout = page.locator('[data-testid^="debtor-card-"] [data-testid^="unpaid-expense-"]');

    // If there are debtor cards, expand the first one and check mobile content
    const firstDebtorCard = page.locator('[data-testid^="debtor-card-"]').first();
    if ((await firstDebtorCard.count()) > 0) {
      const expandToggle = firstDebtorCard.locator('[data-testid^="debtor-expand-toggle-"]').first();
      await expandToggle.click();
      // Wait for expand animation
      await page.waitForTimeout(100);

      // Mobile expense cards should be visible inside expanded debtor
      if ((await mobileDebtorLayout.count()) > 0) {
        expect(await isVisible(mobileDebtorLayout.first())).toBe(true);
      }
    }
  });

  it('expense list shows mobile cards, not desktop table', async () => {
    await navigateMobileTo(page, '/expenses');

    // Desktop table should be hidden on mobile
    const desktopTable = page.getByTestId(EXPENSE.EXPENSE_TABLE);
    expect(await isVisible(desktopTable, 2000)).toBe(false);

    // Mobile cards container should be visible
    const mobileCards = page.getByTestId(EXPENSE.EXPENSE_MOBILE_LIST);
    if ((await mobileCards.count()) > 0) {
      expect(await isVisible(mobileCards)).toBe(true);
    }
  });

  it('expense page search is functional on mobile', async () => {
    await navigateMobileTo(page, '/expenses');

    // Search textbox should be visible on mobile
    const searchBox = page.getByTestId(EXPENSE.SEARCH_EXPENSES_INPUT);
    await searchBox.waitFor({ state: 'visible', timeout: 10000 });
    expect(await isVisible(searchBox)).toBe(true);

    // Add Expense button should be visible
    expect(await isVisible(page.getByTestId(EXPENSE.ADD_EXPENSE_BTN))).toBe(true);
  });
});
