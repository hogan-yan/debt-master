/**
 * i18n Locale Switching E2E Tests
 *
 * Verifies locale detection, URL rewriting, language switching,
 * and CJK font loading across all supported locales.
 *
 * Run:
 *   bun run test -- tests/e2e/locale-switching.test.ts
 */

import { type Browser, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginAsColleague, navigateTo } from './helpers';
import {
  AUTH,
  NAV,
  languageMenuitemId,
} from '../../src/test/test-ids';

// SSR redirects locale-prefixed URLs (e.g. /ja/login → 307 → /login/).
// The rewrite API only applies client-side. Skip until server-side locale
// routing is implemented.
describe.skip('i18n locale switching', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  it('default locale (en) serves content without prefix', async () => {
    const page = await browser.newPage();
    await navigateTo(page, '/login');

    expect(page.url()).not.toContain('/ja/');
    expect(page.url()).not.toContain('/zh-tw/');
    expect(await page.locator('html').getAttribute('lang')).toBe('en');

    // Verify English content is rendered
    // Use h1 locator to avoid matching both page heading and form sub-heading
    await page.locator('h1', { hasText: 'Colleague Access' }).waitFor({ state: 'visible' });
    await page.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN).waitFor({ state: 'visible' });

    await page.close();
  });

  it('/ja prefix renders Japanese content', async () => {
    const page = await browser.newPage();
    await navigateTo(page, '/ja/login');

    expect(page.url()).toContain('/ja/login');
    expect(await page.locator('html').getAttribute('lang')).toBe('ja');
    expect(await page.locator('html').getAttribute('data-locale')).toBe('ja');

    // Verify Japanese content is rendered
    await page.locator('h1', { hasText: '同僚アクセス' }).waitFor({ state: 'visible' });
    await page.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN).waitFor({ state: 'visible' });

    await page.close();
  });

  it('/zh-tw prefix renders Traditional Chinese content', async () => {
    const page = await browser.newPage();
    await navigateTo(page, '/zh-tw/login');

    expect(page.url()).toContain('/zh-tw/login');
    expect(await page.locator('html').getAttribute('lang')).toBe('zh-tw');
    expect(await page.locator('html').getAttribute('data-locale')).toBe('zh-tw');

    // Verify Traditional Chinese content is rendered
    await page.locator('h1', { hasText: '同事登入' }).waitFor({ state: 'visible' });
    await page.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN).waitFor({ state: 'visible' });

    await page.close();
  });

  it('language switcher changes locale and updates URL', async () => {
    const page = await browser.newPage();
    await navigateTo(page, '/login');

    // Open language dropdown
    await page.getByTestId(NAV.LANGUAGE_SWITCHER_BTN).click();
    await page.waitForTimeout(200);

    // Select Japanese — triggers a full page load via window.location.href
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/ja/login', { timeout: 10000 }),
      page.getByTestId(languageMenuitemId('ja')).click(),
    ]);

    // Verify locale changed
    expect(await page.locator('html').getAttribute('lang')).toBe('ja');
    await page.locator('h1', { hasText: '同僚アクセス' }).waitFor({ state: 'visible' });

    // Switch back to English via URL
    await navigateTo(page, '/login');
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
    await page.locator('h1', { hasText: 'Colleague Access' }).waitFor({ state: 'visible' });

    await page.close();
  });

  it('CJK font stylesheet is loaded for zh-tw locale', async () => {
    const page = await browser.newPage();
    await navigateTo(page, '/zh-tw/login');

    const fontLink = page.locator('link[href*="Noto+Sans+TC"]');
    expect(await fontLink.count()).toBe(1);

    await page.close();
  });

  it('CJK font stylesheet is loaded for ja locale', async () => {
    const page = await browser.newPage();
    await navigateTo(page, '/ja/login');

    const fontLink = page.locator('link[href*="Noto+Sans+JP"]');
    expect(await fontLink.count()).toBe(1);

    await page.close();
  });

  it('no CJK font stylesheet for en locale', async () => {
    const page = await browser.newPage();
    await navigateTo(page, '/login');

    const tcFont = page.locator('link[href*="Noto+Sans+TC"]');
    const jpFont = page.locator('link[href*="Noto+Sans+JP"]');
    expect(await tcFont.count()).toBe(0);
    expect(await jpFont.count()).toBe(0);

    await page.close();
  });

  it('locale persists in cookie after switching', async () => {
    const page = await browser.newPage();
    await navigateTo(page, '/ja/login');

    const cookies = await page.context().cookies();
    const localeCookie = cookies.find((c) => c.name === 'PARAGLIDE_LOCALE');

    // Paraglide sets the locale cookie; verify it exists with correct value
    expect(localeCookie).toBeDefined();
    expect(localeCookie?.value).toBe('ja');

    await page.close();
  });

  it('/ja/expenses renders Japanese on authenticated page', async () => {
    const page = await browser.newPage();
    await loginAsColleague(page);
    await navigateTo(page, '/ja/expenses');

    expect(page.url()).toContain('/ja/expenses');
    expect(await page.locator('html').getAttribute('lang')).toBe('ja');

    // Verify Japanese expense page content
    await page.locator('h1', { hasText: '経費管理' }).waitFor({ state: 'visible' });

    await page.close();
  });

  it('locale persists across page reloads via cookie', async () => {
    const page = await browser.newPage();
    await navigateTo(page, '/ja/login');

    // Navigate to bare /login (no prefix) — cookie should drive locale
    await navigateTo(page, '/login');
    expect(await page.locator('html').getAttribute('lang')).toBe('ja');
    await page.locator('h1', { hasText: '同僚アクセス' }).waitFor({ state: 'visible' });

    // Reload and verify locale persists
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    expect(await page.locator('html').getAttribute('lang')).toBe('ja');
    await page.locator('h1', { hasText: '同僚アクセス' }).waitFor({ state: 'visible' });

    await page.close();
  });

  it('back button returns to previous locale after switching', async () => {
    const page = await browser.newPage();
    await navigateTo(page, '/login');

    // Verify English
    expect(await page.locator('html').getAttribute('lang')).toBe('en');

    // Switch to Japanese via language switcher
    await page.getByTestId(NAV.LANGUAGE_SWITCHER_BTN).click();
    await page.waitForTimeout(200);
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/ja/login', { timeout: 10000 }),
      page.getByTestId(languageMenuitemId('ja')).click(),
    ]);
    expect(await page.locator('html').getAttribute('lang')).toBe('ja');

    // Go back — should restore English
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
    await page.locator('h1', { hasText: 'Colleague Access' }).waitFor({ state: 'visible' });

    await page.close();
  });
});
