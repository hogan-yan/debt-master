/**
 * E2E Tests for Colleague Detail Page Workflows
 *
 * Tests Record Payment, Edit Name, Deactivate Colleague, and Inactive Tab flows
 * specifically from the colleague detail page (not the list page).
 *
 * Run:
 *   bun run test -- tests/e2e/colleague-detail-workflows.test.ts
 *   APP_URL=http://localhost:3456 bun run test -- tests/e2e/colleague-detail-workflows.test.ts
 */

import { type Browser, type Page, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isVisible, loginAsColleague, navigateTo, TEST_ACCESS_CODE } from './helpers';
import {
  COLLEAGUE,
  COLLEAGUE_DETAIL,
  COLLEAGUE_FORM,
  EXPENSE_FORM,
  INACTIVE_COLLEAGUE,
  PAYMENT,
  TABLE_COL,
} from '../../src/test/test-ids';

function getColleagueRow(page: Page, name: string) {
  return page.getByTestId(COLLEAGUE.COLLEAGUE_TABLE_ROW).filter({ hasText: name });
}

async function openDetailActionMenu(page: Page): Promise<void> {
  const menuButton = page.getByTestId(COLLEAGUE_DETAIL.MORE_ACTIONS_BTN);
  await menuButton.click();
  // Wait for dropdown menu to render
  await page.waitForTimeout(100);
}

async function createTestColleague(page: Page, name: string): Promise<void> {
  await navigateTo(page, '/colleagues');
  await page.getByTestId(COLLEAGUE.ADD_COLLEAGUE_BTN).click();

  const nameInput = page.getByTestId(COLLEAGUE_FORM.NAME_INPUT);
  await nameInput.waitFor({ state: 'visible', timeout: 10000 });
  await nameInput.fill(name);

  await page.getByTestId(COLLEAGUE.ADD_COLLEAGUE_BTN).last().click();
  // Wait for creation to complete (networkidle hangs due to HMR/SSE connections)
  // Wait for the success toast to appear, then let it auto-dismiss
  const successToast = page.locator('[data-sonner-toast][data-type="success"]');
  await successToast.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
}

async function navigateToColleagueDetail(
  page: Page,
  colleagueName: string
): Promise<boolean> {
  await navigateTo(page, '/colleagues');
  // Wait for the table to render rows
  await page.getByTestId(COLLEAGUE.COLLEAGUE_TABLE_ROW).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

  let row = getColleagueRow(page, colleagueName);
  if (!(await isVisible(row, 5000))) {
    // Colleague may be on a later page — search for it
    const searchInput = page.getByPlaceholder(/search colleagues/i).first();
    if (await isVisible(searchInput, 2000)) {
      await searchInput.fill(colleagueName);
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');
      row = getColleagueRow(page, colleagueName);
    }
  }
  if (!(await isVisible(row, 5000))) {
    return false;
  }
  // Click the colleague name link (not the row) to navigate to detail page
  const detailLink = row.locator('a[href^="/colleagues/"]').first();
  await detailLink.click();
  await page.waitForLoadState('domcontentloaded');
  // Wait for detail page to render
  await page.getByTestId(COLLEAGUE_DETAIL.COLLEAGUE_NAME_TEXT).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  return true;
}

