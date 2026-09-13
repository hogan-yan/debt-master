/**
 * Quick Playwright debug script for redirect loops.
 * Run: npx tsx tests/e2e/debug-detail-pages.ts
 */

import { chromium } from 'playwright';
import { AUTH, NAV } from '../../src/test/test-ids';

const BASE_URL = 'http://localhost:3001';
const TEST_ACCESS_CODE = process.env.TEST_ADMIN_ACCESS_CODE || 'admin123';

async function testNoJs() {
  console.log('\n=== Test 1: JS disabled (SSR only) ===');
  const browser = await chromium.launch({ headless: true });

  for (const path of ['/login/', '/restaurants/', '/restaurants/39/', '/colleagues/29/']) {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    const responses: Array<{ url: string; status: number }> = [];
    page.on('response', (resp) => {
      responses.push({ url: new URL(resp.url()).pathname, status: resp.status() });
    });

    try {
      await page.goto(`${BASE_URL}${path}`, { timeout: 15000 });
      const status = responses.find((r) => r.url === path)?.status ?? 'not found';
      console.log(`  SSR ${path} → status=${status} finalUrl=${page.url()}`);
    } catch (err) {
      console.log(`  SSR ${path} → ERROR: ${(err as Error).message}`);
    }
    await ctx.close();
  }
  await browser.close();
}

async function testWithJs() {
  console.log('\n=== Test 2: JS enabled (full hydration) ===');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const redirects: string[] = [];
  page.on('request', (req) => {
    const redirectedFrom = req.redirectedFrom();
    if (req.isNavigationRequest() && redirectedFrom) {
      try {
        redirects.push(`${new URL(redirectedFrom.url()).pathname} → ${new URL(req.url()).pathname}`);
      } catch { /* ignore */ }
    }
  });

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const responses: Array<{ url: string; status: number }> = [];
  page.on('response', (resp) => {
    responses.push({ url: new URL(resp.url()).pathname, status: resp.status() });
  });

  // Test login page
  try {
    console.log('  Navigating to /login/ ...');
    await page.goto(`${BASE_URL}/login/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    console.log(`  Final URL: ${page.url()}`);
    console.log(`  Responses: ${responses.map((r) => `${r.url}=${r.status}`).join(', ')}`);
    console.log(`  Redirects (${redirects.length}): ${redirects.join(', ') || 'none'}`);
    console.log(`  Console errors: ${consoleErrors.length ? consoleErrors.join('; ') : 'none'}`);
    console.log(`  Page errors: ${pageErrors.length ? pageErrors.join('; ') : 'none'}`);
  } catch (err) {
    console.log(`  ERROR: ${(err as Error).message}`);
    console.log(`  Redirects (${redirects.length}): ${redirects.slice(0, 10).join(', ')}`);
    console.log(`  Responses: ${responses.map((r) => `${r.url}=${r.status}`).join(', ')}`);
  }

  await ctx.close();
  await browser.close();
}

async function testDetailPages() {
  console.log('\n=== Test 3: Detail pages with auth ===');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const redirects: string[] = [];
  page.on('request', (req) => {
    const redirectedFrom = req.redirectedFrom();
    if (req.isNavigationRequest() && redirectedFrom) {
      try {
        redirects.push(`${new URL(redirectedFrom.url()).pathname} → ${new URL(req.url()).pathname}`);
      } catch { /* ignore */ }
    }
  });

  // Login first
  try {
    await page.goto(`${BASE_URL}/login/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasForm = await page.getByTestId(AUTH.ACCESS_CODE_INPUT).isVisible().catch(() => false);
    if (!hasForm) {
      console.log('  Login form not visible, URL:', page.url());
      await page.screenshot({ path: '/tmp/debug-login.png', fullPage: true });
      await ctx.close();
      await browser.close();
      return;
    }

    await page.getByTestId(AUTH.ACCESS_CODE_INPUT).fill(TEST_ACCESS_CODE);
    await page.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log(`  Logged in. URL: ${page.url()}`);
  } catch (err) {
    console.log(`  Login failed: ${(err as Error).message}`);
    await ctx.close();
    await browser.close();
    return;
  }

  // Test detail pages
  for (const path of ['/restaurants/39/', '/colleagues/29/']) {
    redirects.length = 0;
    console.log(`\n  Testing ${path} ...`);
    try {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(5000);
      console.log(`    Final URL: ${page.url()}`);
      console.log(`    Redirects (${redirects.length}): ${redirects.slice(0, 10).join(', ') || 'none'}`);
      const text = await page.getByTestId(NAV.APP_ROOT).textContent();
      console.log(`    Body preview: ${text?.slice(0, 200)}`);
      await page.screenshot({ path: `/tmp/debug${path.replace(/\//g, '-')}.png`, fullPage: true });
    } catch (err) {
      console.log(`    ERROR: ${(err as Error).message}`);
      console.log(`    Redirects (${redirects.length}): ${redirects.slice(0, 10).join(', ')}`);
    }
  }

  await ctx.close();
  await browser.close();
}

async function main() {
  await testNoJs();
  await testWithJs();
  await testDetailPages();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
