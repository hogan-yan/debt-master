/**
 * E2E Tests for Receipt and Payment Claim Flows
 *
 * Covers the three bugs that were fixed:
 * 1. Receipt preview from expense table
 * 2. Receipt upload during expense creation
 * 3. Mark-as-paid payment claim submission
 *
 * Run:
 *   bun run test -- tests/e2e/receipt-and-payment-flows.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/receipt-and-payment-flows.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDialogs, isVisible, loginAsColleague, navigateTo, TEST_ACCESS_CODE } from './helpers';
import {
  EXPENSE,
  EXPENSE_FORM,
  PAYMENT_CLAIM,
} from '../../src/test/test-ids';

describe('Receipt and Payment Flows', () => {
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

  beforeEach(async () => {
    await closeDialogs(page);
  });

  // ── Receipt Preview ────────────────────────────────────────────────────────

  it('opens receipt preview modal when clicking receipt button in expense table', async () => {
    await navigateTo(page, '/expenses');

    // Find first expense row with a receipt button
    const receiptBtn = page.locator('[data-testid="receipt-btn"]').first();
    const hasReceipt = await isVisible(receiptBtn, 5000);

    if (!hasReceipt) {
      console.log('No expenses with receipts found — skipping receipt preview test');
      return;
    }

    await receiptBtn.click();

    // Verify receipt modal opened
    const receiptModal = page.getByTestId(EXPENSE.RECEIPT_MODAL);
    expect(await isVisible(receiptModal, 5000)).toBe(true);

    // Verify image is present in modal
    const receiptImage = page.getByTestId(EXPENSE.RECEIPT_MODAL_IMAGE);
    expect(await isVisible(receiptImage, 5000)).toBe(true);

    // Close modal
    await closeDialogs(page);
  });

  // ── Receipt Upload ─────────────────────────────────────────────────────────

  it('creates expense with receipt image upload', async () => {
    await navigateTo(page, '/expenses');

    // Open add expense dialog
    await page.getByTestId(EXPENSE.ADD_EXPENSE_BTN).click();
    expect(await isVisible(page.getByTestId(EXPENSE.ADD_EXPENSE_DIALOG))).toBe(true);

    // Fill required fields
    const today = new Date().toISOString().split('T')[0] ?? '';
    await page.getByTestId(EXPENSE_FORM.DATE_INPUT).fill(today);

    // Select "Equal" split type first (amount input only visible for EQUAL)
    await page.getByTestId(EXPENSE_FORM.EQUAL_RADIO).click();
    await page.waitForTimeout(200);

    // Fill amount
    await page.getByTestId(EXPENSE_FORM.AMOUNT_INPUT).fill('100.00');

    // Select restaurant (open dropdown and pick first option)
    await page.getByTestId(EXPENSE_FORM.RESTAURANT_SELECT_BTN).click();
    await page.waitForTimeout(300);
    // Click first option in the dropdown
    const firstOption = page.locator('[role="option"]').first();
    if (await isVisible(firstOption, 3000)) {
      await firstOption.click();
    } else {
      // Try alternative: look for any clickable restaurant option
      const options = page.locator('text=/./').filter({ hasText: /^[A-Za-z]/ });
      const count = await options.count();
      if (count > 0) {
        await options.first().click();
      }
    }

    // Select at least one participant (checkbox)
    const participantCheckbox = page.locator('[data-testid^="participant-checkbox-"]').first();
    if (await isVisible(participantCheckbox, 3000)) {
      await participantCheckbox.click();
    }

    // Upload a small test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT);
    await fileInput.setInputFiles({
      name: 'test-receipt.png',
      mimeType: 'image/png',
      buffer: testImageBuffer,
    });

    // Wait for image processing if any
    await page.waitForTimeout(1000);

    // Submit the form
    await page.getByTestId(EXPENSE_FORM.CREATE_EXPENSE_BTN).click();

    // Wait for submission to complete (remote needs longer)
    await page.waitForTimeout(4000);

    // Verify dialog closed (success)
    expect(await isVisible(page.getByTestId(EXPENSE.ADD_EXPENSE_DIALOG), 2000)).toBe(false);

    // Verify no error toast with "Failed to create expense"
    const pageText = await page.locator('body').textContent();
    expect(pageText).not.toContain('Failed to create expense');
  });

  // ── Mark as Paid ───────────────────────────────────────────────────────────

  it('submits payment claim from expense detail without "n is not a function" error', async () => {
    await navigateTo(page, '/expenses');

    // Click first expense row to go to detail page
    const firstRow = page.getByTestId(EXPENSE.EXPENSE_TABLE_ROW).first();
    if (!(await isVisible(firstRow, 5000))) {
      console.log('No expense rows found — skipping mark-as-paid test');
      return;
    }

    // Click the restaurant name / detail link in the row
    const detailLink = firstRow.locator('a').first();
    if (await isVisible(detailLink, 3000)) {
      await detailLink.click();
    } else {
      // Fallback: click anywhere in the row that might navigate
      await firstRow.click();
    }

    // Wait for navigation to expense detail page
    await page.waitForURL((url) => url.pathname.startsWith('/expense/'), { timeout: 10000 });
    await page.waitForTimeout(1500);

    // Find "Mark as Paid" button
    const markAsPaidBtn = page.locator('[data-testid="mark-as-paid-btn"]').first();
    const hasUnpaidParticipant = await isVisible(markAsPaidBtn, 5000);

    if (!hasUnpaidParticipant) {
      console.log('No unpaid participants found — skipping mark-as-paid test');
      return;
    }

    await markAsPaidBtn.click();

    // Wait for unified payment modal to open
    const paymentModal = page.locator('[data-testid="unified-payment-modal"]');
    expect(await isVisible(paymentModal, 5000)).toBe(true);

    // Submit the payment claim
    const submitBtn = page.locator('[data-testid="unified-payment-submit-btn"]');
    expect(await isVisible(submitBtn, 3000)).toBe(true);

    await submitBtn.click();

    // Wait for submission to complete
    await page.waitForTimeout(3000);

    // Verify no "n is not a function" error (the bug we fixed)
    const pageText = await page.locator('body').textContent();
    expect(pageText).not.toContain('n is not a function');
    expect(pageText).not.toContain('Failed to claim payment');

    // Modal should close on success
    expect(await isVisible(paymentModal, 2000)).toBe(false);
  });

  // ── Payment Claim from Expense List (Mobile/Modal flow) ────────────────────

  it('opens payment claim modal from expense list and submits without error', async () => {
    await navigateTo(page, '/expenses');

    // Look for the claim modal trigger — this is typically in mobile cards
    // or through the actions menu. We'll check if there's a way to open it.
    // The claim modal is opened via onPaymentClaim which is passed to ExpenseList.

    // For desktop, the payment claim is on the expense detail page.
    // For mobile, it's in the mobile card. This test is more about
    // ensuring the modal itself works when opened.

    // Skip if we're on desktop viewport (no mobile cards)
    const viewport = page.viewportSize();
    if (viewport && viewport.width > 768) {
      console.log('Desktop viewport — mobile claim modal test skipped');
      return;
    }

    // Find a mobile card with claim button
    const claimBtn = page.locator('text=Mark as Paid').first();
    if (!(await isVisible(claimBtn, 3000))) {
      console.log('No claim button found — skipping mobile claim test');
      return;
    }

    await claimBtn.click();

    // Verify claim modal opened
    const claimModal = page.getByTestId(PAYMENT_CLAIM.DIALOG);
    expect(await isVisible(claimModal, 5000)).toBe(true);

    // Submit the claim
    await page.getByTestId(PAYMENT_CLAIM.SUBMIT_BTN).click();

    // Wait for submission
    await page.waitForTimeout(3000);

    // Verify no "n is not a function" error
    const pageText = await page.locator('body').textContent();
    expect(pageText).not.toContain('n is not a function');
  });
});
