/**
 * Merge Istanbul coverage from unit tests, Vitest E2E, and server-side E2E.
 * Uses istanbul-lib-coverage (hoisted via @vitest/coverage-v8).
 *
 * Usage: bun run scripts/merge-coverage.ts
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// istanbul packages are hoisted via @vitest/coverage-v8
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const SOURCES = [
  './coverage/coverage-final.json',
  './coverage/e2e-vitest/coverage-final.json',
  './coverage/e2e-server/coverage-final.json',
];

const BROWSER_COVERAGE_DIR = './coverage/e2e-browser';
const OUTPUT_DIR = './coverage/merged';

function loadCoverage(filePath: string): Record<string, unknown> | null {
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    console.log(`  Skipping ${filePath} (not found)`);
    return null;
  }
  console.log(`  Loading ${filePath}`);
  return JSON.parse(readFileSync(resolved, 'utf-8'));
}

function loadBrowserCoverage(): Record<string, unknown>[] {
  const dir = resolve(BROWSER_COVERAGE_DIR);
  if (!existsSync(dir)) {
    console.log(`  Skipping ${BROWSER_COVERAGE_DIR} (not found)`);
    return [];
  }

  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
  if (files.length === 0) {
    console.log(`  No browser coverage files in ${BROWSER_COVERAGE_DIR}`);
    return [];
  }

  console.log(`  Loading ${files.length} browser coverage file(s) from ${BROWSER_COVERAGE_DIR}`);
  return files.map((file) => JSON.parse(readFileSync(resolve(dir, file), 'utf-8')));
}

console.log('Merging coverage reports...\n');

const map = libCoverage.createCoverageMap({});

for (const source of SOURCES) {
  const cov = loadCoverage(source);
  if (cov) {
    map.merge(cov as never);
  }
}

for (const cov of loadBrowserCoverage()) {
  map.merge(cov as never);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const context = libReport.createContext({
  coverageMap: map,
  dir: OUTPUT_DIR,
});

reports.create('json').execute(context);
reports.create('html').execute(context);
reports.create('text').execute(context);

console.log(`\nMerged coverage written to ${OUTPUT_DIR}/`);
