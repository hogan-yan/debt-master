import { readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { serve } from 'bun';
// Import the TanStack Start server handler
// @ts-expect-error - Built output has no declaration file
import server from '../dist/server/ssr.js';
import { handleHealth } from './health';
import { captureError, captureFatalAndExit, initSentry } from './sentry';

// Requests larger than this are rejected before buffering (Bun enforces the
// cap while streaming the body). Headroom above the 20 MB upload limit so
// base64/multipart encoding overhead never trips it; override with
// MAX_BODY_SIZE_MB. Without a cap, a few concurrent large POSTs could OOM the pod.
const MAX_BODY_SIZE_MB = Number(process.env.MAX_BODY_SIZE_MB) || 64;
const MAX_BODY_SIZE_BYTES = MAX_BODY_SIZE_MB * 1024 * 1024;

// Sentry first, before anything can throw. Inert unless SENTRY_DSN is set
// (see sentry.ts).
initSentry();

// Boot-time environment gate — fail fast with a readable message instead of
// dying on first request with a stack trace from deep inside the app.
const isProduction = process.env.NODE_ENV === 'production';
const requiredEnv = ['DATABASE_URL'] as const;
const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length > 0) {
  process.stderr.write(`FATAL: missing required environment variables: ${missing.join(', ')}\n`);
  process.exit(1);
}
if (isProduction && !process.env.JWT_SECRET) {
  process.stderr.write('FATAL: JWT_SECRET is required in production.\n');
  process.exit(1);
}

// Global error handlers — crash-only model: report to Sentry (when wired),
// then exit so the orchestrator restarts a clean process
process.on('uncaughtException', (error) => {
  captureFatalAndExit(error);
});

process.on('unhandledRejection', (reason) => {
  captureFatalAndExit(reason);
});

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = './dist/client';

const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.webp': 'image/webp',
};

function getMimeType(path: string): string {
  return MIME_TYPES[extname(path)] || 'application/octet-stream';
}

function serveStaticFile(path: string): Response | null {
  try {
    // Security: prevent directory traversal
    if (path.includes('..')) {
      return null;
    }

    const fullPath = join(CLIENT_DIR, path);
    const stats = statSync(fullPath);

    if (!stats.isFile()) {
      return null;
    }

    const content = readFileSync(fullPath);
    const mimeType = getMimeType(fullPath);

    return new Response(content, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return null;
  }
}

const app = serve({
  port: Number(PORT),
  maxRequestBodySize: MAX_BODY_SIZE_BYTES,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Cheap liveness/readiness probe — answered before static/SSR so the
    // orchestrator gets a raw JSON response, never a page render.
    if (pathname === '/health' || pathname === '/healthz') {
      return handleHealth();
    }

    // Serve static files from /assets, /favicon.ico, /manifest.json, etc.
    if (
      pathname.startsWith('/assets/') ||
      pathname === '/favicon.ico' ||
      pathname === '/manifest.json' ||
      pathname.startsWith('/icon-')
    ) {
      const staticResponse = serveStaticFile(pathname);
      if (staticResponse) {
        return staticResponse;
      }
    }

    // Any other path that maps to a real file in dist/client (robots.txt,
    // sitemap.xml, og-image.png, llms.txt, …) is static too. Unknown paths
    // miss statSync and fall through to SSR.
    if (pathname !== '/' && extname(pathname) !== '') {
      const staticResponse = serveStaticFile(pathname);
      if (staticResponse) {
        return staticResponse;
      }
    }

    // Fall back to TanStack Start handler for everything else
    return server.fetch(request);
  },
  error(error) {
    // SSR/server-function throws land here (Bun catches fetch errors — they
    // never reach the process-level handlers above). Report, then keep Bun's
    // default 500 response shape.
    captureError(error);
    return new Response('Internal Server Error', { status: 500 });
  },
});

// Graceful shutdown — k8s rolling deploys send SIGTERM with a grace period;
// without this every deploy dropped in-flight requests. stop() (no argument)
// stops accepting new connections and waits for in-flight requests; the
// fallback timer guarantees exit if something hangs.
const SHUTDOWN_GRACE_MS = 15_000;
function shutdown(signal: string): void {
  process.stdout.write(`[server] ${signal} received — draining in-flight requests…\n`);
  app.stop();
  setTimeout(() => {
    process.stderr.write('[server] graceful shutdown timed out — forcing exit\n');
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
