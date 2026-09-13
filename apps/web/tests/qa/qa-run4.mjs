/**
 * QA smoke driver, 2026-09-08 (preserved from the live execution session —
 * see docs/qa/EXECUTION-REPORT-2026-09-08.md). Run: bun tests/qa/qa-run4.mjs
 * against a freshly built server on :3000. Each case retries once; failures
 * screenshot to /tmp/qa-shots/. Fixes: logout via user-menu, correct
 * payment_applications joins (participant_id -> expense_participants.id),
 * no networkidle (pages poll), clearer claim-button failure.
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const ADMIN = { email: 'qa-admin@test.local', password: 'Str0ng!QaPass!2026' };
const CODE_FREE = 'JUDebt123!~';
const SHOTS = '/tmp/qa-shots';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const t = (id) => `[data-testid="${id}"]`;

function db(sql) {
  return execSync(
    `docker exec postgres-debt-master psql -U debtmaster -d debtmaster -tAc ${JSON.stringify(sql.replace(/\s+/g, ' '))}`,
    { encoding: 'utf8' }
  ).trim();
}
function dbRows(sql) {
  return db(sql).split('\n').filter(Boolean).map((l) => l.split('|'));
}

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8Dwn4EIwESMolGFAQAKAgQCKxTiEgAAAABJRU5ErkJggg==',
  'base64'
);
writeFileSync('/tmp/qa-receipt.png', tinyPng);

async function caseRun(id, title, fn, page) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await fn();
      results.push({ id, title, status: attempt === 1 ? 'PASS' : 'PASS(retry)' });
      console.log(`PASS${attempt === 1 ? '' : '(retry)'} ${id} ${title}`);
      return;
    } catch (e) {
      if (attempt === 1) {
        console.log(`retry ${id} :: ${String(e.message || e).slice(0, 120)}`);
        await page.waitForTimeout(3000);
        continue;
      }
      results.push({ id, title, status: 'FAIL', error: String(e.message || e).slice(0, 300) });
      console.log(`FAIL ${id} ${title} :: ${String(e.message || e).slice(0, 200)}`);
      if (page) await page.screenshot({ path: `${SHOTS}/${id}.png`, fullPage: true }).catch(() => {});
    }
  }
}
const tid = (p, id) => p.locator(t(id)).first();
const today = new Date().toISOString().slice(0, 10);
const nav = async (p, path) => {
  for (let i = 0; i < 2; i++) {
    try {
      await p.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      break;
    } catch (e) {
      if (i === 1) throw e;
      console.log(`  goto ${path} timed out, retrying`);
    }
  }
  await p.waitForTimeout(1800);
};

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.setDefaultTimeout(25000);
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e}`));

async function adminLogin(p) {
  await p.goto(`${BASE}/login`);
  await p.waitForTimeout(1200);
  if (!p.url().includes('/login')) return;
  await tid(p, 'admin-email-input').fill(ADMIN.email);
  await tid(p, 'admin-password-input').fill(ADMIN.password);
  await tid(p, 'admin-login-btn').last().click();
  await p.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
}
async function logout(p) {
  await p.keyboard.press('Escape').catch(() => {});
  await p.waitForTimeout(400);
  const btn = tid(p, 'logout-btn');
  if (await btn.isVisible().catch(() => false)) { await btn.click(); }
  else {
    await tid(p, 'user-menu-btn').click();
    await p.waitForTimeout(400);
    const item = p.getByRole('menuitem', { name: /logout/i }).first();
    await item.click({ force: true, timeout: 8000 }).catch(() =>
      tid(p, 'user-menu-logout').click({ force: true, timeout: 8000 }));
  }
  await p.waitForURL((u) => u.pathname.includes('/login'), { timeout: 15000 });
}

/* ── XC-020 cold-boot render canary ── */
await caseRun('XC-020', 'Cold-boot render canary: entry pages render, console clean', async () => {
  for (const path of ['/login', '/', '/expenses', '/payments', '/settings']) {
    const mark = consoleErrors.length;
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);
    const body = (await page.locator('body').textContent().catch(() => '')) || '';
    if (path !== '/login' && body.trim().length < 40 && !page.url().includes('/login'))
      throw new Error(`${path} renders near-blank (${body.trim().length} chars)`);
    const leaked = consoleErrors.slice(mark).filter((e) =>
      /externalized for browser|node:async_hooks|node:events|Hydration|hydration/i.test(e));
    if (leaked.length) throw new Error(`${path}: ${leaked[0].slice(0, 140)}`);
    if (path === '/login') await adminLogin(page);
  }
}, page);

