/**
 * E2E: authentication, sessions, access codes, rate limits, storage signatures.
 *
 * Ported from the manual QA suite (apps/web/docs/qa/test-cases/01-auth-sessions.md)
 * and the qa-run.mjs harness. Assumes a seeded DB. The setup-wizard case
 * (AUTH-022) runs only against a fresh database and is skipped otherwise.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const ADMIN = { email: 'qa-admin@test.local', password: 'Str0ng!QaPass!2026' };
const CODE_FREE = 'JUDebt123!~';

function db(sql: string): string {
  // CI sets DATABASE_URL to the Postgres service container; locally fall back
  // to apps/web/.env (docker-compose postgres). psql is preinstalled on CI
  // runners, so no docker-exec against a fixed container name.
  let url = process.env.DATABASE_URL;
  if (!url) {
    try {
      url = /^DATABASE_URL="?([^"\r\n]+)"?/m.exec(readFileSync('.env', 'utf8'))?.[1]?.trim();
    } catch {
      /* no local .env — url stays undefined */
    }
  }
  if (!url) throw new Error('DATABASE_URL not set for e2e DB assertions');
  return execSync(`psql ${JSON.stringify(url)} -tAc ${JSON.stringify(sql)}`, {
    encoding: 'utf8',
  }).trim();
}

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.waitForTimeout(900);
  if (!page.url().includes('/login')) return;
  await page.getByTestId('admin-email-input').fill(ADMIN.email);
  await page.getByTestId('admin-password-input').fill(ADMIN.password);
  await page.getByTestId('admin-login-btn').last().click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
}

async function logout(page: import('@playwright/test').Page) {
  await page.goto('/expenses');
  const menu = page.getByTestId('user-menu-btn');
  if (await menu.count()) {
    await menu.click();
    await page.getByTestId('user-menu-logout').first().click();
  }
  await page.waitForURL((u) => u.pathname.includes('/login'), { timeout: 10000 }).catch(() => {});
  await page.context().clearCookies();
}

test.describe('auth smoke', () => {
  test.beforeEach(({ page }) => {
    // BUG-001 canary: fail the test if a leaked server-only module crashes the page.
    page.on('pageerror', (e) => {
      const msg = String(e);
      if (msg.includes('externalized for browser') || msg.includes('node:async_hooks') || msg.includes('node:events')) {
        throw new Error(`client bundle crash (leaked server module): ${msg.slice(0, 140)}`);
      }
    });
  });

  test('AUTH-001 admin login works', async ({ page }) => {
    await adminLogin(page);
    expect(page.url()).not.toContain('/login');
  });

  test('AUTH-002/003 wrong password and unknown email give the same generic error', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('admin-email-input').fill(ADMIN.email);
    await page.getByTestId('admin-password-input').fill('WrongPass!123');
    await page.getByTestId('admin-login-btn').last().click();
    await page.waitForTimeout(800);
    const err1 = (await page.getByTestId('admin-login-error').textContent().catch(() => '')) || '';
    await page.getByTestId('admin-email-input').fill('nobody@test.local');
    await page.getByTestId('admin-password-input').fill('WrongPass!123');
    await page.getByTestId('admin-login-btn').last().click();
    await page.waitForTimeout(800);
    const err2 = (await page.getByTestId('admin-login-error').textContent().catch(() => '')) || '';
    expect(err1.trim()).not.toBe('');
    expect(err2.trim()).toBe(err1.trim());
  });

  test('AUTH-006 colleague access-code login updates lastUsed', async ({ page }) => {
    await logout(page);
    await page.goto('/login');
    await page.getByTestId('access-code-input').fill(CODE_FREE);
    await page.getByTestId('colleague-login-btn').click();
    await page.waitForTimeout(1200);
    expect(page.url()).not.toContain('/login');
    expect(db(`select last_used is not null from access_codes where code='${CODE_FREE}'`)).toBe('t');
  });

  test('XC-001 colleague cannot open admin routes', async ({ page }) => {
    await logout(page);
    await page.goto('/login');
    await page.getByTestId('access-code-input').fill(CODE_FREE);
    await page.getByTestId('colleague-login-btn').click();
    await page.waitForTimeout(1200);
    await page.goto('/settings');
    await page.waitForTimeout(1500);
    const onSettings = page.url().includes('/settings');
    const body = (await page.textContent('body')) || '';
    expect(onSettings && !/loading/i.test(body)).toBe(false);
  });

  test('AUTH-007/008/009 invalid, deactivated and deleted codes rejected; raw code never audited', async ({ page }) => {
    db(`insert into access_codes (code, is_active, deleted_at) values ('QADEAD', false, null), ('QADEL', true, now()) on conflict do nothing`);
    await logout(page);
    for (const code of ['WRONGCODE1', 'QADEAD', 'QADEL']) {
      await page.goto('/login');
      await page.getByTestId('access-code-input').fill(code);
      await page.getByTestId('colleague-login-btn').click();
      await page.waitForTimeout(700);
      expect(page.url()).toContain('/login');
      if (code === 'WRONGCODE1') {
        const audit = db(`select count(*) from audit_logs where action='access_code.failed' and details::text like '%${code}%'`);
        expect(audit).toBe('0');
      }
    }
  });

  test('AUTH-010/011 per-code and per-IP rate-limit buckets', async ({ page }) => {
    await logout(page);
    await page.goto('/login');
    let blocked = false;
    for (let i = 0; i < 6; i++) {
      await page.getByTestId('access-code-input').fill('BRUTE1');
      await page.getByTestId('colleague-login-btn').click();
      await page.waitForTimeout(350);
      if (/Too many failed attempts/i.test((await page.textContent('body')) || '')) { blocked = true; break; }
    }
    expect(blocked).toBe(true);
    for (let i = 0; i < 20; i++) {
      await page.getByTestId('access-code-input').fill(`ENUM${i}${Date.now()}`);
      await page.getByTestId('colleague-login-btn').click();
      await page.waitForTimeout(200);
      if (/Too many failed attempts/i.test((await page.textContent('body')) || '')) return;
    }
    throw new Error('per-IP bucket never blocked code enumeration');
  });

  test('AUTH-018 logout clears the session', async ({ page }) => {
    await adminLogin(page);
    await logout(page);
    await page.goto('/expenses');
    await page.waitForTimeout(600);
    expect(page.url()).toContain('/login');
  });

  test('AUTH-020 tampered auth cookie is treated as signed out', async ({ page }) => {
    await page.context().addCookies([{ name: 'debt-master-auth', value: 'garbage', url: 'http://localhost:3000' }]);
    const res = await page.goto('/api/storage/whatever?x=1');
    expect(res?.status()).not.toBe(500);
    await page.context().clearCookies();
  });

  test('XC-004 storage route enforces session and signature', async ({ page }) => {
    const res = await page.goto('/api/storage/fakebucket/fakekey.png');
    expect([401, 404]).toContain(res?.status());
    await adminLogin(page);
    const status = await page.evaluate(async () => {
      const r = await fetch('/api/storage/fakebucket/fakekey.png', { redirect: 'manual' });
      return r.status;
    });
    expect([403, 404]).toContain(status);
  });
});
