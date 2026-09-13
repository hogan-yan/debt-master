/**
 * Mobile E2E Test Helpers
 *
 * Browser context factory and navigation helpers for mobile (Pixel 5) testing.
 * Uses Playwright's devices preset for realistic touch/UA at 393x830.
 */

import { type Browser, type Page, chromium, devices } from 'playwright';
import { NAV } from '../../src/test/test-ids';

export const BASE_URL = process.env['APP_URL'] || 'http://localhost:3000';

/**
 * Path-to-label mapping for mobile drawer navigation.
 * Used by navigateMobileTo to click the correct link in the hamburger drawer.
 */
const pathToTestId: Record<string, string> = {
  '/': NAV.DASHBOARD_LINK,
  '/expenses': NAV.EXPENSES_LINK,
  '/colleagues': NAV.COLLEAGUES_LINK,
  '/restaurants': NAV.RESTAURANTS_LINK,
  '/payments': NAV.PAYMENTS_LINK,
};

/**
 * Create a mobile browser context (Pixel 5: 393x830 with touch + mobile UA).
 */
export async function createMobileBrowserPage(): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(devices['Pixel 5']);
  const page = await context.newPage();
  return { browser, page };
}

/**
 * Open the mobile hamburger menu.
 * Clicks the toggle button and waits for the drawer to render.
 */
export async function openMobileMenu(page: Page): Promise<void> {
  const toggle = page.getByTestId(NAV.MOBILE_MENU_TOGGLE_BTN);
  await toggle.click();
  // Wait for the mobile drawer links to render (React state update).
  // Use .last() because desktop nav shares the same test-ids (hidden on mobile).
  await page.getByTestId(NAV.DASHBOARD_LINK).last().waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Navigate to a path using the mobile hamburger drawer.
 * Falls back to direct navigation for paths not in the drawer.
 */
export async function navigateMobileTo(page: Page, path: string): Promise<void> {
  const testid = pathToTestId[path];
  if (testid) {
    await openMobileMenu(page);
    await page.getByTestId(testid).last().click();
  } else {
    await page.keyboard.press('Escape');
    const base = BASE_URL.replace(/\/$/, '');
    await page.goto(`${base}${path}`);
  }
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}
