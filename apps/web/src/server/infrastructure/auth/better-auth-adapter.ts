/**
 * Better Auth adapter (DEBTCOM-2).
 *
 * Implements {@link AuthAdapter} against the Better Auth instance. The current
 * session is resolved from the request context's Cookie header (read via
 * TanStack Start's async-local-storage `getRequestHeader`) — there is no
 * `request` parameter, matching the rest of the app and the {@link AuthAdapter}
 * contract.
 *
 * Every Better Auth user is treated as a full admin: Better Auth is the
 * admin-login mechanism for self-hosters. Colleague access-code login stays on
 * the separate `debt-master-auth` JWT cookie and is orthogonal to this adapter.
 */

import { AppError, ErrorCode } from '@/utils/errors';

import type { AuthAdapter, AuthUserIdentity } from './auth-adapter';
import { getAuth } from './better-auth-instance';

/** True when `v` is a non-null record (narrowing helper, no casts). */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Extract the user view from a Better Auth `getSession` result.
 * `auth.api.getSession` returns `{ session: { user } } | null`; this also
 * tolerates a top-level `user` defensively.
 */
function extractUser(session: unknown): { email?: string; name?: string } | null {
  if (!isRecord(session)) return null;
  // Better Auth returns { session, user } — the user object is at the top level.
  const topLevelUser = isRecord(session.user) ? session.user : null;
  if (topLevelUser) {
    return {
      email: typeof topLevelUser.email === 'string' ? topLevelUser.email : undefined,
      name: typeof topLevelUser.name === 'string' ? topLevelUser.name : undefined,
    };
  }
  // Defensive fallback for older/nested shapes.
  const inner = isRecord(session.session) ? session.session : session;
  const nestedUser = isRecord(inner) && isRecord(inner.user) ? inner.user : null;
  if (!nestedUser) return null;
  return {
    email: typeof nestedUser.email === 'string' ? nestedUser.email : undefined,
    name: typeof nestedUser.name === 'string' ? nestedUser.name : undefined,
  };
}

/** Map a Better Auth user to the app's non-sensitive identity view. */
function toIdentity(session: unknown): AuthUserIdentity | null {
  const user = extractUser(session);
  if (!user) return null;
  return {
    isAdmin: true,
    username: user.email ?? user.name ?? null,
    accessCodeId: null,
    permissions: ['view', 'create', 'edit', 'delete'],
  };
}

/**
 * Build Headers carrying the inbound Cookie header from the current request
 * context. Better Auth's server-side API reads the session cookie from here.
 */
async function requestHeadersWithCookie(): Promise<Headers> {
  const headers = new Headers();
  const { getRequestHeader } = await import('@tanstack/start-server-core');
  const cookie = getRequestHeader('cookie');
  if (cookie) headers.set('cookie', cookie);
  return headers;
}

/**
 * Better Auth session cookie names. Must match Better Auth's own convention:
 * `${cookiePrefix}.session_token[.cookie-cache]` with the `__Secure-` prefix
 * when `useSecureCookies` (production). Centralised so a config change touches
 * one place. The prefix mirrors `advanced.useSecureCookies` in the instance.
 */
function betterAuthCookieNames(): readonly string[] {
  const prefix = process.env.NODE_ENV === 'production' ? '__Secure-' : '';
  return [`${prefix}better-auth.session_token`, `${prefix}better-auth.session_token.cookie-cache`];
}

async function resolveIdentity(): Promise<AuthUserIdentity | null> {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await requestHeadersWithCookie() });
  return toIdentity(session);
}

export const betterAuthAdapter: AuthAdapter = {
  async getCurrentUser(): Promise<AuthUserIdentity | null> {
    return resolveIdentity();
  },

  async requireAuth(): Promise<AuthUserIdentity> {
    const identity = await resolveIdentity();
    if (!identity) {
      throw new AppError(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }
    return identity;
  },

  async requireAdmin(): Promise<AuthUserIdentity> {
    const identity = await resolveIdentity();
    if (!identity) {
      throw new AppError(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }
    // Better Auth users are always admins — identity.isAdmin is already true.
    return identity;
  },

  /**
   * Better Auth uses email/password, not an OAuth redirect. Send the browser to
   * the app login page (which renders the email/password form in BA mode); the
   * `redirect` query param preserves deep-linking.
   */
  async signInUrl(redirectTo: string): Promise<string> {
    const target = redirectTo || '/';
    return `/login?redirect=${encodeURIComponent(target)}`;
  },

  async signOut(): Promise<void> {
    // Revoke the DB session (no-op if already gone). Better Auth's programmatic
    // signOut does not propagate its Set-Cookie to this response, so the cookies
    // are cleared below via TanStack's cookie API — same pattern as the JWT path.
    try {
      const auth = getAuth();
      await auth.api.signOut({ headers: await requestHeadersWithCookie() });
    } catch {
      // Session may already be revoked; still clear the cookies below.
    }
    for (const name of betterAuthCookieNames()) {
      const { deleteCookie } = await import('@tanstack/start-server-core');
      deleteCookie(name, { path: '/' });
    }
  },
};
