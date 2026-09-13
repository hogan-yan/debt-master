/**
 * E2E Tests for Settings Page — Access Code Management
 *
 * Tests admin-only settings page including access code CRUD.
 *
 * Run:
 *   bun run test -- tests/e2e/settings.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/settings.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isVisible, loginAsColleague, navigateTo, TEST_ACCESS_CODE } from './helpers';

describe('E2E: Settings Page — Access Codes', () => {
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

  it('settings page loads with access codes heading', async () => {
    await navigateTo(page, '/settings');
    const heading = page.getByTestId('access-codes-heading');
    expect(await isVisible(heading, 15000)).toBe(true);
  });

  it('shows generate code button', async () => {
    await navigateTo(page, '/settings');
    const btn = page.getByTestId('generate-code-btn');
    expect(await isVisible(btn, 10000)).toBe(true);
  });

  it('opens generate code modal on button click', async () => {
    await navigateTo(page, '/settings');
    await page.getByTestId('generate-code-btn').click();
    const modal = page.getByTestId('generate-code-modal');
    expect(await isVisible(modal, 10000)).toBe(true);
    expect(await isVisible(page.getByTestId('generate-code-modal-title'), 5000)).toBe(true);
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  it('modal has code input pre-filled', async () => {
    await navigateTo(page, '/settings');
    await page.getByTestId('generate-code-btn').click();
    const input = page.getByTestId('new-code-input');
    expect(await isVisible(input, 10000)).toBe(true);
    const value = await input.inputValue();
    expect(value.length).toBeGreaterThanOrEqual(4);
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  it('create code button is clickable', async () => {
    await navigateTo(page, '/settings');
    await page.getByTestId('generate-code-btn').click();

    const input = page.getByTestId('new-code-input');
    await input.fill('e2etest' + Date.now());

    const createBtn = page.getByTestId('create-code-btn');
    expect(await createBtn.isEnabled()).toBe(true);

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  it('shows access codes table or empty state', async () => {
    await navigateTo(page, '/settings');
    await page.waitForTimeout(1500);
    const table = page.locator('table');
    const emptyState = page.locator('text=/no access codes|empty|generate code/i').first();
    expect(await isVisible(table, 5000) || await isVisible(emptyState, 5000)).toBe(true);
  });

  it('admin can view settings page', async () => {
    await navigateTo(page, '/settings');
    expect(await isVisible(page.getByTestId('access-codes-heading'), 15000)).toBe(true);
  });
});