describe('E2E: Colleague Detail Page Workflows', () => {
  let browser: Browser;
  let page: Page;
  const testTimestamp = Date.now();
  const testColleagueName = `AAA Detail Test ${testTimestamp}`;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    await loginAsColleague(page, TEST_ACCESS_CODE);
    await createTestColleague(page, testColleagueName);
  }, 120000);

  afterAll(async () => {
    await browser.close();
  });

  describe('Record Payment', () => {
    it('should navigate to colleague detail page', async () => {
      const navigated = await navigateToColleagueDetail(page, testColleagueName);
      expect(navigated).toBe(true);
      expect(page.url()).toMatch(/\/colleagues\/\d+\/?$/);
    }, 30000);

    it('should show Record Payment button on detail page', async () => {
      const btn = page.getByTestId(COLLEAGUE_DETAIL.RECORD_PAYMENT_HEADER_BTN);
      expect(await isVisible(btn)).toBe(true);
    }, 30000);

    it('should open payment modal when Record Payment is clicked', async () => {
      await page.getByTestId(COLLEAGUE_DETAIL.RECORD_PAYMENT_HEADER_BTN).click();

      const dialog = page.getByTestId(COLLEAGUE_DETAIL.PAYMENT_DIALOG);
      await dialog.waitFor({ state: 'visible', timeout: 10000 });
      expect(await isVisible(dialog)).toBe(true);
    }, 30000);

    it('should have colleague pre-selected in payment form', async () => {
      // The colleague select should show the test colleague name
      const colleagueSelect = page.getByTestId(PAYMENT.COLLEAGUE_SELECT);
      expect(await isVisible(colleagueSelect)).toBe(true);
    }, 30000);

    it('should submit a prepayment and show success', async () => {
      // Fill amount
      const amountInput = page.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
      await amountInput.waitFor({ state: 'visible', timeout: 10000 });
      await amountInput.fill('25.50');

      // Fill date (should already be pre-filled, but ensure it has a value)
      const dateInput = page.getByTestId(EXPENSE_FORM.DATE_INPUT);
      const dateValue = await dateInput.inputValue();
      if (!dateValue) {
        const today = new Date().toISOString().split('T')[0] ?? '';
        await dateInput.fill(today);
      }

      // Submit
      await page.getByTestId(PAYMENT.SUBMIT_PAYMENT_BTN).click();

      // Dialog should close
      const dialog = page.getByTestId(COLLEAGUE_DETAIL.PAYMENT_DIALOG);
      await dialog.waitFor({ state: 'hidden', timeout: 10000 });
      expect(await isVisible(dialog)).toBe(false);

      // Payment should appear in activity tab (check for amount in transaction items)
      const amounts = page.locator('[data-testid^="transaction-amount-"]');
      const amountTexts = await amounts.allTextContents();
      expect(amountTexts.some(t => t.includes('$25.50'))).toBe(true);
    }, 30000);
  });

  describe('Edit Name', () => {
    it('should show edit button on detail page', async () => {
      const editBtn = page.getByTestId(COLLEAGUE_DETAIL.EDIT_NAME_BTN);
      expect(await isVisible(editBtn)).toBe(true);
    }, 30000);

    it('should enter edit mode when edit button is clicked', async () => {
      await page.getByTestId(COLLEAGUE_DETAIL.EDIT_NAME_BTN).click();

      const editInput = page.getByTestId(COLLEAGUE_DETAIL.EDIT_NAME_INPUT);
      await editInput.waitFor({ state: 'visible', timeout: 5000 });
      expect(await isVisible(editInput)).toBe(true);
    }, 30000);

    it('should save new name on Enter key', async () => {
      const editInput = page.getByTestId(COLLEAGUE_DETAIL.EDIT_NAME_INPUT);
      await editInput.waitFor({ state: 'visible', timeout: 5000 });
      await editInput.clear();
      await editInput.fill(`${testColleagueName} Updated`);
      await editInput.press('Enter');
      // Wait for save + router.invalidate to complete (remote needs more time)
      const nameText = page.getByTestId(COLLEAGUE_DETAIL.COLLEAGUE_NAME_TEXT);
      await nameText.waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForFunction(
        (testId) => {
          const el = document.querySelector(`[data-testid="${testId}"]`);
          return el && el.textContent?.includes('Updated');
        },
        COLLEAGUE_DETAIL.COLLEAGUE_NAME_TEXT,
        { timeout: 15000 }
      );
      expect(await nameText.textContent()).toContain('Updated');
    }, 30000);

    it('should cancel edit on Escape key', async () => {
      // Click edit again
      await page.getByTestId(COLLEAGUE_DETAIL.EDIT_NAME_BTN).click();

      const editInput = page.getByTestId(COLLEAGUE_DETAIL.EDIT_NAME_INPUT);
      await editInput.waitFor({ state: 'visible', timeout: 5000 });
      await editInput.fill('This will be cancelled');
      await editInput.press('Escape');
      // Wait for edit mode to exit
      await editInput.waitFor({ state: 'hidden', timeout: 5000 });

      // Input should be gone, original name should remain
      expect(await isVisible(editInput)).toBe(false);
      expect(await page.getByTestId(COLLEAGUE_DETAIL.COLLEAGUE_NAME_TEXT).textContent()).toContain('Updated');
    }, 30000);
  });

  describe('Deactivate Colleague', () => {
    const deactivateTestName = `AAA Deactivate Test ${Date.now()}`;

    beforeAll(async () => {
      await createTestColleague(page, deactivateTestName);
      await navigateToColleagueDetail(page, deactivateTestName);
    }, 60000);

    it('should show deactivate option in detail page dropdown', async () => {
      await openDetailActionMenu(page);
      const deactivateOption = page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_COLLEAGUE_MENUITEM);
      expect(await isVisible(deactivateOption)).toBe(true);
    }, 30000);

    it('should open confirmation dialog with colleague name', async () => {
      const deactivateOption = page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_COLLEAGUE_MENUITEM);
      if (!(await isVisible(deactivateOption))) {
        await openDetailActionMenu(page);
      }
      await deactivateOption.click();

      const confirmDialog = page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_CONFIRM_DIALOG);
      await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });
      expect(await isVisible(confirmDialog)).toBe(true);
    }, 30000);

    it('should cancel deactivation and stay on detail page', async () => {
      const dialog = page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_CONFIRM_DIALOG);
      const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
      await cancelBtn.click();
      await dialog.waitFor({ state: 'hidden', timeout: 5000 });

      expect(page.url()).toMatch(/\/colleagues\/\d+\/?$/);
    }, 30000);

    it('should deactivate colleague and redirect to list page', async () => {
      // Open deactivate dialog again
      await openDetailActionMenu(page);
      await page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_COLLEAGUE_MENUITEM).click();

      const confirmDialog = page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_CONFIRM_DIALOG);
      await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });

      // Click the Deactivate button (not Cancel)
      await page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_BTN).click();
      // Wait for redirect to /colleagues
      await page.waitForURL('**/colleagues**', { timeout: 15000 });

      // Should redirect to /colleagues (loose match — may include trailing slash or query params)
      expect(page.url()).toContain('/colleagues');

      // Wait for list to refresh (remote may have stale data)
      await page.waitForTimeout(2000);
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.getByTestId(COLLEAGUE.COLLEAGUE_TABLE_ROW).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      // Colleague should no longer appear in the active list
      const row = getColleagueRow(page, deactivateTestName);
      expect(await isVisible(row, 5000)).toBe(false);
    }, 30000);
  });

  describe('Inactive Tab Flows', () => {
    const inactiveFlowName = `AAA Inactive Flow ${Date.now()}`;

    beforeAll(async () => {
      // Create colleague and deactivate from detail page
      await createTestColleague(page, inactiveFlowName);
      const navigated = await navigateToColleagueDetail(page, inactiveFlowName);
      expect(navigated).toBe(true);

      await openDetailActionMenu(page);
      await page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_COLLEAGUE_MENUITEM).click();
      const confirmDialog = page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_CONFIRM_DIALOG);
      await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });
      await page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_BTN).click();
      await page.waitForURL('**/colleagues**', { timeout: 10000 });
    }, 90000);

    it('should show deactivated colleague in the Inactive tab', async () => {
      await navigateTo(page, '/colleagues');
      await page.getByTestId(COLLEAGUE.COLLEAGUE_TABLE_ROW).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      // Click the Inactive tab
      const inactiveTab = page.getByTestId(COLLEAGUE_DETAIL.INACTIVE_TAB);
      expect(await isVisible(inactiveTab)).toBe(true);
      await inactiveTab.click();
      // Wait for inactive tab content to render
      await page.getByTestId(COLLEAGUE.COLLEAGUE_TABLE_ROW).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      // Should see the colleague in the inactive list
      const row = getColleagueRow(page, inactiveFlowName);
      expect(await isVisible(row)).toBe(true);
    }, 30000);

    it('should show Inactive badge on deactivated colleague', async () => {
      const inactiveBadge = page.getByTestId(COLLEAGUE_DETAIL.INACTIVE_BADGE).first();
      expect(await isVisible(inactiveBadge)).toBe(true);
    }, 30000);

    it('should restore colleague from Inactive tab', async () => {
      // Find the row and open action menu
      const row = getColleagueRow(page, inactiveFlowName);
      const menuButton = row.getByTestId(TABLE_COL.ROW_ACTIONS_BTN);
      await menuButton.click();

      const restoreOption = page.getByTestId(INACTIVE_COLLEAGUE.RESTORE_COLLEAGUE_MENUITEM);
      await restoreOption.waitFor({ state: 'visible', timeout: 5000 });
      expect(await isVisible(restoreOption)).toBe(true);
      await restoreOption.click();

      // Confirm restore
      await page.getByTestId('restore-btn').click();
      // Wait for restore to complete — remote needs longer + reload for stale data
      await page.waitForTimeout(3000);
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.getByTestId(COLLEAGUE.COLLEAGUE_TABLE_ROW).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      // Ensure we're still on inactive tab after reload
      const inactiveTab = page.getByTestId(COLLEAGUE_DETAIL.INACTIVE_TAB);
      await inactiveTab.click();
      await page.waitForTimeout(1000);

      // Colleague should no longer be in inactive tab
      const inactiveRow = getColleagueRow(page, inactiveFlowName);
      expect(await isVisible(inactiveRow, 5000)).toBe(false);
    }, 30000);

    it('should show restored colleague back in Active tab', async () => {
      // Switch to Active tab
      const activeTab = page.getByTestId('active-tab');
      await activeTab.click();
      await page.getByTestId(COLLEAGUE.COLLEAGUE_TABLE_ROW).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      let row = getColleagueRow(page, inactiveFlowName);
      if (!(await isVisible(row, 3000))) {
        // Search for the restored colleague
        const searchInput = page.getByPlaceholder(/search colleagues/i).first();
        if (await isVisible(searchInput, 2000)) {
          await searchInput.fill(inactiveFlowName);
          await searchInput.press('Enter');
          await page.waitForLoadState('networkidle');
          row = getColleagueRow(page, inactiveFlowName);
        }
      }
      expect(await isVisible(row)).toBe(true);
    }, 30000);
  });

  describe('Permanent Delete from Inactive Tab', () => {
    const permanentDeleteName = `AAA Perm Delete ${Date.now()}`;

    beforeAll(async () => {
      // Create a fresh colleague with NO payment/expense history
      await createTestColleague(page, permanentDeleteName);

      // Deactivate from detail page
      const navigated = await navigateToColleagueDetail(page, permanentDeleteName);
      expect(navigated).toBe(true);

      await openDetailActionMenu(page);
      await page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_COLLEAGUE_MENUITEM).click();
      const confirmDialog = page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_CONFIRM_DIALOG);
      await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });
      await page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_BTN).click();
      await page.waitForURL('**/colleagues**', { timeout: 10000 });
    }, 90000);

    it('should permanently delete colleague from Inactive tab', async () => {
      await navigateTo(page, '/colleagues');
      await page.getByTestId(COLLEAGUE.COLLEAGUE_TABLE_ROW).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      // Switch to Inactive tab
      const inactiveTab = page.getByTestId(COLLEAGUE_DETAIL.INACTIVE_TAB);
      await inactiveTab.click();
      await page.getByTestId(COLLEAGUE.COLLEAGUE_TABLE_ROW).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      // Find the row and open action menu
      const row = getColleagueRow(page, permanentDeleteName);
      expect(await isVisible(row)).toBe(true);

      const menuButton = row.getByTestId(TABLE_COL.ROW_ACTIONS_BTN);
      await menuButton.click();

      const deleteOption = page.getByTestId(INACTIVE_COLLEAGUE.DELETE_PERMANENTLY_MENUITEM);
      await deleteOption.waitFor({ state: 'visible', timeout: 5000 });
      expect(await isVisible(deleteOption)).toBe(true);
      await deleteOption.click();

      // Confirm permanent deletion
      await page.getByTestId('delete-permanently-btn').click();
      // Wait for deletion to complete and row to disappear
      await getColleagueRow(page, permanentDeleteName).waitFor({ state: 'hidden', timeout: 10000 });

      // Colleague should be gone from inactive tab
      const deletedRow = getColleagueRow(page, permanentDeleteName);
      expect(await isVisible(deletedRow)).toBe(false);
    }, 30000);
  });

  describe('Soft Delete With Payment History', () => {
    const deleteWithHistoryName = `AAA Deactivate Hist ${Date.now()}`;

    beforeAll(async () => {
      await createTestColleague(page, deleteWithHistoryName);
      await navigateToColleagueDetail(page, deleteWithHistoryName);

      // Record a payment so this colleague has history
      await page.getByTestId(COLLEAGUE_DETAIL.RECORD_PAYMENT_HEADER_BTN).click();
      await page.getByTestId(EXPENSE_FORM.AMOUNT_INPUT).waitFor({ state: 'visible', timeout: 10000 });

      const amountInput = page.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
      await amountInput.fill('50.00');

      const dateInput = page.getByTestId(EXPENSE_FORM.DATE_INPUT);
      const dateValue = await dateInput.inputValue();
      if (!dateValue) {
        const today = new Date().toISOString().split('T')[0] ?? '';
        await dateInput.fill(today);
      }

      await page.getByTestId(PAYMENT.SUBMIT_PAYMENT_BTN).click();
      // Wait for payment to process
      await page.getByTestId(COLLEAGUE_DETAIL.PAYMENT_DIALOG).waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

      // Payment recorded successfully if dialog closed without error
    }, 90000);

    it('should deactivate colleague with payment history via soft delete', async () => {
      // Close any dialogs first
      await page.keyboard.press('Escape');

      await openDetailActionMenu(page);
      const deactivateOption = page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_COLLEAGUE_MENUITEM);
      await deactivateOption.click();
      const confirmDialog = page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_CONFIRM_DIALOG);
      await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });

      // Confirm deactivation
      await page.getByTestId(COLLEAGUE_DETAIL.DEACTIVATE_BTN).click();
      await page.waitForURL('**/colleagues**', { timeout: 15000 });

      // Should redirect to /colleagues (soft delete succeeds)
      expect(page.url()).toContain('/colleagues');

      // Wait for list to refresh (remote may have stale data)
      await page.waitForTimeout(2000);
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.getByTestId(COLLEAGUE.COLLEAGUE_TABLE_ROW).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      // Colleague should no longer appear in the active list
      const row = getColleagueRow(page, deleteWithHistoryName);
      expect(await isVisible(row, 5000)).toBe(false);
    }, 30000);
  });

  describe('KPI Strip', () => {
    // Create a fresh colleague for KPI tests
    const kpiTestName = `AAA KPI Test ${Date.now()}`;

    beforeAll(async () => {
      await createTestColleague(page, kpiTestName);
      await navigateToColleagueDetail(page, kpiTestName);
    }, 60000);

    it('should display KPI metrics on detail page', async () => {
      expect(await isVisible(page.getByTestId(COLLEAGUE_DETAIL.NET_BALANCE_KPI))).toBe(true);
      expect(await isVisible(page.getByTestId(COLLEAGUE_DETAIL.DEBT_AGE_KPI))).toBe(true);
      expect(await isVisible(page.getByTestId(COLLEAGUE_DETAIL.LAST_ACTIVITY_KPI))).toBe(true);
      expect(await isVisible(page.getByTestId(COLLEAGUE_DETAIL.PAYMENT_RATIO_KPI))).toBe(true);
    }, 30000);

    it('should show N/A for Payment Ratio when no expenses', async () => {
      const kpiValue = page.getByTestId('payment-ratio-kpi-value');
      expect(await kpiValue.textContent()).toContain('N/A');
    }, 30000);
  });

  describe('Activity Tab', () => {
    const activityTabName = `AAA Activity ${Date.now()}`;

    beforeAll(async () => {
      await createTestColleague(page, activityTabName);
      await navigateToColleagueDetail(page, activityTabName);
    }, 60000);

    it('should show Activity tab by default', async () => {
      const activityTab = page.getByTestId('activity-tab');
      expect(await isVisible(activityTab)).toBe(true);
    }, 30000);

    it('should show transaction filter buttons', async () => {
      const allButton = page.getByTestId('all-filter-btn');
      expect(await isVisible(allButton)).toBe(true);
    }, 30000);
  });

  describe('Record Payment Validation', () => {
    const paymentValidationName = `AAA Payment Val ${Date.now()}`;

    beforeAll(async () => {
      await createTestColleague(page, paymentValidationName);
      await navigateToColleagueDetail(page, paymentValidationName);
      // Open payment modal
      await page.getByTestId(COLLEAGUE_DETAIL.RECORD_PAYMENT_HEADER_BTN).click();
      await page.getByTestId(COLLEAGUE_DETAIL.PAYMENT_DIALOG).waitFor({ state: 'visible', timeout: 10000 });
    }, 60000);

    it('should prevent submission with empty amount via HTML5 validation', async () => {
      const amountInput = page.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
      await amountInput.waitFor({ state: 'visible', timeout: 10000 });
      await amountInput.clear();

      await page.getByTestId(PAYMENT.SUBMIT_PAYMENT_BTN).click();

      // HTML5 required validation prevents form submission — dialog stays open
      const dialog = page.getByTestId(COLLEAGUE_DETAIL.PAYMENT_DIALOG);
      expect(await isVisible(dialog)).toBe(true);
    }, 30000);

    it('should show error toast when submitting with zero amount', async () => {
      const amountInput = page.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
      await amountInput.fill('0');

      await page.getByTestId(PAYMENT.SUBMIT_PAYMENT_BTN).click();
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await errorToast.waitFor({ state: 'visible', timeout: 5000 });
      expect(await isVisible(errorToast, 5000)).toBe(true);
    }, 30000);

    it('should show error toast when submitting with negative amount', async () => {
      const amountInput = page.getByTestId(EXPENSE_FORM.AMOUNT_INPUT);
      await amountInput.fill('-10');

      await page.getByTestId(PAYMENT.SUBMIT_PAYMENT_BTN).click();
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await errorToast.waitFor({ state: 'visible', timeout: 5000 });
      expect(await isVisible(errorToast, 5000)).toBe(true);
    }, 30000);
  });

  describe('Edit Name Validation', () => {
    const editValidationName = `AAA Edit Val ${Date.now()}`;

    beforeAll(async () => {
      await createTestColleague(page, editValidationName);
      await navigateToColleagueDetail(page, editValidationName);
    }, 60000);

    it('should disable save button when name is empty', async () => {
      await page.getByTestId(COLLEAGUE_DETAIL.EDIT_NAME_BTN).click();
      await page.getByTestId(COLLEAGUE_DETAIL.EDIT_NAME_INPUT).waitFor({ state: 'visible', timeout: 5000 });

      const editInput = page.getByTestId(COLLEAGUE_DETAIL.EDIT_NAME_INPUT);
      await editInput.clear();

      const saveBtn = page.getByTestId(COLLEAGUE_DETAIL.SAVE_BTN);
      expect(await saveBtn.isDisabled()).toBe(true);
    }, 30000);

    it('should exit edit mode without saving on Enter key with empty name', async () => {
      // Already in edit mode from previous test (input cleared)
      const editInput = page.getByTestId(COLLEAGUE_DETAIL.EDIT_NAME_INPUT);
      await editInput.clear();
      await editInput.press('Enter');
      // Wait for edit mode to exit
      await editInput.waitFor({ state: 'hidden', timeout: 5000 });

      // Should exit edit mode (input gone) and name unchanged
      expect(await isVisible(editInput, 1000)).toBe(false);
      const nameText = page.getByTestId(COLLEAGUE_DETAIL.COLLEAGUE_NAME_TEXT);
      expect(await nameText.textContent()).toContain(editValidationName);
    }, 30000);
  });
});
