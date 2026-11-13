/**
 * Password reset server functions.
 *
 * Thin wrappers around Better Auth's `requestPasswordReset` and `resetPassword`
 * endpoints. They add audit logging and a shared password-policy check on the
 * reset step so users cannot reset to a weak password.
 */
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { logAuditEvent } from '@/server/infrastructure/audit-log';
import { validatePassword } from '@/utils/password-policy';

const sendPasswordResetEmailSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(1, 'Password is required'),
});

export interface SendPasswordResetEmailResult {
  readonly success: true;
}

/**
 * Request a password reset email. Always returns a generic success message so
 * the endpoint does not leak whether an account exists.
 */
export const sendPasswordResetEmail = createServerFn({ method: 'POST' })
  .validator(sendPasswordResetEmailSchema)
  .handler(async ({ data }): Promise<SendPasswordResetEmailResult> => {
    // better-auth's limiter only covers its HTTP mount; server-fn callers
    // bypass it, so throttle here (per IP, anti email-bombing).
    const { getClientIdentifier } = await import('@/server/infrastructure/auth/auth-rate-limit');
    const { RATE_LIMIT } = await import('@/server/infrastructure/auth/auth-server-utils');
    const { checkSharedRateLimit } = await import('@/server/infrastructure/auth/rate-limit-store');
    const rateLimitResult = await checkSharedRateLimit(
      `pwd_reset:${await getClientIdentifier()}`,
      RATE_LIMIT.PASSWORD_RESET
    );
    if (!rateLimitResult.allowed) {
      // Same generic response as the success path: never leak throttling
      // (or account existence) to the requester; the block is audit-visible.
      await logAuditEvent({
        action: 'admin.password_reset_requested',
        userId: data.email,
        details: { reason: 'rate_limited' },
      });
      return { success: true };
    }

    try {
      const { getAuth } = await import('@/server/infrastructure/auth/better-auth-instance');
      const auth = getAuth();
      await auth.api.requestPasswordReset({
        body: { email: data.email },
      });
    } catch {
      // Swallow errors to prevent account enumeration.
    }

    await logAuditEvent({
      action: 'admin.password_reset_requested',
      userId: data.email,
    });

    return { success: true };
  });

export interface ResetPasswordResult {
  readonly success: true;
}

/**
 * Reset an admin password with a valid token. Enforces the shared password
 * policy before calling Better Auth.
 */
export const resetPassword = createServerFn({ method: 'POST' })
  .validator(resetPasswordSchema)
  .handler(async ({ data }): Promise<ResetPasswordResult> => {
    // Throttle token guessing (per IP).
    const { getClientIdentifier } = await import('@/server/infrastructure/auth/auth-rate-limit');
    const { RATE_LIMIT } = await import('@/server/infrastructure/auth/auth-server-utils');
    const { checkSharedRateLimit } = await import('@/server/infrastructure/auth/rate-limit-store');
    const rateLimitResult = await checkSharedRateLimit(
      `pwd_reset_complete:${await getClientIdentifier()}`,
      RATE_LIMIT.PASSWORD_RESET
    );
    if (!rateLimitResult.allowed) {
      throw new Error('Too many attempts. Please try again later.');
    }

    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      throw new Error(
        `Password does not meet the policy: ${passwordValidation.errors.join(', ')}.`
      );
    }

    const { getAuth } = await import('@/server/infrastructure/auth/better-auth-instance');
    const auth = getAuth();
    await auth.api.resetPassword({
      body: { token: data.token, newPassword: data.password },
    });

    await logAuditEvent({
      action: 'admin.password_reset_completed',
      userId: 'admin',
      details: { source: 'reset_token' },
    });

    return { success: true };
  });
