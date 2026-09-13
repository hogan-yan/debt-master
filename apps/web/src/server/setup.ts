/**
 * First-run admin setup (DEBTCOM-2).
 *
 * Lets a self-hoster create the initial admin account from the browser
 * (`/setup`) without touching the CLI — the common "one-step host" deploy.
 * The page is only usable while zero admins exist AND the admin provider is
 * Better Auth; it locks the moment any admin is created.
 */
import { timingSafeEqual } from 'node:crypto';
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { logAuditEvent } from '@/server/infrastructure/audit-log';
import { infraConfig } from '@/server/infrastructure/config';
import { createServerLogger } from '@/server/infrastructure/logger';
import { isLocalSetupAllowed } from '@/server/infrastructure/network';
import { prisma } from '@/server/infrastructure/prisma';
import { MIN_PASSWORD_LENGTH, validatePassword } from '@/utils/password-policy';

const logger = createServerLogger('setup', process.env.NODE_ENV === 'development');

if (process.env.NODE_ENV === 'production' && !process.env.SETUP_TOKEN) {
  logger.warn(
    'SETUP_TOKEN is not set. First-run setup is protected only by the local-network check; set SETUP_TOKEN to also require a shared secret.'
  );
}

/**
 * Length-checked constant-time comparison for the setup token.
 */
function setupTokenMatches(configured: string, provided: string): boolean {
  const expected = Buffer.from(configured, 'utf8');
  const actual = Buffer.from(provided, 'utf8');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export interface FirstRunStatus {
  readonly setupRequired: boolean;
}

export interface CreateFirstAdminSuccess {
  readonly success: true;
}
export interface CreateFirstAdminError {
  readonly success: false;
  readonly error: string;
}
export type CreateFirstAdminResult = CreateFirstAdminSuccess | CreateFirstAdminError;

const createFirstAdminSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
  name: z.string().min(1, 'Name is required'),
  setupToken: z.string().optional(),
});

/**
 * Whether the browser first-run setup wizard should be shown.
 * True only when admin login uses Better Auth AND no admin exists yet.
 */
export const isFirstRun = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FirstRunStatus> => {
    const setupRequired =
      infraConfig.authProvider === 'better-auth' && (await prisma.betterAuthUser.count()) === 0;
    return { setupRequired };
  }
);

/**
 * Create the first admin account. Defense in depth: re-checks the provider,
 * the zero-admin invariant, the setup-token/local-network gate, and the
 * password policy on the server before calling Better Auth sign-up. A
 * configured, matching SETUP_TOKEN authorizes setup from any network;
 * without it, only private/loopback clients pass. After the first admin
 * exists, this always refuses — the wizard locks.
 */
export const createFirstAdmin = createServerFn({ method: 'POST' })
  .validator(createFirstAdminSchema)
  .handler(async ({ data }): Promise<CreateFirstAdminResult> => {
    if (infraConfig.authProvider !== 'better-auth') {
      return {
        success: false,
        error: 'Setup is only available when AUTH_PROVIDER=better-auth.',
      };
    }
    if ((await prisma.betterAuthUser.count()) > 0) {
      return {
        success: false,
        error: 'An admin account already exists. Sign in from the login page.',
      };
    }
    // A configured, matching SETUP_TOKEN authorizes first-run setup from any
    // network — including remote hosts behind a public ingress (e.g. a
    // single-container PaaS deploy) that the locality gate below would
    // otherwise refuse. Without a valid token the locality gate stands.
    const configuredToken = process.env.SETUP_TOKEN;
    const hasValidToken =
      typeof configuredToken === 'string' &&
      configuredToken.length > 0 &&
      setupTokenMatches(configuredToken, data.setupToken ?? '');

    if (!(await isLocalSetupAllowed())) {
      if (hasValidToken) {
        // Audit-visible: the setup token authorized a remote (public-IP)
        // first-run setup.
        await logAuditEvent({
          action: 'admin.setup_authorized',
          userId: 'anonymous',
          details: { reason: 'setup_token' },
        });
      } else {
        // Audit-visible: a public-internet client attempted first-run setup.
        await logAuditEvent({
          action: 'admin.setup_denied',
          userId: 'anonymous',
          details: { reason: 'public_ip' },
        });
        return {
          success: false,
          error:
            'For security, first-run setup must run from a private/local network, or via `bun run create:admin`.',
        };
      }
    } else if (
      typeof configuredToken === 'string' &&
      configuredToken.length > 0 &&
      !hasValidToken
    ) {
      // Local client, but a token is configured and the provided one missed.
      return {
        success: false,
        error: 'Invalid setup token.',
      };
    }

    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: `Password does not meet the policy: ${passwordValidation.errors.join(', ')}.`,
      };
    }

    try {
      // Lazy import so Authentik-only deploys never load the Better Auth code.
      const { getAuth } = await import('@/server/infrastructure/auth/better-auth-instance');
      const auth = getAuth();
      await auth.api.signUpEmail({
        body: { email: data.email, password: data.password, name: data.name },
      });

      const user = await prisma.betterAuthUser.findUnique({
        where: { email: data.email },
      });
      await logAuditEvent({
        action: 'admin.setup_completed',
        userId: user?.id ?? data.email,
        details: { email: data.email },
      });

      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Failed to create the admin account. Please try again.',
      };
    }
  });
