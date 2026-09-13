/**
 * Vite config for E2E coverage runs.
 * Istanbul instruments source code; coverage written to disk on server shutdown.
 * Usage: bun run test:e2e:coverage
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig, type Plugin } from 'vite';
import istanbul from 'vite-plugin-istanbul';
import { generateStaticLocalizedUrls } from './src/paraglide/runtime.js';

const COVERAGE_DIR = resolve('./coverage/e2e-server');

function writeCoverageOnExit(): void {
  const write = () => {
    const coverage = globalThis.__coverage__;
    if (coverage && Object.keys(coverage).length > 0) {
      mkdirSync(COVERAGE_DIR, { recursive: true });
      writeFileSync(
        resolve(COVERAGE_DIR, 'coverage-final.json'),
        JSON.stringify(coverage, null, 2)
      );
      console.log(`Coverage written to ${COVERAGE_DIR}/coverage-final.json`);
    }
  };
  process.on('exit', write);
  process.on('SIGTERM', () => {
    write();
    process.exit(0);
  });
  process.on('SIGINT', () => {
    write();
    process.exit(130);
  });
}

writeCoverageOnExit();

// Static routes to prerender (non-dynamic routes without $ params)
const staticRoutes = ['/', '/expenses', '/login', '/colleagues', '/payments', '/restaurants'];

const localizedUrls = generateStaticLocalizedUrls(staticRoutes);
const prerenderPages = localizedUrls.map((url: URL) => ({ path: url.pathname }));

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

function forceExitAfterBuild() {
  return {
    name: 'force-exit-after-build',
    enforce: 'post' as const,
    closeBundle() {
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
    exclude: ['@tanstack/start-server-core'],
    include: ['@tanstack/router-core', '@tanstack/router-core/ssr/client', 'seroval'],
  },
  plugins: [
    command === 'serve' &&
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
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
        enabled: true,
        crawlLinks: false,
        autoStaticPathsDiscovery: false,
        concurrency: 1,
      },
    }),
    forceExitAfterBuild(),
    istanbul({
      include: 'src/**',
      exclude: [
        'node_modules',
        'src/test/**',
        'src/paraglide/**',
        'src/**/*.test.*',
        'src/**/*.spec.*',
        'src/**/*.d.ts',
      ],
      extension: ['.ts', '.tsx'],
      requireEnv: false,
      checkProd: true,
    }),
  ].filter((plugin): plugin is Plugin => Boolean(plugin)),
}));
