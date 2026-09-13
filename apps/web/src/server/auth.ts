import { randomUUID } from 'node:crypto';
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { logAuditEvent } from '@/server/infrastructure/audit-log';
import { getAuthAdapter } from '@/server/infrastructure/auth';
import { invalidateAccessCodeStatus } from '@/server/infrastructure/auth/access-code-status';
import {
  deleteAuthCookieServer,
  getAuthFromCookie,
  requireAdminFromCookie,
  setAuthCookieServer,
} from '@/server/infrastructure/auth/auth-cookie';
import {
  getJwt,
  getJwtExpiry,
  getJwtSecret,
  hashIdentifier,
} from '@/server/infrastructure/auth/auth-server-utils';
import { infraConfig } from '@/server/infrastructure/config';
import { createServerLogger } from '@/server/infrastructure/logger';
import { prisma } from '@/server/infrastructure/prisma';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';

const logger = createServerLogger('auth', process.env.NODE_ENV === 'development');

/**
 * Result of access code validation.
 * Success: valid is true with token, permissions, isAdmin.
 * Failure: valid is false with error message.
 */
export interface AccessCodeSuccessResult {
  readonly valid: true;
  readonly permissions: readonly string[];
  readonly isAdmin: boolean;
}
export interface AccessCodeErrorResult {
  readonly valid: false;
  readonly error: string;
}
export type AccessCodeValidationResult = AccessCodeSuccessResult | AccessCodeErrorResult;

/**
 * Result of Authentik OAuth callback.
 * Success: valid is true with token, permissions, isAdmin, username.
 * Failure: valid is false with error message.
 */
export interface AuthentikCallbackSuccessResult {
  readonly valid: true;
  readonly permissions: readonly string[];
  readonly isAdmin: true;
  readonly username: string;
}
export interface AuthentikCallbackErrorResult {
  readonly valid: false;
  readonly error: string;
}
export type AuthentikCallbackResult = AuthentikCallbackSuccessResult | AuthentikCallbackErrorResult;

/**
 * Type guard to check if an AccessCodeValidationResult is a success.
 */
export function isAccessCodeSuccess(
  result: AccessCodeValidationResult
): result is AccessCodeSuccessResult {
  return result.valid === true;
}

/**
 * Type guard to check if an AuthentikCallbackResult is a success.
 */
export function isAuthentikCallbackSuccess(
  result: AuthentikCallbackResult
): result is AuthentikCallbackSuccessResult {
  return result.valid === true;
}

// Authentik OAuth configuration
const AUTHENTIK_CONFIG = {
  baseUrl: process.env.AUTHENTIK_BASE_URL || 'http://auth.mew',
  clientId: process.env.AUTHENTIK_CLIENT_ID || '',
  clientSecret: process.env.AUTHENTIK_CLIENT_SECRET || '',
  redirectUri: process.env.AUTHENTIK_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  scope: 'openid profile email',
};

// Token payload type is imported from auth.server.ts

/**
 * Interface for Authentik user info response
 */
interface AuthentikUserInfo {
  sub: string;
  preferred_username: string;
  email?: string;
  name?: string;
  groups?: string[];
}

// Define schemas for validation
const accessCodeSchema = z.object({
  code: z.string().min(4, 'Access code must be at least 4 characters'),
  turnstileToken: z.string().optional(), // Optional for backward compatibility
});

/**
 * Generate Authentik OAuth authorization URL
 */
export const getAuthentikAuthUrl = createServerFn({ method: 'GET' }).handler(async () => {
  // Cookie primitives are server-only (start-server-core pulls node:async_hooks);
  // a top-level import leaks them into the client bundle and blanks the
  // login/setup pages.
  const { setCookie } = await import('@tanstack/start-server-core');
  const state = randomUUID();

  // Persist the issued state in a short-lived httpOnly cookie so the callback
  // can verify it server-side (login-CSRF defense). Cleared on consumption.
  setCookie('debt-master-oidc-state', state, {
    path: '/',
    sameSite: 'lax',
    maxAge: 600,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  });

  const params = new URLSearchParams({
    client_id: AUTHENTIK_CONFIG.clientId,
    response_type: 'code',
    scope: AUTHENTIK_CONFIG.scope,
    redirect_uri: AUTHENTIK_CONFIG.redirectUri,
    state,
  });

  const authUrl = `${AUTHENTIK_CONFIG.baseUrl}/application/o/authorize/?${params.toString()}`;

  return {
    authUrl,
    state,
  };
});

