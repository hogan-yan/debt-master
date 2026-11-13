/**
 * AuthentikAdapter — {@link AuthAdapter} backed by the existing Authentik OAuth
 * + httpOnly JWT-cookie infrastructure.
 *
 * The admin sign-in URL is built from {@link infraConfig} (mirroring the logic in
 * `getAuthentikAuthUrl`); identity resolution delegates to the cookie guards in
 * `auth-cookie.server.ts`, which read the `debt-master-auth` httpOnly cookie. No
 * behaviour change versus the pre-adapter code paths — this just wraps them behind
 * the {@link AuthAdapter} interface so `AUTH_PROVIDER=authentik` and
 * `AUTH_PROVIDER=better-auth` can be swapped freely.
 *
 * Not yet wired into the route handlers (follow-up after the adapter cleanup step);
 * the existing `getAuthentikAuthUrl` / cookie guards remain the live code paths.
 */
import { randomUUID } from 'node:crypto';

import {
  deleteAuthCookieServer,
  getJwtAuthFromCookie,
  requireAdminFromCookie,
  requireAuthFromCookie,
} from '@/server/infrastructure/auth/auth-cookie';
import type { TokenPayload } from '@/server/infrastructure/auth/auth-server-utils';

import { infraConfig } from '../config';
import type { AuthAdapter, AuthUserIdentity } from './auth-adapter';

function toIdentity(user: TokenPayload): AuthUserIdentity {
  return {
    isAdmin: user.isAdmin,
    username: user.username ?? null,
    accessCodeId: user.accessCodeId ?? null,
    permissions: user.permissions,
  };
}

export const authentikAdapter: AuthAdapter = {
  async getCurrentUser(): Promise<AuthUserIdentity | null> {
    // getJwtAuthFromCookie, NOT getAuthFromCookie: the generic lookup falls
    // back to this adapter, so calling it here would recurse infinitely on
    // every unauthenticated request (server OOM — see the 2026-09-07 prod
    // startup OOM).
    const user = await getJwtAuthFromCookie();
    return user ? toIdentity(user) : null;
  },

  async requireAuth(): Promise<AuthUserIdentity> {
    return toIdentity(await requireAuthFromCookie());
  },

  async requireAdmin(): Promise<AuthUserIdentity> {
    return toIdentity(await requireAdminFromCookie());
  },

  async signInUrl(_redirectTo: string): Promise<string> {
    const { authentik } = infraConfig;
    const params = new URLSearchParams({
      client_id: authentik.clientId,
      response_type: 'code',
      scope: authentik.scope,
      redirect_uri: authentik.redirectUri,
      state: randomUUID(),
    });
    return `${authentik.baseUrl}/application/o/authorize/?${params.toString()}`;
  },

  async signOut(): Promise<void> {
    deleteAuthCookieServer();
  },
};
