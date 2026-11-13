/**
 * E2E Test Setup
 *
 * Loads jest-dom matchers for use with Playwright + Vitest.
 * Patches Playwright's chromium launch so every page automatically saves
 * Istanbul coverage from `window.__coverage__` before it closes.
 */
import { chromium, type Browser, type Page } from 'playwright';
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { saveBrowserCoverage } from './helpers';

expect.extend(matchers);

type LaunchMethod = typeof chromium.launch;
type LaunchResult = Awaited<ReturnType<LaunchMethod>>;

const originalLaunch = chromium.launch.bind(chromium);

async function saveAllPages(browser: Browser): Promise<void> {
  const contexts = browser.contexts();
  for (const context of contexts) {
    for (const page of context.pages()) {
      await saveBrowserCoverage(page);
    }
  }
}

function patchPageClose(page: Page): void {
  const originalClose = page.close.bind(page);
  page.close = async (...args: Parameters<Page['close']>) => {
    await saveBrowserCoverage(page);
    return originalClose(...args);
  };
}

function patchBrowser(browser: LaunchResult): LaunchResult {
  const originalNewPage = browser.newPage.bind(browser);
  browser.newPage = async (...args: Parameters<Browser['newPage']>) => {
    const page = await originalNewPage(...args);
    patchPageClose(page);
    return page;
  };

  const originalClose = browser.close.bind(browser);
  browser.close = async (...args: Parameters<Browser['close']>) => {
    await saveAllPages(browser);
    return originalClose(...args);
  };

  return browser;
}

chromium.launch = async (...args: Parameters<LaunchMethod>) => {
  const browser = await originalLaunch(...args);
  return patchBrowser(browser);
};
