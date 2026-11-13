import type { Register } from '@tanstack/react-router';
import type { RequestHandler } from '@tanstack/react-start/server';
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { paraglideMiddleware } from '@/paraglide/server';
import { infraConfig } from '@/server/infrastructure/config';
import { createLogger } from '@/server/infrastructure/logger';

// Request log: explicit 'info' min-level so SSR hits stay visible in
// production (the default prod level is 'warn') but as structured entries
// instead of a bare console.log.
const requestLogger = createLogger({ namespace: 'ssr', minLevel: 'info' });

const handler = createStartHandler(defaultStreamHandler);

export default {
  async fetch(...args: Parameters<RequestHandler<Register>>) {
    const request = args[0];
    const url = request.url;
    const pathname = new URL(url).pathname;

    // Skip well-known paths (Chrome DevTools, favicon, etc.) to avoid redirect loops
    if (pathname.startsWith('/.well-known/')) {
      return new Response(null, { status: 404 });
    }

    // Better Auth handler (DEBTCOM-2). Only mounted when the deploy selects the
    // better-auth provider; Authentik deploys never load the BA module. The
    // instance is dynamically imported so its deps (better-auth + prisma adapter)
    // are pulled in only on a BA deploy's first /api/auth/ request.
    if (pathname.startsWith('/api/auth/') && infraConfig.authProvider === 'better-auth') {
      const { getAuth } = await import('@/server/infrastructure/auth/better-auth-instance');
      return getAuth().handler(request);
    }

    // LocalFS file-serve route (DEBTCOM-4). Only the LocalFS adapter produces
    // `/api/storage/` URLs; under MinIO this branch is never hit. The handler
    // is dynamically imported so `node:fs` + the serve deps stay out of the
    // MinIO build path, and it short-circuits before SSR for a raw binary
    // Response (see localfs-serve.ts for the auth model).
    if (pathname.startsWith('/api/storage/')) {
      const { serveStoredObject } = await import('@/server/infrastructure/storage/localfs-serve');
      return serveStoredObject(request);
    }

    const response = await paraglideMiddleware(request, () => handler(request));
    requestLogger.info('ssr request', {
      method: request.method,
      path: pathname,
      status: response.status,
      location: response.headers.get('location') || undefined,
    });
    return response;
  },
};
