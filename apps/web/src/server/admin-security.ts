/**
 * Admin self-service security functions.
 *
 * These handlers only apply to the Better Auth admin login path. They let an
 * admin change their password, list active sessions, and revoke a session.
 * All operations are protected by `requireAdminFromCookie` and logged.
 */

import { createHash } from 'node:crypto';
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { logAuditEvent } from '@/server/infrastructure/audit-log';
import { requireAdminFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { getAuth } from '@/server/infrastructure/auth/better-auth-instance';
import { validatePassword } from '@/utils/password-policy';

const changeAdminPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required'),
});

const revokeAdminSessionSchema = z.object({
  // SHA-256 hex of the session token — never the token itself. A Better Auth
  // session token is a bearer credential and must not cross the app boundary
  // in either direction; the hash is the client's non-secret revocation handle.
  sessionTokenHash: z.string().regex(/^[0-9a-f]{64}$/, 'Invalid session handle'),
});

/**
 * Per-IP throttle for password-guessable admin endpoints that call
 * `auth.api.*` directly (bypassing better-auth's HTTP-mount limiter). Mirrors
 * `checkTwoFactorRateLimit` in `two-factor.ts`.
 */
async function checkPasswordChangeRateLimit(): Promise<void> {
  const { getClientIdentifier } = await import('@/server/infrastructure/auth/auth-rate-limit');
  const { RATE_LIMIT } = await import('@/server/infrastructure/auth/auth-server-utils');
  const { checkSharedRateLimit } = await import('@/server/infrastructure/auth/rate-limit-store');
  const result = await checkSharedRateLimit(
    `password_change:${await getClientIdentifier()}`,
    RATE_LIMIT.TWO_FACTOR
  );
  if (!result.allowed) {
    throw new Error('Too many attempts. Please try again later.');
  }
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function requestHeadersWithCookie(): Promise<Headers> {
  const headers = new Headers();
  const { getRequestHeader } = await import('@tanstack/start-server-core');
  const cookie = getRequestHeader('cookie');
  if (cookie) headers.set('cookie', cookie);
  return headers;
}

export interface ChangeAdminPasswordResult {
  readonly success: true;
}

/**
 * Change the current admin's password. Verifies the current password, updates
 * it, and logs the event. The current session stays valid so the admin is not
 * signed out unexpectedly.
 */
export const changeAdminPassword = createServerFn({ method: 'POST' })
  .validator(changeAdminPasswordSchema)
  .handler(async ({ data }): Promise<ChangeAdminPasswordResult> => {
    const admin = await requireAdminFromCookie();
    await checkPasswordChangeRateLimit();

    const passwordValidation = validatePassword(data.newPassword);
    if (!passwordValidation.valid) {
      throw new Error(
        `Password does not meet the policy: ${passwordValidation.errors.join(', ')}.`
      );
    }

    const auth = getAuth();
    await auth.api.changePassword({
      headers: await requestHeadersWithCookie(),
      body: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: false,
      },
    });

    await logAuditEvent({
      action: 'admin.password_changed',
      userId: admin.username ?? 'unknown',
      details: { source: 'security_panel' },
    });

    return { success: true };
  });

export interface AdminSession {
  /**
   * SHA-256 of the session token — a revocation handle only. The raw token is
   * a bearer credential and never leaves the server.
   */
  readonly tokenHash: string;
  readonly id: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly isCurrent: boolean;
}

export interface GetAdminSessionsResult {
  readonly sessions: readonly AdminSession[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function extractCurrentToken(session: unknown): string | undefined {
  if (!isRecord(session)) return undefined;
  const inner = isRecord(session.session) ? session.session : session;
  const token = inner.token;
  return typeof token === 'string' ? token : undefined;
}

function parseSessionList(sessions: unknown, currentToken: string | undefined): AdminSession[] {
  if (!Array.isArray(sessions)) return [];
  return sessions
    .map((session): AdminSession | null => {
      if (!session || typeof session !== 'object') return null;
      const s = session as Record<string, unknown>;
      if (typeof s.token !== 'string' || s.token.length === 0) return null;
      return {
        tokenHash: hashSessionToken(s.token),
        id: typeof s.id === 'string' ? s.id : '',
        userAgent: typeof s.userAgent === 'string' ? s.userAgent : null,
        ipAddress: typeof s.ipAddress === 'string' ? s.ipAddress : null,
        createdAt:
          s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt ?? ''),
        expiresAt:
          s.expiresAt instanceof Date ? s.expiresAt.toISOString() : String(s.expiresAt ?? ''),
        isCurrent: s.token === currentToken,
      };
    })
    .filter((s): s is AdminSession => s !== null);
}

/**
 * List active Better Auth sessions for the current admin. The current session is
 * identified by calling {@link auth.api.getSession} so the UI can label it
 * correctly regardless of the order returned by {@link auth.api.listSessions}.
 */
export const getAdminSessions = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GetAdminSessionsResult> => {
    await requireAdminFromCookie();
    const headers = await requestHeadersWithCookie();
    const auth = getAuth();
    const [sessions, currentSession] = await Promise.all([
      auth.api.listSessions({ headers }),
      auth.api.getSession({ headers }),
    ]);
    return { sessions: parseSessionList(sessions, extractCurrentToken(currentSession)) };
  }
);

export interface RevokeAdminSessionResult {
  readonly success: true;
}

/**
 * Revoke a single Better Auth session by its token hash. The raw token never
 * crosses the boundary: the server lists the admin's sessions, resolves the
 * hash to the matching token, and revokes with it.
 */
export const revokeAdminSession = createServerFn({ method: 'POST' })
  .validator(revokeAdminSessionSchema)
  .handler(async ({ data }): Promise<RevokeAdminSessionResult> => {
    const admin = await requireAdminFromCookie();

    const headers = await requestHeadersWithCookie();
    const auth = getAuth();
    const sessions = await auth.api.listSessions({ headers });
    const target = sessions.find(
      (s) => typeof s.token === 'string' && hashSessionToken(s.token) === data.sessionTokenHash
    );
    if (!target || target.token.length === 0) {
      throw new Error('Session not found');
    }

    await auth.api.revokeSession({ headers, body: { token: target.token } });

    await logAuditEvent({
      action: 'admin.session_revoked',
      userId: admin.username ?? 'unknown',
      details: { sessionTokenHash: data.sessionTokenHash },
    });

    return { success: true };
  });
