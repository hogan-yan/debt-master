/**
 * E2E Test Helpers
 *
 * Shared utilities for Playwright + Vitest e2e tests.
 * Best practices:
 * - Wait for hydration before interacting
 * - Use deterministic seeded credentials
 * - Centralize auth state management
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { Page } from 'playwright';
import {
  AUTH,
  NAV,
  TABLE_COL,
} from '../../src/test/test-ids';

const BASE_URL = process.env['APP_URL'] || 'http://localhost:3000';
const IS_REMOTE = !BASE_URL.includes('localhost');

/**
 * Admin access code from .env TEST_ADMIN_ACCESS_CODE.
 * Grants full admin permissions for E2E tests.
 */
export const TEST_ACCESS_CODE = process.env.TEST_ADMIN_ACCESS_CODE || 'admin123';

/**
 * Wait for the Vite React client runtime to install its preamble.
 * This is a reliable signal that the SPA has hydrated and can handle
 * client-side navigation and form submissions.
 *
 * Falls back to a fixed delay for production builds where the preamble
 * marker is not present.
 */
async function waitForHydration(page: Page): Promise<void> {
  try {
    await page.waitForFunction(
      () =>
        typeof window !== 'undefined' &&
        (window as unknown as Record<string, unknown>).__vite_plugin_react_preamble_installed__ ===
          true,
      undefined,
      { timeout: IS_REMOTE ? 15000 : 10000 }
    );
  } catch {
    // Preamble marker is only present in Vite dev builds; production E2E
    // targets should rely on the fixed hydration delay below.
  }

  // Small buffer so any post-hydration state updates (form validation,
  // Turnstile widget readiness, etc.) have time to settle.
  await page.waitForTimeout(IS_REMOTE ? 1500 : 750);
}

/**
 * Navigate to a route and wait for hydration to complete.
 * Critical for TanStack Start SPA interactions.
 *
 * Uses 'domcontentloaded' + a hydration marker wait instead of 'networkidle'
 * because the TanStack Start dev server keeps HMR/SSE connections open,
 * which prevents 'networkidle' from ever resolving.
 *
 * Remote deployments need longer hydration waits due to network latency.
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  const base = BASE_URL.replace(/\/$/, '');
  await page.goto(`${base}${path}`);
  await page.waitForLoadState('domcontentloaded');
  await waitForHydration(page);
}

/**
 * Perform colleague login via the UI.
 * Waits for navigation to the post-login dashboard.
 */
export async function loginAsColleague(
  page: Page,
  accessCode: string = TEST_ACCESS_CODE
): Promise<void> {
  await navigateTo(page, '/login');
  await page.getByTestId(AUTH.ACCESS_CODE_INPUT).fill(accessCode);

  const loginButton = page.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN);
  await loginButton.waitFor({ state: 'visible' });

  // Ensure the form has hydrated and the submit button is interactive before
  // clicking. A premature click on the SSR HTML can trigger a native GET submit
  // instead of the client-side auth flow.
  const start = Date.now();
  const timeout = IS_REMOTE ? 10000 : 5000;
  while (Date.now() - start < timeout) {
    if (await loginButton.isEnabled()) break;
    await page.waitForTimeout(100);
  }

  await loginButton.click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: IS_REMOTE ? 45000 : 30000 });
  await page.waitForLoadState('domcontentloaded');
  // Wait for auth hydration to complete (navbar shows Dashboard link)
  await page.getByTestId(NAV.DASHBOARD_LINK).waitFor({
    state: 'visible',
    timeout: IS_REMOTE ? 20000 : 15000,
  });
}

const COVERAGE_DIR = resolve('./coverage/e2e-browser');

interface IstanbulCoverage {
  [path: string]: unknown;
}

function isCoverageObject(value: unknown): value is IstanbulCoverage {
  return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
}

/**
 * Extract Istanbul coverage from the browser page and write it to disk.
 * Each call writes a separate JSON file so multiple pages/tests can be merged.
 */
export async function saveBrowserCoverage(page: Page): Promise<void> {
  const coverage = await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    return win.__coverage__ ?? null;
  });

  if (!isCoverageObject(coverage)) {
    return;
  }

  if (!existsSync(COVERAGE_DIR)) {
    mkdirSync(COVERAGE_DIR, { recursive: true });
  }

  const fileName = `coverage-${randomUUID()}.json`;
  writeFileSync(resolve(COVERAGE_DIR, fileName), JSON.stringify(coverage, null, 2));
}

/**
 * Wait for an element to become visible (attached to DOM + visible).
 * Uses Playwright's waitFor so it actually waits for elements to appear.
 * Uses .first() to avoid multi-match locator ambiguity when both desktop
 * and mobile views render the same text (e.g., hidden mobile cards).
 * Remote deployments use longer default timeout due to network latency.
 */
export async function isVisible(
  locator: ReturnType<Page['locator']>,
  timeout?: number
): Promise<boolean> {
  const actualTimeout = timeout ?? (IS_REMOTE ? 20000 : 15000);
  try {
    await locator.first().waitFor({ state: 'visible', timeout: actualTimeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Close any open dialogs/overlays with Escape and wait briefly.
 */
export async function closeDialogs(page: Page): Promise<void> {
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch {
    // ignore
  }
}

/**
 * Click the row actions menu button within a given row locator.
 */
export async function openActionMenu(
  page: Page,
  row: ReturnType<Page['locator']>
): Promise<void> {
  const menuButton = row.getByTestId(TABLE_COL.ROW_ACTIONS_BTN);
  await menuButton.click();
  await page.waitForTimeout(500);
}
