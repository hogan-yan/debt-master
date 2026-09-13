// vite.config.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { generateStaticLocalizedUrls } from './src/paraglide/runtime.js';

// Static routes to prerender (non-dynamic routes without $ params)
const staticRoutes = ['/', '/expenses', '/login', '/colleagues', '/payments', '/restaurants'];

// Use paraglide's generateStaticLocalizedUrls to create all locale variants
// This automatically handles base locale (no prefix) and non-base locales (prefix)
const localizedUrls = generateStaticLocalizedUrls(staticRoutes);
const prerenderPages = localizedUrls.map((url: URL) => ({ path: url.pathname }));

// Work around Rolldown Linux bug with string-named exports in paraglide.
// Paraglide generates: export { foo as "bar" }
// Rolldown on Linux cannot inline namespace property accesses for string-named exports,
// so we rewrite them to regular exports after paraglide compiles.
function fixParaglideExports() {
  return {
    name: 'fix-paraglide-exports',
    enforce: 'post' as const,
    buildStart() {
      const path = './src/paraglide/messages/_index.js';
      try {
        const code = readFileSync(path, 'utf8');
        const fixed = code.replace(
          /export\s*\{\s*(\S+)\s+as\s+"([^"]+)"\s*\}/g,
          'export { $1 as $2 }'
        );
        if (fixed !== code) {
          writeFileSync(path, fixed);
          console.log('[fix-paraglide-exports] Rewrote string-named exports in', path);
        }
      } catch {
        // File may not exist if paraglide hasn't compiled yet
      }
    },
  };
}

// In dev, @tanstack/start-server-core's `router-manifest.js` statically imports the
// server-only virtual module `tanstack-start-injected-head-scripts:v`. The TanStack
// plugin only registers a resolver for that virtual in the SERVER environment
// (`applyToEnvironment: env.config.consumer === 'server'`). When a barrel import pulls
// `router-manifest.js` into the CLIENT environment's graph, Vite's import-analysis tries
// to resolve the virtual there and crashes:
//   "Failed to resolve import tanstack-start-injected-head-scripts:v ... Does the file exist?"
// The import is guarded by `process.env.TSS_DEV_SERVER === "true"` and never executes on
// the client, so resolving it to a no-op stub in non-server environments is safe — it only
// lets static analysis pass. The server environment is untouched and uses the real resolver.
function stubInjectedHeadScriptsOnClient() {
  const VIRTUAL_ID = 'tanstack-start-injected-head-scripts:v';
  const RESOLVED_ID = '\0tanstack-start-injected-head-scripts-client-stub';
  return {
    name: 'stub-injected-head-scripts-on-client',
    enforce: 'pre' as const,
    applyToEnvironment(environment: { config: { consumer: string } }) {
      return environment.config.consumer !== 'server';
    },
    resolveId(id: string): string | undefined {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id: string): string | undefined {
      return id === RESOLVED_ID ? 'export const injectedHeadScripts = undefined;' : undefined;
    },
  };
}

// Vite 8 + Rolldown can hang after build completes in containerized environments
// due to unreleased worker threads or event-loop handles.
function forceExitAfterBuild() {
  return {
    name: 'force-exit-after-build',
    enforce: 'post' as const,
    closeBundle() {
      // Give pending async cleanup a generous window — the SSR build can
      // take 10-15s in CI when the client build is slow, so 60s is a safe
      // upper bound that still prevents an indefinite hang.
      setTimeout(() => process.exit(0), 60000);
    },
  };
}

export default defineConfig(({ command }) => ({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    // start-server-core must stay unbundled so its `tanstack-start-*:v`
    // virtual imports resolve through the plugin rather than the optimizer.
    exclude: ['@tanstack/start-server-core'],
    // Pre-bundle these at boot. If left to lazy discovery they get optimized
    // on the first request, which triggers a dep-graph reload mid-flight and
    // breaks start-server-core's virtual import resolution
    // ("Failed to resolve import tanstack-start-injected-head-scripts:v").
    include: ['@tanstack/router-core', '@tanstack/router-core/ssr/client', 'seroval'],
  },
  plugins: [
    // Only use paraglide Vite plugin in dev — it recompiles and overwrites our fixes during build.
    // In production, paraglide is compiled via CLI before vite build (see package.json).
    // strategy MUST match the CLI's `--strategy url cookie baseLocale` flag: the plugin's
    // default omits `url`, which would make dev ignore /ja/-style localized URLs that
    // production (ssr.tsx + paraglideMiddleware) relies on.
    command === 'serve' &&
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
        strategy: ['url', 'cookie', 'baseLocale'],
      }),
    command === 'serve' && stubInjectedHeadScriptsOnClient(),
    tailwindcss(),
    fixParaglideExports(),
    tanstackStart({
      server: {
        entry: './ssr.tsx',
      },
      pages: prerenderPages,
      prerender: {
        enabled: false,
        crawlLinks: false,
        autoStaticPathsDiscovery: false,
        concurrency: 1,
      },
      // Build-time enforcement of the client/server boundary (BUG-001 guard):
      // server-only modules that reach the client graph fail the build instead
      // of shipping a runtime crash. The runtime canary in tests/e2e-pw
      // backstops this for the dev server.
      importProtection: {
        enabled: true,
      },
    }),
    react(),
    forceExitAfterBuild(),
  ].filter(Boolean),
}));
