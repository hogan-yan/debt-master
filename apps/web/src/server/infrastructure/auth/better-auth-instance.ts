/**
 * Better Auth instance (DEBTCOM-2 core).
 *
 * Email/password admin login. Mounted at `/api/auth/*` in `src/ssr.tsx` when
 * `AUTH_PROVIDER=better-auth`. Only the `user` model is renamed — Better Auth's
 * `modelName` config takes the **Prisma client accessor** (camelCase), not the
 * PascalCase model name or the `@@map` table name. `session`/`account`/
 * `verification` keep their default accessor names, which already match our
 * `prisma/schema.prisma` models, so they need no override.
 *
 * `BETTER_AUTH_SECRET` (>=32 chars) and `BETTER_AUTH_URL` are read from env by
 * Better Auth directly — do not hardcode them here.
 *
 * The instance is NEVER built at module scope. A module-scope `betterAuth()`
 * call made every importer of this module construct an instance — on
 * Authentik-only deploys (production) that built with the default secret and
 * the thrown BetterAuthError crashed the process (GlitchTip DEBT-MASTER-3,
 * 2026-09-10). Authentik deploys must never build it: use `getAuth()`.
 */

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins/two-factor';
import type { BetterAuthPlugin } from 'better-auth/types';
import { sendEmail } from '@/server/infrastructure/email';
import { prisma } from '@/server/infrastructure/prisma';
import { infraConfig } from '../config';
import { buildResetPasswordEmail, buildVerificationEmail } from './better-auth-email-handlers';

function appName(): string {
  return process.env.PUBLIC_APP_NAME || 'Debt Master';
}

function isEnabled(name: string): boolean {
  return process.env[name] === 'true';
}

export function isTwoFactorEnabled(): boolean {
  return isEnabled('ENABLE_2FA');
}

export function buildBetterAuthConfig() {
  const plugins: (BetterAuthPlugin | ReturnType<typeof twoFactor>)[] = [];
  if (isEnabled('ENABLE_2FA')) {
    plugins.push(twoFactor({ issuer: appName() }));
  }

  const emailVerificationEnabled = isEnabled('ENABLE_EMAIL_VERIFICATION');

  return {
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    basePath: '/api/auth',
    rateLimit: {
      enabled: true,
      window: 60,
      max: 10,
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: emailVerificationEnabled,
      sendResetPassword: async (data: {
        user: { email: string; name?: string | null | undefined };
        url: string;
      }) => {
        const { subject, html, text } = buildResetPasswordEmail(data);
        await sendEmail({ to: data.user.email, subject, html, text });
      },
    },
    ...(emailVerificationEnabled
      ? {
          emailVerification: {
            sendOnSignUp: true,
            sendVerificationEmail: async (data: {
              user: { email: string; name?: string | null | undefined };
              url: string;
            }) => {
              const { subject, html, text } = buildVerificationEmail(data);
              await sendEmail({ to: data.user.email, subject, html, text });
            },
          },
        }
      : {}),
    // BetterAuthUser model → prisma.betterAuthUser (camelCase accessor)
    user: {
      modelName: 'betterAuthUser',
    },
    session: {
      cookieCache: {
        enabled: false,
      },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
    plugins,
  };
}

export type BetterAuthInstance = ReturnType<
  typeof betterAuth<ReturnType<typeof buildBetterAuthConfig>>
>;

let cachedInstance: BetterAuthInstance | null = null;

/**
 * Lazily built, memoized Better Auth singleton. Throws under any provider
 * other than `better-auth` so a misrouted call fails loudly instead of
 * silently minting a default-secret instance.
 */
export function getAuth(): BetterAuthInstance {
  if (cachedInstance) return cachedInstance;
  if (infraConfig.authProvider !== 'better-auth') {
    throw new Error(
      `Better Auth is not available under AUTH_PROVIDER="${infraConfig.authProvider}" — only "better-auth" deploys build an instance.`
    );
  }
  cachedInstance = betterAuth(buildBetterAuthConfig());
  return cachedInstance;
}

/** Test-only: drop the memoized instance so a test can vary config. */
export function __resetAuthInstanceForTests(): void {
  cachedInstance = null;
}