/**
 * Expose the configured admin-login provider to the client so the login form
 * knows whether to render the Authentik OAuth button or the Better Auth
 * email/password form. Returns a non-sensitive string only.
 */
export const getAuthProvider = createServerFn({ method: 'GET' }).handler(async () => {
  return infraConfig.authProvider;
});

/**
 * Handle OAuth callback from Authentik
 */
export const handleAuthentikCallback = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      code: z.string(),
      state: z.string(),
    })
  )
  .handler(async ({ data }) => {
    // Import JWT only on server side
    const jwt = await getJwt();

    try {
      // The OAuth `state` must match the value issued with the authorization
      // URL (cookie-bound); otherwise the callback is a forged/relay request.
      const { getCookie, setCookie } = await import('@tanstack/start-server-core');
      const issuedState = getCookie('debt-master-oidc-state');
      setCookie('debt-master-oidc-state', '', {
        path: '/',
        sameSite: 'lax',
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
      });
      if (!issuedState || issuedState !== data.state) {
        logger.warn('Authentik callback rejected: state mismatch');
        return {
          valid: false,
          error: 'Invalid or expired login attempt. Please start again.',
        } satisfies AuthentikCallbackErrorResult;
      }

      // Authentik is the admin-login mechanism only when selected; refuse the
      // callback path otherwise so env leftovers cannot mint admin sessions.
      if (infraConfig.authProvider !== 'authentik') {
        logger.warn('Authentik callback rejected: AUTH_PROVIDER is not authentik');
        return {
          valid: false,
          error: 'Authentik login is not enabled on this instance.',
        } satisfies AuthentikCallbackErrorResult;
      }

      // Exchange authorization code for access token
      const tokenResponse = await fetch(`${AUTHENTIK_CONFIG.baseUrl}/application/o/token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: data.code,
          redirect_uri: AUTHENTIK_CONFIG.redirectUri,
          client_id: AUTHENTIK_CONFIG.clientId,
          client_secret: AUTHENTIK_CONFIG.clientSecret,
        }),
      });

      if (!tokenResponse.ok) {
        logger.error('Token exchange failed', { status: tokenResponse.status });
        throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to exchange authorization code');
      }

      const tokenData = await tokenResponse.json();

      // Get user info from Authentik
      const userInfoResponse = await fetch(`${AUTHENTIK_CONFIG.baseUrl}/application/o/userinfo/`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        logger.error('User info fetch failed', { status: userInfoResponse.status });
        throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch user info');
      }

      const userInfo: AuthentikUserInfo = await userInfoResponse.json();

      // Check if user exists in our database
      const existingUser = await prisma.user.findUnique({
        where: { username: userInfo.preferred_username },
      });

      // A colleague (access-code user) sharing the username must NOT be
      // escalated to admin by signing in via OAuth. Only genuinely new users
      // are created as admins — Authentik mode is the admin-login mechanism.
      if (existingUser && !existingUser.isAdmin) {
        logger.warn('Authentik login refused for non-admin user', {
          username: userInfo.preferred_username,
        });
        await logAuditEvent({
          action: 'admin.login_refused',
          userId: userInfo.preferred_username,
          details: { provider: 'authentik', reason: 'non_admin_user' },
        });
        return {
          valid: false,
          error: 'This account does not have admin access.',
        } satisfies AuthentikCallbackErrorResult;
      }

      const user =
        existingUser ??
        (await prisma.user.create({
          data: {
            username: userInfo.preferred_username,
            isAdmin: true, // Admin users created through Authentik flow
          },
        }));

      // Generate our internal JWT token
      const token = jwt.sign(
        {
          isAdmin: true,
          permissions: ['view', 'create', 'edit', 'delete'],
          username: user.username,
        },
        getJwtSecret(),
        { expiresIn: getJwtExpiry() }
      );

      // Set the httpOnly auth cookie server-side; the token is never returned
      // to the client, so it cannot be exfiltrated via XSS.
      await setAuthCookieServer(token);

      await logAuditEvent({
        action: 'admin.login',
        userId: user.username,
        details: { provider: 'authentik', ...(userInfo.email ? { email: userInfo.email } : {}) },
      });

      return {
        valid: true,
        permissions: ['view', 'create', 'edit', 'delete'],
        isAdmin: true,
        username: user.username,
      } satisfies AuthentikCallbackSuccessResult;
    } catch (error) {
      logger.error('Error handling Authentik callback', error);
      return {
        valid: false,
        error: 'Failed to authenticate with Authentik',
      } satisfies AuthentikCallbackErrorResult;
    }
  });

// Validate access code and return token for regular users
export const validateAccessCode = createServerFn({ method: 'POST' })
  .validator(accessCodeSchema)
  .handler(async ({ data }) => {
    // Import JWT only on server side
    const jwt = await getJwt();

    try {
      // Check rate limit before processing.
      // Dynamic import keeps the server-only rate limiter (and its
      // @tanstack/start-server-core / node:async_hooks dependency) out of the
      // client bundle — this handler body is stripped from the client build.
      const { checkAccessCodeRateLimit } = await import(
        '@/server/infrastructure/auth/auth-rate-limit'
      );
      const rateLimitResult = await checkAccessCodeRateLimit(data.code);
      if (!rateLimitResult.allowed) {
        const blockedMinutes = Math.ceil((rateLimitResult.blockedForMs ?? 0) / 60000);
        await logAuditEvent({
          action: 'access_code.failed',
          userId: 'anonymous',
          details: { codeHash: hashIdentifier(data.code), reason: 'rate_limited', blockedMinutes },
        });
        return {
          valid: false,
          error: `Too many failed attempts. Please try again in ${blockedMinutes} minute${blockedMinutes === 1 ? '' : 's'}.`,
        } satisfies AccessCodeErrorResult;
      }

      // Turnstile: verify server-side whenever the integration is configured.
      // Fail-closed — a verification error aborts the login instead of
      // waving the request through.
      const { validateTurnstileToken, isTurnstileConfigured } = await import('@/server/turnstile');
      if (isTurnstileConfigured()) {
        if (!data.turnstileToken) {
          return {
            valid: false,
            error: 'Security verification is required',
          } satisfies AccessCodeErrorResult;
        }
        const turnstileResult = await validateTurnstileToken({
          data: { token: data.turnstileToken },
        });
        if (!turnstileResult.success) {
          await logAuditEvent({
            action: 'access_code.failed',
            userId: 'anonymous',
            details: { reason: 'turnstile_rejected' },
          });
          return {
            valid: false,
            error: 'Security verification failed. Please try again.',
          } satisfies AccessCodeErrorResult;
        }
      }

      // Validate Turnstile token if provided
      const accessCode = await prisma.accessCode.findFirst({
        where: {
          code: data.code,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!accessCode) {
        await logAuditEvent({
          action: 'access_code.failed',
          userId: 'anonymous',
          details: { codeHash: hashIdentifier(data.code), reason: 'invalid_or_inactive' },
        });
        return {
          valid: false,
          error: 'Invalid or inactive access code',
        } satisfies AccessCodeErrorResult;
      }

      // Update last used timestamp
      await prisma.accessCode.update({
        where: { id: accessCode.id },
        data: { lastUsed: new Date() },
      });

      // Admin test access code from .env — DEV ONLY. Never available in
      // production: a publicly-known shared code granting admin is a bypass.
      const adminAccessCode = process.env.TEST_ADMIN_ACCESS_CODE;
      const isAdmin =
        process.env.NODE_ENV !== 'production' &&
        adminAccessCode !== undefined &&
        data.code === adminAccessCode;

      const token = jwt.sign(
        {
          isAdmin,
          permissions: isAdmin ? ['view', 'create', 'edit', 'delete'] : ['view'],
          accessCodeId: accessCode.id,
        },
        getJwtSecret(),
        { expiresIn: getJwtExpiry() }
      );

      // Set the auth cookie server-side (httpOnly) so subsequent server
      // functions resolve identity from the cookie without the client
      // round-tripping the token.
      await setAuthCookieServer(token);

      return {
        valid: true,
        permissions: isAdmin ? ['view', 'create', 'edit', 'delete'] : ['view'],
        isAdmin,
      } satisfies AccessCodeSuccessResult;
    } catch (error) {
      logger.error('Error validating access code', error);
      return {
        valid: false,
        error: 'Failed to validate access code',
      } satisfies AccessCodeErrorResult;
    }
  });

/**
 * Non-sensitive current-user shape resolved from the httpOnly auth cookie.
 * Returned to the client so it knows auth/admin state WITHOUT ever holding
 * the token. The token stays httpOnly-only.
 */
export interface CurrentUser {
  readonly isAdmin: boolean;
  readonly permissions: readonly string[];
  readonly username: string | null;
  readonly accessCodeId: number | null;
}

// Resolve the current user from the httpOnly auth cookie (no client token).
export const getCurrentUserFromCookie = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CurrentUser | null> => {
    const payload = await getAuthFromCookie();
    if (!payload) return null;
    return {
      isAdmin: payload.isAdmin,
      permissions: payload.permissions,
      username: payload.username ?? null,
      accessCodeId: payload.accessCodeId ?? null,
    };
  }
);

// Create new access code (admin only)
export const createAccessCode = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        code: z.string().min(4, 'Access code must be at least 4 characters'),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    try {
      const admin = await requireAdminFromCookie();
      const creator = admin.username ?? 'unknown';

      // Check if code already exists among non-deleted codes
      const existingCode = await prisma.accessCode.findFirst({
        where: { code: data.code, deletedAt: null },
      });

      if (existingCode) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, 'Access code already exists');
      }

      // Create new access code
      const accessCode = await prisma.accessCode.create({
        data: {
          code: data.code,
          createdBy: creator,
        },
      });

      await logAuditEvent({
        action: 'access_code.created',
        userId: creator,
        details: { codeId: accessCode.id },
      });

      return {
        success: true,
        accessCode: {
          id: accessCode.id,
          code: accessCode.code,
          isActive: accessCode.isActive,
          createdAt: accessCode.createdAt,
        },
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('Error creating access code', error);
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to create access code');
    }
  });

// Get all access codes (admin only)
export const getAccessCodes = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    await requireAdminFromCookie();

    const accessCodes = await prisma.accessCode.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return accessCodes.map((code) => ({
      id: code.id,
      code: code.code,
      isActive: code.isActive,
      createdAt: code.createdAt,
      lastUsed: code.lastUsed,
      createdBy: code.createdBy ?? null,
    }));
  } catch (error) {
    if (isAppError(error)) throw error;
    logger.error('Error fetching access codes', error);
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch access codes');
  }
});

// Deactivate access code (admin only)
export const deactivateAccessCode = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    try {
      const admin = await requireAdminFromCookie();

      const accessCode = await prisma.accessCode.update({
        where: { id: data.id },
        data: { isActive: false },
      });
      await invalidateAccessCodeStatus(accessCode.id);

      await logAuditEvent({
        action: 'access_code.deactivated',
        userId: admin.username ?? 'unknown',
        details: { codeId: accessCode.id, code: accessCode.code },
      });

      return {
        success: true,
        accessCode: {
          id: accessCode.id,
          code: accessCode.code,
          isActive: accessCode.isActive,
        },
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('Error deactivating access code', error);
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to deactivate access code');
    }
  });

// Reactivate access code (admin only)
export const reactivateAccessCode = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    try {
      const admin = await requireAdminFromCookie();

      const accessCode = await prisma.accessCode.update({
        where: { id: data.id },
        data: { isActive: true },
      });
      await invalidateAccessCodeStatus(accessCode.id);

      await logAuditEvent({
        action: 'access_code.reactivated',
        userId: admin.username ?? 'unknown',
        details: { codeId: accessCode.id, code: accessCode.code },
      });

      return {
        success: true,
        accessCode: {
          id: accessCode.id,
          code: accessCode.code,
          isActive: accessCode.isActive,
        },
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('Error reactivating access code', error);
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to reactivate access code');
    }
  });

// Bind (or unbind) an access code to a colleague (admin only).
// A bound code scopes receipt/proof reads to resources involving that
// colleague; unbound codes keep legacy full read access.
export const assignAccessCodeColleague = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
        colleagueId: z.number().int().positive().nullable(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    try {
      const admin = await requireAdminFromCookie();

      if (data.colleagueId !== null) {
        const colleague = await prisma.colleague.findUnique({
          where: { id: data.colleagueId },
          select: { id: true },
        });
        if (!colleague || colleague.id !== data.colleagueId) {
          throw new AppError(ErrorCode.NOT_FOUND_COLLEAGUE, 'Colleague not found');
        }
      }

      const accessCode = await prisma.accessCode.update({
        where: { id: data.id },
        data: { colleagueId: data.colleagueId },
      });

      await logAuditEvent({
        action: 'access_code.colleague_assigned',
        userId: admin.username ?? 'unknown',
        details: {
          codeId: accessCode.id,
          ...(data.colleagueId === null ? { unbound: true } : { colleagueId: data.colleagueId }),
        },
      });

      return {
        success: true,
        accessCode: {
          id: accessCode.id,
          code: accessCode.code,
          isActive: accessCode.isActive,
          colleagueId: accessCode.colleagueId,
        },
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('Error assigning colleague to access code', error);
      throw new AppError(
        ErrorCode.INFRASTRUCTURE_ERROR,
        'Failed to assign colleague to access code'
      );
    }
  });

// Soft-delete access code (admin only)
export const deleteAccessCode = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    try {
      const admin = await requireAdminFromCookie();

      const accessCode = await prisma.accessCode.update({
        where: { id: data.id },
        data: { isActive: false, deletedAt: new Date() },
      });
      await invalidateAccessCodeStatus(accessCode.id);

      await logAuditEvent({
        action: 'access_code.deleted',
        userId: admin.username ?? 'unknown',
        details: { codeId: accessCode.id, code: accessCode.code },
      });

      return {
        success: true,
        accessCode: {
          id: accessCode.id,
          code: accessCode.code,
          isActive: accessCode.isActive,
        },
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('Error deleting access code', error);
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to delete access code');
    }
  });

// Logout (clear the auth cookie)
export function shouldAuditAdminLogout(
  identity: { isAdmin?: boolean; username?: string | null } | null
): identity is { isAdmin: true; username: string } {
  return Boolean(identity?.isAdmin && identity.username);
}

export async function maybeLogAdminLogout(
  identity: { isAdmin?: boolean; username?: string | null } | null
): Promise<void> {
  if (!shouldAuditAdminLogout(identity)) {
    return;
  }
  await logAuditEvent({
    action: 'admin.logout',
    userId: identity.username,
    details: {},
  });
}

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  try {
    const identity = await getAuthFromCookie();
    const adapter = await getAuthAdapter();
    await adapter.signOut();
    await maybeLogAdminLogout(identity);
  } catch {
    // Best-effort: still clear the local JWT cookie.
  } finally {
    await deleteAuthCookieServer();
  }
  return { success: true };
});
