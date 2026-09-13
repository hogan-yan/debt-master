/**
 * Admin two-factor (TOTP) management.
 *
 * Server wrappers around Better Auth's two-factor plugin. Both enable and
 * disable require the admin's current password as confirmation. All actions
 * are protected by `requireAdminFromCookie` and audit-logged.
 */
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { logAuditEvent } from '@/server/infrastructure/audit-log';
import { requireAdminFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { getAuth, isTwoFactorEnabled } from '@/server/infrastructure/auth/better-auth-instance';

const enableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

const disableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

const verifyTwoFactorSetupSchema = z.object({
  code: z.string().min(1, 'Verification code is required'),
});

function appName(): string {
  return process.env.PUBLIC_APP_NAME || 'Debt Master';
}

/**
 * Per-IP throttle for TOTP/password-guessable endpoints. better-auth's limiter
 * only covers its HTTP mount, so these server-fn callers need their own.
 */
async function checkTwoFactorRateLimit(action: string): Promise<void> {
  const { getClientIdentifier } = await import('@/server/infrastructure/auth/auth-rate-limit');
  const { RATE_LIMIT } = await import('@/server/infrastructure/auth/auth-server-utils');
  const { checkSharedRateLimit } = await import('@/server/infrastructure/auth/rate-limit-store');
  const result = await checkSharedRateLimit(
    `2fa_${action}:${await getClientIdentifier()}`,
    RATE_LIMIT.TWO_FACTOR
  );
  if (!result.allowed) {
    throw new Error('Too many attempts. Please try again later.');
  }
}

async function requestHeadersWithCookie(): Promise<Headers> {
  // getRequestHeader is server-only (node:async_hooks); lazy import keeps it
  // out of the client bundle.
  const { getRequestHeader } = await import('@tanstack/start-server-core');
  const headers = new Headers();
  const cookie = getRequestHeader('cookie');
  if (cookie) headers.set('cookie', cookie);
  return headers;
}

async function getCurrentBetterAuthUserId(): Promise<string | null> {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: await requestHeadersWithCookie() });
    if (
      session &&
      typeof session === 'object' &&
      'user' in session &&
      session.user &&
      typeof session.user === 'object' &&
      'id' in session.user &&
      typeof session.user.id === 'string'
    ) {
      return session.user.id;
    }
  } catch {
    // No active BA session.
  }
  return null;
}

export interface EnableTwoFactorResult {
  readonly success: true;
  readonly totpURI?: string;
  readonly backupCodes?: string[];
}

/**
 * Enable TOTP two-factor for the current admin.
 * Returns the TOTP URI and backup codes on success.
 */
export const enableTwoFactor = createServerFn({ method: 'POST' })
  .validator(enableTwoFactorSchema)
  .handler(async ({ data }): Promise<EnableTwoFactorResult> => {
    await requireAdminFromCookie();

    const auth = getAuth();
    const result = await auth.api.enableTwoFactor({
      headers: await requestHeadersWithCookie(),
      body: {
        password: data.password,
        issuer: appName(),
      },
    });

    const userId = await getCurrentBetterAuthUserId();
    if (userId) {
      await logAuditEvent({
        action: 'admin.2fa_enabled',
        userId,
        details: { source: 'security_panel' },
      });
    }

    return {
      success: true,
      totpURI: typeof result?.totpURI === 'string' ? result.totpURI : undefined,
      backupCodes: Array.isArray(result?.backupCodes) ? result.backupCodes : undefined,
    };
  });

export interface DisableTwoFactorResult {
  readonly success: true;
}

export interface VerifyTwoFactorSetupResult {
  readonly success: true;
}

/**
 * Verify the first TOTP code after enabling 2FA.
 * This finalizes the setup and marks two-factor authentication as active.
 */
export const verifyTwoFactorSetup = createServerFn({ method: 'POST' })
  .validator(verifyTwoFactorSetupSchema)
  .handler(async ({ data }): Promise<VerifyTwoFactorSetupResult> => {
    await requireAdminFromCookie();
    await checkTwoFactorRateLimit('verify_setup');

    const auth = getAuth();
    await auth.api.verifyTOTP({
      headers: await requestHeadersWithCookie(),
      body: { code: data.code },
    });

    const userId = await getCurrentBetterAuthUserId();
    if (userId) {
      await logAuditEvent({
        action: 'admin.2fa_enabled',
        userId,
        details: { source: 'security_panel', finalized: true },
      });
    }

    return { success: true };
  });

/**
 * Disable TOTP two-factor for the current admin.
 */
export const disableTwoFactor = createServerFn({ method: 'POST' })
  .validator(disableTwoFactorSchema)
  .handler(async ({ data }): Promise<DisableTwoFactorResult> => {
    await requireAdminFromCookie();
    await checkTwoFactorRateLimit('disable');

    const auth = getAuth();
    await auth.api.disableTwoFactor({
      headers: await requestHeadersWithCookie(),
      body: { password: data.password },
    });

    const userId = await getCurrentBetterAuthUserId();
    if (userId) {
      await logAuditEvent({
        action: 'admin.2fa_disabled',
        userId,
        details: { source: 'security_panel' },
      });
    }

    return { success: true };
  });

export interface GetTwoFactorStatusResult {
  readonly enabled: boolean;
}

/**
 * Return whether the current admin has TOTP two-factor enabled.
 * Throws if the two-factor plugin is not mounted, so the UI can render
 * the unavailable state instead of a broken enable button.
 */
export const getTwoFactorStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GetTwoFactorStatusResult> => {
    if (!isTwoFactorEnabled()) {
      throw new Error('Two-factor authentication is not enabled in this environment.');
    }

    await requireAdminFromCookie();

    const auth = getAuth();
    const session = await auth.api.getSession({ headers: await requestHeadersWithCookie() });
    const user =
      session && typeof session === 'object' && 'user' in session && session.user
        ? session.user
        : null;
    const enabled =
      user &&
      typeof user === 'object' &&
      'twoFactorEnabled' in user &&
      user.twoFactorEnabled === true;

    return { enabled: enabled === true };
  }
);