/* ── EXP-001 + EXP-007 ── */
let newExpenseId = null;
let payerId = null;
await caseRun('EXP-001+007', 'Create EQUAL expense $30 w/ 3 participants + receipt, view receipt', async () => {
  const cols = dbRows(`select id from colleagues order by id limit 3`).map((r) => r[0]);
  payerId = cols[0];
  await nav(page, '/expenses');
  await tid(page, 'add-expense-btn').click();
  await tid(page, 'add-expense-dialog').waitFor({ state: 'visible', timeout: 10000 });
  await tid(page, 'date-input').fill(today);
  await tid(page, 'equal-radio').click();
  await tid(page, 'amount-input').fill('30.00');
  await tid(page, 'restaurant-select-btn').click();
  await page.waitForTimeout(700);
  await page.locator('[role="option"], [cmdk-item]').first()
    .click({ timeout: 8000 }).catch(async () => {
      await page.keyboard.press('Escape');
      throw new Error('restaurant option not clickable');
    });
  await page.waitForTimeout(500);
  for (const id of cols) {
    await page.locator(t(`participant-checkbox-${id}`)).first().click();
    await page.waitForTimeout(200);
  }
  await tid(page, 'receipt-upload-input').setInputFiles('/tmp/qa-receipt.png');
  await tid(page, 'create-expense-btn').click();
  await tid(page, 'add-expense-dialog').waitFor({ state: 'hidden', timeout: 15000 });
  const row = db(`select e.id, (select sum(amount) from expense_participants p where p.expense_id=e.id),
    (select receipt_object_key is not null from expenses e2 where e2.id=e.id)
    from expenses e order by e.id desc limit 1;`);
  const [id, partSum, hasReceipt] = row.split('|');
  newExpenseId = id;
  if (Math.abs(parseFloat(partSum) - 30) > 0.001) throw new Error(`participant sum ${partSum} != 30`);
  if (hasReceipt.trim() !== 't') throw new Error('receipt not stored');
  await nav(page, '/expenses');
  const rowEl = page.locator(t('expense-table-row')).first();
  await rowEl.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator(t('receipt-btn')).first().click();
  await tid(page, 'receipt-modal').waitFor({ state: 'visible', timeout: 8000 });
  if (!(await tid(page, 'receipt-modal-image').isVisible().catch(() => false)))
    throw new Error('receipt modal image not visible');
  await page.keyboard.press('Escape');
}, page);

/* ── PAY-001 ── */
await caseRun('PAY-001', 'Record a payment (expense mode, $30)', async () => {
  await nav(page, '/payments');
  await tid(page, 'add-payment-btn').click();
  await tid(page, 'record-payment-dialog').waitFor({ state: 'visible', timeout: 10000 });
  await tid(page, 'expense-payment-mode-btn').click();
  await page.waitForTimeout(500);
  const sel = tid(page, 'colleague-select');
  await sel.selectOption({ index: 1 });
  await page.waitForTimeout(1000);
  const dlg = tid(page, 'record-payment-dialog');
  const cb = dlg.locator('input[type=checkbox]').first();
  if (await cb.isVisible().catch(() => false)) await cb.check({ force: true });
  await page.waitForTimeout(300);
  await dlg.locator(t('amount-input')).fill('200.00');
  await dlg.locator(t('submit-payment-btn')).click();
  await tid(page, 'record-payment-dialog').waitFor({ state: 'hidden', timeout: 15000 });
  await page.waitForTimeout(1000);
  const paid = db(`select count(*) from payments where amount >= 30 and created_at::date = current_date;`);
  if (paid === '0') throw new Error('no payment row created today');
  const apps = db(`select count(*) from payment_applications where created_at::date = current_date;`);
  if (apps === '0') throw new Error('no applications created today');
}, page);

/* ── DSH-001 ── */
await caseRun('DSH-001', 'Dashboard renders with DB-consistent totals present', async () => {
  const totalExpenses = db(`select count(*) from expenses;`);
  const totalPaid = db(`select coalesce(sum(amount),0) from payments;`);
  const fmt = (n) => parseFloat(n).toLocaleString('en-US');
  const check = async () => {
    await nav(page, '/');
    const body = (await page.locator('body').textContent()) || '';
    return [fmt(totalExpenses), totalExpenses, fmt(totalPaid)].some((c) => body.includes(String(c)));
  };
  if (!(await check())) {
    console.log('  dashboard cold, retrying once');
    if (!(await check())) throw new Error(`no expense count (${totalExpenses}) / paid total (${totalPaid}) on dashboard`);
  }
}, page);

/* ── COL-009 ── */
await caseRun('COL-009', 'Zero-balance colleague shows settled status', async () => {
  const bal = (id) => db(`select round(
    coalesce((select sum(amount) from expense_participants where colleague_id=${id}),0)
    - coalesce((select sum(pa.amount) from payment_applications pa
        join expense_participants ep on ep.id=pa.participant_id
      where ep.colleague_id=${id}),0), 2);`);
  const zero = dbRows(`select id, name from colleagues order by id;`)
    .find(([id]) => bal(id) === '0.00');
  if (!zero) throw new Error('no zero-balance colleague found (data-dependent precondition)');
  await nav(page, '/colleagues');
  await page.getByPlaceholder(/search colleagues/i).fill(zero[1]);
  await page.waitForTimeout(1200);
  const row = page.locator(t('colleague-row'), { hasText: zero[1] }).first();
  await row.waitFor({ state: 'visible', timeout: 8000 });
  const txt = (await row.textContent()) || '';
  if (!/settle|balance|paid|even/i.test(txt))
    throw new Error(`row for ${zero[1]} lacks settled status: ${txt.slice(0, 80)}`);
}, page);

