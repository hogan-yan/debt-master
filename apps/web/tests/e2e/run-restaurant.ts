/**
 * E2E Tests — Restaurant Cuisine, Notes & Detail Page
 *
 * Standalone runner (same pattern as run-smoke.ts).
 * Tests the full flow:
 * 1. Restaurant list page shows cuisine column
 * 2. Add restaurant with cuisine and notes
 * 3. Verify cuisine badge appears
 * 4. Search by cuisine
 * 5. View restaurant navigates to detail page
 * 6. Detail page shows cuisine, notes, expenses
 * 7. Edit restaurant (inline on detail page)
 * 8. Delete restaurant
 *
 * Run:
 *   bun run tests/e2e/run-restaurant.ts
 *   APP_URL=http://localhost:3456 bun run tests/e2e/run-restaurant.ts
 */

import { type Page, chromium } from 'playwright';
import { openActionMenu, TEST_ACCESS_CODE } from './helpers';
import {
  AUTH,
  COMMON,
  NAV,
  RESTAURANT,
  RESTAURANT_DETAIL,
  RESTAURANT_FORM,
} from '../../src/test/test-ids';

const BASE_URL = process.env['APP_URL'] || 'http://localhost:3000';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ${GREEN}✓${RESET} ${name}`);
  } catch (err: unknown) {
    failed++;
    console.log(`  ${RED}✗${RESET} ${name}`);
    console.log(`    ${RED}${err instanceof Error ? err.message : String(err)}${RESET}`);
  }
}

async function navigateTo(page: Page, path: string) {
  const url = `${BASE_URL}${path}`;
  const current = page.url();
  if (current !== url) {
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  }
}

/** Wait for the restaurant table to have actual data rows (not just "No results"). */
async function waitForTableData(page: Page, timeout = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const rows = await page.getByTestId(RESTAURANT.RESTAURANT_TABLE_ROW).count();
    if (rows > 0) {
      const firstText = await page.getByTestId(RESTAURANT.RESTAURANT_TABLE_ROW).first().textContent();
      if (firstText && !firstText.includes('No results')) {
        return;
      }
    }
    await page.waitForTimeout(500);
  }
}

async function loginAsAdmin(page: Page) {
  await navigateTo(page, '/login');
  await page.getByTestId(AUTH.ACCESS_CODE_INPUT).fill(TEST_ACCESS_CODE);
  await page.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN).click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.getByTestId(NAV.DASHBOARD_LINK).waitFor({
    state: 'visible',
    timeout: 15000,
  });
}

async function closeDialogs(page: Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function isVisible(locator: ReturnType<Page['locator']>, timeout = 15000): Promise<boolean> {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

function getRestaurantRow(page: Page, name: string) {
  return page.getByTestId(RESTAURANT.RESTAURANT_TABLE_ROW).filter({ hasText: name });
}

(async () => {
  console.log(`\n${BOLD}E2E Restaurant Tests — Cuisine, Notes & Detail Page${RESET}`);
  console.log(`${GRAY}Running against ${BASE_URL}${RESET}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await loginAsAdmin(page);

  const testTimestamp = Date.now();
  const testRestaurantName = `AAA E2E Eatery ${testTimestamp}`;
  const testAddress = '123 Test Street, E2E City';
  const testCuisine = 'japanese';
  const testNotes = 'Great sushi and ramen. Cozy atmosphere.';

  // ── List Page ──
  console.log(`${BOLD}Restaurant List Page${RESET}`);

  await test('restaurants page shows management UI and Add button', async () => {
    await navigateTo(page, '/restaurants');
    await waitForTableData(page);
    if (!(await isVisible(page.getByTestId(RESTAURANT.MANAGEMENT_HEADING)))) {
      throw new Error('Restaurant Management heading not visible');
    }
    if (!(await isVisible(page.getByTestId(RESTAURANT.ADD_RESTAURANT_BTN)))) {
      throw new Error('Add Restaurant button not visible');
    }
    if (!(await isVisible(page.getByTestId(RESTAURANT.SEARCH_RESTAURANTS_INPUT)))) {
      throw new Error('Search textbox not visible');
    }
  });

  await test('restaurants table has a Cuisine column header', async () => {
    // Already on restaurants page
    if (!(await isVisible(page.getByTestId(RESTAURANT.CUISINE_COL)))) {
      throw new Error('Cuisine column header not found');
    }
  });

  await test('add restaurant dialog includes cuisine and notes fields', async () => {
    await page.getByTestId(RESTAURANT.ADD_RESTAURANT_BTN).click();
    await page.waitForTimeout(800);

    if (!(await isVisible(page.getByTestId(RESTAURANT.ADD_RESTAURANT_DIALOG)))) {
      throw new Error('Add Restaurant dialog did not open');
    }

    if (!(await isVisible(page.getByTestId(RESTAURANT_FORM.CUISINE_INPUT)))) {
      throw new Error('Cuisine input not found');
    }
    if (!(await isVisible(page.getByTestId(RESTAURANT_FORM.NOTES_INPUT)))) {
      throw new Error('Notes textarea not found');
    }

    await closeDialogs(page);
  });

  await test('can create a restaurant with cuisine and notes', async () => {
    // Re-open dialog (previous test closed it)
    await page.getByTestId(RESTAURANT.ADD_RESTAURANT_BTN).click();
    await page.waitForTimeout(800);

    await page.getByTestId(RESTAURANT_FORM.NAME_INPUT).fill(testRestaurantName);
    await page.waitForTimeout(200);
    await page.getByTestId(RESTAURANT_FORM.ADDRESS_INPUT).fill(testAddress);
    await page.waitForTimeout(200);
    await page.getByTestId(RESTAURANT_FORM.CUISINE_INPUT).selectOption(testCuisine);
    await page.waitForTimeout(200);
    await page.getByTestId(RESTAURANT_FORM.NOTES_INPUT).fill(testNotes);
    await page.waitForTimeout(200);

    // Submit via the button inside the dialog
    await page
      .getByTestId(RESTAURANT.ADD_RESTAURANT_DIALOG)
      .getByTestId(RESTAURANT.ADD_RESTAURANT_BTN)
      .click();
    await page.waitForTimeout(2000);

    const row = getRestaurantRow(page, testRestaurantName);
    if (!(await isVisible(row, 10000))) {
      throw new Error(`Restaurant "${testRestaurantName}" not found in table after creation`);
    }
  });

  // After creation, the row is visible from React state update.
  // No need to navigate — check badge on the current page.
  await test('shows the cuisine badge in the table row', async () => {
    const row = getRestaurantRow(page, testRestaurantName);
    if (!(await isVisible(row, 5000))) {
      throw new Error('Restaurant row not found');
    }

    const badge = row.getByTestId(RESTAURANT.CUISINE_BADGE);
    if (!(await isVisible(badge))) {
      throw new Error(`Cuisine badge "${testCuisine}" not found in row`);
    }
  });

  await test('search by cuisine finds the restaurant', async () => {
    // Use the search on the current page (triggers client-side fetch)
    const searchBox = page.getByTestId(RESTAURANT.SEARCH_RESTAURANTS_INPUT);
    await searchBox.fill(testCuisine);
    await page.getByTestId(COMMON.SEARCH_BTN).click();
    await page.waitForTimeout(1500);

    const row = getRestaurantRow(page, testRestaurantName);
    if (!(await isVisible(row, 5000))) {
      throw new Error(`Search for "${testCuisine}" did not find restaurant`);
    }

    // Clear search to show all restaurants again
    await searchBox.clear();
    await page.getByTestId(COMMON.SEARCH_BTN).click();
    await page.waitForTimeout(1500);
  });

  // ── Detail Page ──
  console.log(`\n${BOLD}Restaurant Detail Page${RESET}`);

  await test('view details navigates to the restaurant detail page', async () => {
    // We're on /restaurants with data visible. Find our row.
    const row = getRestaurantRow(page, testRestaurantName);
    if (!(await isVisible(row, 5000))) {
      throw new Error('Restaurant row not found');
    }

    await openActionMenu(page, row);
    await page.getByTestId(RESTAURANT.VIEW_DETAILS_MENUITEM).click();
    await page.waitForTimeout(3000);

    const url = page.url();
    if (!url.match(/\/restaurants\/\d+$/)) {
      throw new Error(`Expected /restaurants/:id URL, got ${url}`);
    }
    if (!(await isVisible(page.getByTestId(RESTAURANT.DETAILS_HEADING)))) {
      // Debug: check what's on the page
      const bodyText = await page.getByTestId(NAV.APP_ROOT).innerText();
      throw new Error(
        `Restaurant Details not visible. Page content: ${bodyText.substring(0, 200)}`
      );
    }
  });

  await test('detail page shows restaurant name, cuisine, address, and notes', async () => {
    if (!(await isVisible(page.getByTestId(RESTAURANT.RESTAURANT_NAME_TEXT)))) {
      throw new Error(`Restaurant name "${testRestaurantName}" not visible`);
    }
    if (!(await isVisible(page.getByTestId(RESTAURANT.RESTAURANT_ADDRESS_TEXT)))) {
      throw new Error(`Address "${testAddress}" not visible`);
    }
    if (!(await isVisible(page.getByTestId(RESTAURANT.CUISINE_BADGE)))) {
      throw new Error(`Cuisine "${testCuisine}" not visible`);
    }
    if (!(await isVisible(page.getByTestId(RESTAURANT.RESTAURANT_NOTES_TEXT)))) {
      throw new Error(`Notes "${testNotes}" not visible`);
    }
  });

  await test('detail page has back link to restaurants list', async () => {
    if (!(await isVisible(page.getByTestId(NAV.BACK_TO_RESTAURANTS_LINK)))) {
      throw new Error('Back to restaurants list link not found');
    }
  });

  await test('detail page shows summary cards', async () => {
    if (!(await isVisible(page.getByTestId(RESTAURANT_DETAIL.TOTAL_EXPENSES_KPI)))) {
      throw new Error('Total Expenses summary card not found');
    }
    if (!(await isVisible(page.getByTestId(RESTAURANT_DETAIL.TOTAL_AMOUNT_SPENT_KPI)))) {
      throw new Error('Total Amount Spent summary card not found');
    }
  });

  await test('detail page has Edit and Delete buttons for admin', async () => {
    if (!(await isVisible(page.getByTestId(RESTAURANT.EDIT_BTN)))) {
      throw new Error('Edit button not visible');
    }
    if (!(await isVisible(page.getByTestId(RESTAURANT.DELETE_BTN)))) {
      throw new Error('Delete button not visible');
    }
  });

  // ── Inline Edit ──
  console.log(`\n${BOLD}Inline Edit on Detail Page${RESET}`);

  await test('can edit restaurant name, cuisine, and notes inline', async () => {
    await page.getByTestId(RESTAURANT.EDIT_BTN).click();
    await page.waitForTimeout(500);

    const nameInput = page.getByTestId(RESTAURANT_DETAIL.DETAIL_RESTAURANT_NAME_INPUT);
    if (!(await isVisible(nameInput))) {
      throw new Error('Name input not visible after clicking Edit');
    }

    // Change name
    await nameInput.clear();
    await nameInput.fill(`${testRestaurantName} Updated`);
    await page.waitForTimeout(200);

    // Change cuisine
    const cuisineInput = page.getByTestId(RESTAURANT_DETAIL.DETAIL_CUISINE_INPUT);
    await cuisineInput.selectOption('korean');
    await page.waitForTimeout(200);

    // Change notes
    const notesInput = page.getByTestId(RESTAURANT_DETAIL.DETAIL_NOTES_INPUT);
    await notesInput.clear();
    await notesInput.fill('Updated notes: amazing Korean BBQ');
    await page.waitForTimeout(200);

    // Save
    await page.getByTestId(RESTAURANT.SAVE_CHANGES_BTN).click();
    await page.waitForTimeout(2000);

    // Verify updated values are displayed
    const nameText = await page.getByTestId(RESTAURANT.RESTAURANT_NAME_TEXT).textContent();
    if (!nameText?.includes('Updated')) {
      throw new Error('Updated restaurant name not visible after save');
    }
    const cuisineText = await page.getByTestId(RESTAURANT.CUISINE_BADGE).textContent();
    if (!cuisineText) {
      throw new Error('Cuisine badge not visible after save');
    }
    const notesText = await page.getByTestId(RESTAURANT.RESTAURANT_NOTES_TEXT).textContent();
    if (!notesText?.includes('Updated notes')) {
      throw new Error('Updated notes not visible after save');
    }
  });

  await test('can navigate back to restaurants list', async () => {
    await page.getByTestId(NAV.BACK_TO_RESTAURANTS_LINK).click();
    await page.waitForTimeout(1500);

    const url = page.url();
    if (!url.includes('/restaurants')) {
      throw new Error(`Expected /restaurants URL, got ${url}`);
    }
    if (!(await isVisible(page.getByTestId(RESTAURANT.MANAGEMENT_HEADING)))) {
      throw new Error('Restaurant Management heading not visible after navigating back');
    }
  });

  await test('edited cuisine is searchable from list page', async () => {
    // Use the search on the current page
    const searchBox = page.getByTestId(RESTAURANT.SEARCH_RESTAURANTS_INPUT);
    await searchBox.fill('korean');
    await page.getByTestId(COMMON.SEARCH_BTN).click();
    await page.waitForTimeout(1500);

    const row = getRestaurantRow(page, `${testRestaurantName} Updated`);
    if (!(await isVisible(row, 5000))) {
      throw new Error('Updated restaurant not found when searching for "Korean"');
    }

    // Clear search
    await searchBox.clear();
    await page.getByTestId(COMMON.SEARCH_BTN).click();
    await page.waitForTimeout(1500);
  });

  // ── Edit Modal on List Page ──
  console.log(`\n${BOLD}Edit Modal on List Page${RESET}`);

  await test('edit modal shows cuisine and notes with existing values', async () => {
    // We're on /restaurants. Search for the updated restaurant first.
    let row = getRestaurantRow(page, `${testRestaurantName} Updated`);
    if (!(await isVisible(row, 3000))) {
      // Try searching
      const searchBox = page.getByTestId(RESTAURANT.SEARCH_RESTAURANTS_INPUT);
      await searchBox.fill(testRestaurantName);
      await page.getByTestId(COMMON.SEARCH_BTN).click();
      await page.waitForTimeout(1500);
    }

    row = getRestaurantRow(page, `${testRestaurantName} Updated`);
    if (!(await isVisible(row, 5000))) {
      throw new Error('Updated restaurant row not found');
    }

    await openActionMenu(page, row);
    await page.getByTestId(RESTAURANT.EDIT_RESTAURANT_MENUITEM).click();
    await page.waitForTimeout(800);

    if (!(await isVisible(page.getByTestId(RESTAURANT.EDIT_RESTAURANT_DIALOG)))) {
      throw new Error('Edit Restaurant dialog did not open');
    }

    const cuisineValue = await page.getByTestId(RESTAURANT_FORM.CUISINE_INPUT).inputValue();
    if (cuisineValue !== 'korean') {
      throw new Error(`Expected cuisine "korean", got "${cuisineValue}"`);
    }

    const notesValue = await page.getByTestId(RESTAURANT_FORM.NOTES_INPUT).inputValue();
    if (notesValue !== 'Updated notes: amazing Korean BBQ') {
      throw new Error(`Expected notes "Updated notes: amazing Korean BBQ", got "${notesValue}"`);
    }

    await closeDialogs(page);
  });

  // ── Seeded Restaurant Detail ──
  console.log(`\n${BOLD}Seeded Restaurant Detail Page${RESET}`);

  await test('detail page for seeded restaurant shows recent expenses', async () => {
    // Navigate fresh for seeded data check
    await navigateTo(page, '/restaurants');
    await waitForTableData(page);

    const firstRow = page.getByTestId(RESTAURANT.RESTAURANT_TABLE_ROW).first();
    if (!(await isVisible(firstRow))) {
      throw new Error('No restaurant rows found in table');
    }

    await openActionMenu(page, firstRow);
    await page.getByTestId(RESTAURANT.VIEW_DETAILS_MENUITEM).click();
    await page.waitForTimeout(3000);

    const url = page.url();
    if (!url.match(/\/restaurants\/\d+$/)) {
      throw new Error(`Expected /restaurants/:id URL, got ${url}`);
    }

    if (!(await isVisible(page.getByTestId(RESTAURANT_DETAIL.RECENT_EXPENSES_HEADING)))) {
      throw new Error('Recent Expenses heading not found');
    }
  });

  // ── Cleanup ──
  console.log(`\n${BOLD}Cleanup${RESET}`);

  await test('delete the test restaurant from detail page', async () => {
    // Navigate to restaurants and find our test restaurant
    await navigateTo(page, '/restaurants');
    await waitForTableData(page);
    const searchBox = page.getByTestId(RESTAURANT.SEARCH_RESTAURANTS_INPUT);
    await searchBox.fill(testRestaurantName);
    await page.getByTestId(COMMON.SEARCH_BTN).click();
    await page.waitForTimeout(1500);

    const row = getRestaurantRow(page, `${testRestaurantName} Updated`);
    if (!(await isVisible(row, 5000))) {
      // Already deleted or not visible — skip gracefully
      console.log(`    ${GRAY}[skip] Test restaurant not found — may already be deleted${RESET}`);
      return;
    }

    await openActionMenu(page, row);
    await page.getByTestId(RESTAURANT.VIEW_DETAILS_MENUITEM).click();
    await page.waitForTimeout(3000);

    // Accept the browser confirm() dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByTestId(RESTAURANT.DELETE_BTN).click();
    await page.waitForTimeout(2000);

    const url = page.url();
    if (!url.includes('/restaurants')) {
      throw new Error(`Expected redirect to /restaurants, got ${url}`);
    }
  });

  await browser.close();

  // ── Summary ──
  console.log(`\n${'─'.repeat(40)}`);
  console.log(
    `  ${BOLD}Results:${RESET} ${GREEN}${passed} passed${RESET}, ${failed > 0 ? `${RED}${failed} failed${RESET}` : '0 failed'}`
  );
  console.log(`${'─'.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
})();
