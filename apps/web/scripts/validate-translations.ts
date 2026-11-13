/**
 * Translation Coverage Validator
 *
 * Ensures all message files have the same keys across all locales.
 * Exits with code 1 if any locale is missing keys or has extra keys.
 *
 * Usage: bun run scripts/validate-translations.ts
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MESSAGES_DIR = './messages';
const SETTINGS_PATH = './project.inlang/settings.json';

interface InlangSettings {
  locales: string[];
  baseLocale: string;
}

function getConfiguredLocales(): Set<string> {
  const settings: InlangSettings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
  return new Set(settings.locales);
}

interface MessageFile {
  locale: string;
  keys: Set<string>;
}

function loadMessageFiles(): MessageFile[] {
  const configuredLocales = getConfiguredLocales();
  const files = readdirSync(MESSAGES_DIR)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => configuredLocales.has(f.replace('.json', '')));
  return files.map((file) => {
    const content = JSON.parse(readFileSync(join(MESSAGES_DIR, file), 'utf-8'));
    const keys = new Set(Object.keys(content).filter((k) => !k.startsWith('$')));
    return {
      locale: file.replace('.json', ''),
      keys,
    };
  });
}

function validateTranslations(files: MessageFile[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const baseLocale = files[0];

  if (!baseLocale) {
    return { valid: false, errors: ['No message files found'] };
  }

  for (const file of files.slice(1)) {
    const missing = [...baseLocale.keys].filter((k) => !file.keys.has(k));
    const extra = [...file.keys].filter((k) => !baseLocale.keys.has(k));

    if (missing.length > 0) {
      errors.push(
        `[${file.locale}] Missing ${missing.length} key(s) compared to ${baseLocale.locale}:`
      );
      for (const key of missing) {
        errors.push(`  - ${key}`);
      }
    }

    if (extra.length > 0) {
      errors.push(`[${file.locale}] Has ${extra.length} extra key(s) not in ${baseLocale.locale}:`);
      for (const key of extra) {
        errors.push(`  - ${key}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function main(): void {
  const files = loadMessageFiles();
  console.log(`Checking translation coverage across ${files.length} locale(s)...\n`);

  const { valid, errors } = validateTranslations(files);

  if (valid) {
    console.log('All translations are in sync.');
    for (const file of files) {
      console.log(`  ${file.locale}: ${file.keys.size} keys`);
    }
    process.exit(0);
  }
  for (const _error of errors) {
  }
  process.exit(1);
}

main();
