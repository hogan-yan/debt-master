/**
 * Cookie-gated file-serve handler for the LocalFS storage backend (DEBTCOM-4).
 *
 * Mounted at the `/api/storage/` path by `src/ssr.tsx` and called directly with
 * the raw `Request` — there is no TanStack Start API-route primitive in this
 * version, and this entry runs BEFORE the request event (async-local-storage)
 * is established. Auth is therefore resolved straight off `request.headers`
 * rather than via the ALS-based `getAuthFromCookie()`, covering the same three
 * session paths it does:
 *   - `debt-master-auth` JWT cookie (Authentik admin + access-code colleague),
 *   - Better Auth session cookie (default `better-auth` admin provider).
 *
 * Access model: URL generation is per-resource authorized
 * (`src/server/utils/storage-authz.ts`) and every URL is HMAC-signed with an
 * expiry (`storage-signing.ts`). The serve route requires BOTH a valid session
 * AND a fresh signature, so a leaked or guessed path is useless on its own.
 */

import { verifyToken } from '@/server/infrastructure/auth/auth-server-utils';
import { detectMimeType } from '@/server/utils/file-validation';
import { infraConfig } from '../config';
import { readLocalFile } from './localfs-adapter';
import { verifyStorageSignature } from './storage-signing';

const STORAGE_PATH_PREFIX = '/api/storage/';

/** Extract a named cookie value from a raw `cookie` header. */
function readCookieValue(cookieHeader: string, name: string): string | null {
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return null;
}

/**
 * Resolve whether the request carries a valid session, without touching ALS.
 * Reuses the same verification primitives as `getAuthFromCookie` (JWT
 * `verifyToken` for the shared cookie; Better Auth `auth.api.getSession` for
 * BA sessions) — this is a read-only check and does NOT rotate the cookie.
 */
async function isAuthenticated(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const token = readCookieValue(cookieHeader, 'debt-master-auth');
  if (token && token.length > 0) {
    const payload = await verifyToken(token);
    if (payload) return true;
  }

  if (infraConfig.authProvider === 'better-auth') {
    const { getAuth } = await import('@/server/infrastructure/auth/better-auth-instance');
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (session) return true;
  }

  return false;
}

/**
 * Parse `/api/storage/<bucket>/<objectKey...>` into its parts. `objectKey`
 * may itself contain slashes (e.g. `receipts/<ts>-file.png`). Returns `null`
 * for a malformed/missing target.
 */
function parseStoragePath(pathname: string): { bucket: string; objectKey: string } | null {
  if (!pathname.startsWith(STORAGE_PATH_PREFIX)) return null;
  const rest = pathname.slice(STORAGE_PATH_PREFIX.length);
  const slashIdx = rest.indexOf('/');
  if (slashIdx <= 0) return null; // no bucket, or no object key after it
  const bucket = decodeURIComponent(rest.slice(0, slashIdx));
  const objectKey = decodeURIComponent(rest.slice(slashIdx + 1));
  if (bucket.length === 0 || objectKey.length === 0) return null;
  return { bucket, objectKey };
}

export const notFoundResponse = (): Response => new Response(null, { status: 404 });

/**
 * Serve a stored object. Only active under `STORAGE_PROVIDER=localfs`; under
 * `minio` the route is never generated and a stray hit 404s.
 */
export async function serveStoredObject(request: Request): Promise<Response> {
  if (infraConfig.storageProvider !== 'localfs') {
    return notFoundResponse();
  }

  const url = new URL(request.url);
  const target = parseStoragePath(url.pathname);
  if (!target) {
    return notFoundResponse();
  }

  // Session AND a fresh HMAC signature are both required: the session alone
  // would let any colleague enumerate keys and read every object.
  if (!(await isAuthenticated(request))) {
    return new Response(null, { status: 401 });
  }
  if (
    !verifyStorageSignature(
      target.bucket,
      target.objectKey,
      url.searchParams.get('expires'),
      url.searchParams.get('signature')
    )
  ) {
    return new Response(null, { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = await readLocalFile(target.bucket, target.objectKey);
  } catch {
    // resolveLocalPath traversal refusal OR a genuinely missing file.
    return notFoundResponse();
  }

  const contentType = detectMimeType(buffer) ?? 'application/octet-stream';
  // Copy into a Uint8Array<ArrayBuffer> — Buffer (Uint8Array<ArrayBufferLike>)
  // is not assignable to BodyInit under TS 5.7's typed-array generics.
  const body = new Uint8Array(buffer);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // Browser-only caching: files are auth-gated, so never let a shared
      // intermediary cache the bytes. Content is timestamp-keyed + immutable.
      'Cache-Control': 'private, max-age=86400',
      'Content-Length': String(buffer.length),
    },
  });
}
