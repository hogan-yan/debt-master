/**
 * Server-only cookie auth utilities.
 * Separated from auth-server-utils.ts to avoid pulling
 * @tanstack/react-start/server into the client bundle.
 */

import { getAuthAdapter } from '@/server/infrastructure/auth';
import { isAccessCodeActive } from '@/server/infrastructure/auth/access-code-status';
import type { AuthUserIdentity } from '@/server/infrastructure/auth/auth-adapter';
import {
  getJwtExpirySeconds,
  refreshToken,
  type TokenPayload,
  verifyToken,
} from '@/server/infrastructure/auth/auth-server-utils';
import { AppError, ErrorCode } from '@/utils/errors';

/**
 * Set the auth cookie on the server response.
 */
export async function setAuthCookieServer(token: string): Promise<void> {
  // Server-only primitives (node:async_hooks) — lazy so the module never
  // enters the client bundle.
  const { setCookie } = await import('@tanstack/start-server-core');
  setCookie('debt-master-auth', token, {
    path: '/',
    sameSite: 'lax',
    maxAge: getJwtExpirySeconds(),
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  });
}

/**
 * Clear the auth cookie (logout). Setting an empty value with maxAge 0 is the
 * portable way to delete a cookie across hosts — equivalent to deleteCookie,
 * without depending on a (minifier-mangled) export.
 */
export async function deleteAuthCookieServer(): Promise<void> {
  const { setCookie } = await import('@tanstack/start-server-core');
  setCookie('debt-master-auth', '', {
    path: '/',
    sameSite: 'lax',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  });
}

function identityToPayload(identity: AuthUserIdentity): TokenPayload {
  return {
    isAdmin: identity.isAdmin,
    permissions: [...identity.permissions],
    username: identity.username ?? undefined,
    accessCodeId: identity.accessCodeId ?? undefined,
  };
}

/**
 * Read and verify the Authentik JWT cookie only — NO provider-adapter
 * fallthrough. This is the AuthentikAdapter's session lookup; routing it
 * through {@link getAuthFromCookie} recurses (adapter → cookie lookup →
 * adapter → …) and OOMs the server on the first unauthenticated request.
 * Works during SSR (loaders call server functions within request context)
 * and during client-side RPC calls (browser sends cookies automatically).
 */
export async function getJwtAuthFromCookie(): Promise<TokenPayload | null> {
  try {
    const { getCookie } = await import('@tanstack/start-server-core');
    const token = getCookie('debt-master-auth');
    if (token && typeof token === 'string' && token.length > 0) {
      const payload = await verifyToken(token);

      // Session revocation: a signature-valid token whose access code was
      // deactivated or soft-deleted must not keep authenticating (the refresh
      // below would otherwise re-sign it a fresh expiry — an immortal
      // session). Checked before the refresh so revoked cookies are never
      // extended. Cache-backed, so the common path adds no DB round-trip.
      if (payload.accessCodeId !== undefined && !(await isAccessCodeActive(payload.accessCodeId))) {
        return null;
      }

      const refreshedToken = await refreshToken(token);
      await setAuthCookieServer(refreshedToken);
      return payload;
    }
  } catch {
    // No usable JWT cookie.
  }
  return null;
}

/**
 * Read and verify JWT from the request cookie, refresh it, and set the refreshed cookie.
 * Falls through to the active provider adapter (e.g. Better Auth session) when
 * no Authentik JWT cookie is present.
 * Returns null if no valid session found — callers should return empty data.
 */
export async function getAuthFromCookie(): Promise<TokenPayload | null> {
  const jwtUser = await getJwtAuthFromCookie();
  if (jwtUser) return jwtUser;

  try {
    const adapter = await getAuthAdapter();
    const identity = await adapter.getCurrentUser();
    if (identity) return identityToPayload(identity);
  } catch {
    // No recognisable session.
  }

  return null;
}

/**
 * Read and verify JWT from the request cookie, refresh it, and set the refreshed cookie.
 * Throws if no valid token is found.
 * Use this for single-resource lookups that already throw on "not found".
 */
export async function requireAuthFromCookie(): Promise<TokenPayload> {
  const user = await getAuthFromCookie();
  if (!user) {
    throw new AppError(ErrorCode.AUTH_REQUIRED, 'Authentication required');
  }
  return user;
}

/**
 * Resolve the current user from the auth cookie and require admin role.
 * Server-side enforcement for admin-only server functions; reads the httpOnly
 * cookie directly so no token is ever sent from the client.
 */
export async function requireAdminFromCookie(): Promise<TokenPayload> {
  const user = await getAuthFromCookie();
  if (!user) {
    throw new AppError(ErrorCode.AUTH_REQUIRED, 'Authentication required');
  }
  if (!user.isAdmin) {
    throw new AppError(ErrorCode.AUTH_ADMIN_REQUIRED, 'Admin access required');
  }
  return user;
}
