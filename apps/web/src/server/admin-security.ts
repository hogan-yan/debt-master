/**
 * Admin self-service security functions.
 *
 * These handlers only apply to the Better Auth admin login path. They let an
 * admin change their password, list active sessions, and revoke a session.
 * All operations are protected by `requireAdminFromCookie` and logged.
 */

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
  sessionToken: z.string().min(1, 'Session token is required'),
});

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
  readonly token: string;
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
      return {
        token: typeof s.token === 'string' ? s.token : '',
        id: typeof s.id === 'string' ? s.id : '',
        userAgent: typeof s.userAgent === 'string' ? s.userAgent : null,
        ipAddress: typeof s.ipAddress === 'string' ? s.ipAddress : null,
        createdAt:
          s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt ?? ''),
        expiresAt:
          s.expiresAt instanceof Date ? s.expiresAt.toISOString() : String(s.expiresAt ?? ''),
        isCurrent: typeof s.token === 'string' && s.token === currentToken,
      };
    })
    .filter((s): s is AdminSession => s !== null && s.token.length > 0);
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
 * Revoke a single Better Auth session by its token.
 */
export const revokeAdminSession = createServerFn({ method: 'POST' })
  .validator(revokeAdminSessionSchema)
  .handler(async ({ data }): Promise<RevokeAdminSessionResult> => {
    const admin = await requireAdminFromCookie();

    const auth = getAuth();
    await auth.api.revokeSession({
      headers: await requestHeadersWithCookie(),
      body: { token: data.sessionToken },
    });

    await logAuditEvent({
      action: 'admin.session_revoked',
      userId: admin.username ?? 'unknown',
      details: { sessionToken: data.sessionToken },
    });

    return { success: true };
  });