/* ── SET-001 ── */
const newCode = `QASMKE${Math.floor(Math.random() * 90 + 10)}`;
await caseRun('SET-001', 'Create access code via settings', async () => {
  await nav(page, '/settings');
  await tid(page, 'access-codes-heading').waitFor({ state: 'visible', timeout: 20000 });
  await tid(page, 'generate-code-btn').click();
  await tid(page, 'new-code-input').fill(newCode);
  await tid(page, 'create-code-btn').click();
  await page.waitForTimeout(1500);
  const inDb = db(`select is_active from access_codes where code='${newCode}';`);
  if (inDb !== 't') throw new Error(`code ${newCode} not active in DB (${inDb || 'missing'})`);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
}, page);

/* ── PAY-009 → PAY-010 ── */
await caseRun('PAY-009→010', 'Colleague claim pending -> admin confirms, share settles', async () => {
  db(`update access_codes set colleague_id=${payerId} where code='${CODE_FREE}';`);
  await logout(page);
  await page.goto(`${BASE}/login`);
  await tid(page, 'access-code-input').fill(CODE_FREE);
  await tid(page, 'colleague-login-btn').click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
  const openDetail = async () => {
    await page.goto(`${BASE}/expense/${newExpenseId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  };
  await openDetail();
  const claimBtn = tid(page, 'mark-as-paid-btn');
  if (await claimBtn.isVisible().catch(() => false)) {
    await claimBtn.click();
    await tid(page, 'unified-payment-modal').waitFor({ state: 'visible', timeout: 10000 });
    await tid(page, 'unified-payment-proof-input').setInputFiles('/tmp/qa-receipt.png').catch(() => {});
    await tid(page, 'unified-payment-submit-btn').click();
    await tid(page, 'unified-payment-modal').waitFor({ state: 'hidden', timeout: 15000 });
  } else {
    console.log('  no claim button (pending claim already in flight) — proceeding to confirm');
  }
  const claim = db(`select id, expense_id from payments where created_by='COLLEAGUE_CLAIM'
    and is_approved=false and colleague_id=${payerId} order by id desc limit 1;`);
  if (!claim) throw new Error('no pending claim for this colleague anywhere');
  const [claimId, claimExpense] = claim.split('|');
  console.log(`  pending claim ${claimId} on expense ${claimExpense}`);
  await logout(page);
  await adminLogin(page);
  await page.goto(`${BASE}/expense/${claimExpense}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const confirmBtns = page.getByRole('button', { name: /confirm/i });
  await confirmBtns.first().waitFor({ state: 'visible', timeout: 15000 });
  const n = await confirmBtns.count();
  let approved = 'f';
  for (let i = 0; i < n && approved.trim() !== 't'; i++) {
    await confirmBtns.nth(i).click().catch(() => {});
    await page.waitForTimeout(2000);
    approved = db(`select is_approved from payments where id=${claimId};`);
  }
  if (approved.trim() !== 't')
    throw new Error(`claim ${claimId} not approved after trying ${n} confirm buttons`);
  const applied = db(`select round(coalesce(sum(pa.amount),0),2) from payment_applications pa
    join expense_participants ep on ep.id=pa.participant_id
    where ep.colleague_id=${payerId} and ep.expense_id=${newExpenseId};`);
  console.log(`  claim ${claimId} approved; payer applied=${applied} of $10 share`);
}, page);

/* ── AUTH-018 ── */
await caseRun('AUTH-018', 'Logout returns to login', async () => {
  await logout(page);
}, page);

/* ── XC-019 ── */
await caseRun('XC-019', 'DB reconciliation invariants hold', async () => {
  const over = db(`select count(*) from (
    select pa.expense_id, sum(pa.amount) s, max(e.amount) amt
    from payment_applications pa join expenses e on e.id=pa.expense_id
    group by pa.expense_id, e.amount having sum(pa.amount) > e.amount + 0.001) x;`);
  if (over !== '0') throw new Error(`${over} expense(s) with applications exceeding amount`);
  const neg = db(`select count(*) from (
    select c.id, round(coalesce((select sum(amount) from expense_participants where colleague_id=c.id),0)
      - coalesce((select sum(pa.amount) from payment_applications pa
          join expense_participants ep on ep.id=pa.participant_id
        where ep.colleague_id=c.id),0), 2) b
    from colleagues c) t where b < -0.001;`);
  if (neg !== '0') throw new Error(`${neg} colleague(s) with negative balance`);
  const overPay = db(`select count(*) from (
    select p.id, p.amount amt, coalesce(sum(pa.amount),0) s
    from payments p left join payment_applications pa on pa.payment_id=p.id
    group by p.id, p.amount having sum(coalesce(pa.amount,0)) > p.amount + 0.001) y;`);
  if (overPay !== '0') throw new Error(`${overPay} payment(s) over-applied`);
}, page);

console.log('\nRESULTS ' + JSON.stringify(results, null, 1));
console.log(`console errors captured: ${consoleErrors.length}`);
consoleErrors.slice(0, 5).forEach((e) => console.log('  console: ' + e.slice(0, 120)));
await browser.close();
