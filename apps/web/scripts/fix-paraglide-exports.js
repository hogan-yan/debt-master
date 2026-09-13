import { globSync, readFileSync, writeFileSync } from 'node:fs';

const messagesDir = './src/paraglide/messages';

function fixFile(path) {
  let code = readFileSync(path, 'utf8');
  let changed = false;

  // Fix 1: string-named exports — Rolldown Linux bug
  // export { foo as "bar" } → export { foo as bar }
  const stringNamedMatches = code.match(/export\s*\{\s*\S+\s+as\s+"[^"]+"\s*\}/g);
  if (stringNamedMatches) {
    code = code.replace(/export\s*\{\s*(\S+)\s+as\s+"([^"]+)"\s*\}/g, 'export { $1 as $2 }');
    changed = true;
  }

  // Fix 2: export aliases break Rolldown namespace re-export analysis on Linux.
  // export { localVar as exportedName } → export const exportedName = localVar
  const aliasMatches = code.match(/export\s*\{\s*[a-zA-Z0-9_]+\s+as\s+[a-zA-Z0-9_]+\s*\}/g);
  if (aliasMatches) {
    code = code.replace(
      /export\s*\{\s*([a-zA-Z0-9_]+)\s+as\s+([a-zA-Z0-9_]+)\s*\}/g,
      'export const $2 = $1'
    );
    changed = true;
  }

  if (changed) {
    writeFileSync(path, code);
  }
  return changed;
}

try {
  const files = globSync(`${messagesDir}/*.js`);
  let totalFixed = 0;
  for (const file of files) {
    if (fixFile(file)) {
      totalFixed++;
    }
  }
  if (totalFixed > 0) {
    console.log(`[fix-paraglide] Fixed exports in ${totalFixed} file(s)`);
  }
} catch (err) {
  // biome-ignore lint/suspicious/noConsole: build script error output
  console.error('[fix-paraglide] Failed:', err.message);
  process.exit(1);
}
