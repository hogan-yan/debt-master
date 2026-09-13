/**
 * DEBT-MASTER-3 regression (GlitchTip issue 3, 2026-09-10 prod crash).
 *
 * Loading the Settings→Security chunk graph used to construct the Better
 * Auth instance at module scope. On `AUTH_PROVIDER=authentik` deploys with
 * no BETTER_AUTH_SECRET, `betterAuth()` built with the default secret,
 * threw BetterAuthError, and the unhandled rejection crashed the pod.
 * These tests pin the invariant: importing any of the reachable modules
 * must never construct Better Auth.
 */
import { describe, expect, it, vi } from 'vitest';

const mockBetterAuth = vi.hoisted(() => vi.fn(() => ({ handler: () => new Response('ok') })));
vi.mock('better-auth', () => ({ betterAuth: mockBetterAuth }));
vi.mock('better-auth/adapters/prisma', () => ({ prismaAdapter: vi.fn(() => ({})) }));
vi.mock('better-auth/plugins/two-factor', () => ({ twoFactor: vi.fn(() => ({})) }));

const configState = vi.hoisted(() => ({ authProvider: 'authentik' as string }));
vi.mock('@/server/infrastructure/config', () => ({
  infraConfig: {
    get authProvider() {
      return configState.authProvider;
    },
    get storageProvider() {
      return 'minio';
    },
  },
}));

vi.mock('@/server/infrastructure/prisma', () => ({ prisma: {} }));
vi.mock('@/server/infrastructure/email', () => ({ sendEmail: vi.fn() }));
vi.mock('@/server/infrastructure/auth/better-auth-email-handlers', () => ({
  buildResetPasswordEmail: vi.fn(),
  buildVerificationEmail: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => {
  const createBuilder = () => {
    const builder = {
      validator: () => builder,
      inputValidator: () => builder,
      handler: (fn: (ctx?: { data: unknown }) => Promise<unknown>) => fn,
    };
    return builder;
  };
  return { createServerFn: () => createBuilder() };
});

vi.mock('@tanstack/start-server-core', () => ({
  getRequestHeader: vi.fn(() => undefined),
}));

vi.mock('@/server/infrastructure/audit-log', () => ({ logAuditEvent: vi.fn() }));
vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  requireAdminFromCookie: vi.fn(),
  getAuthFromCookie: vi.fn(),
  setAuthCookieServer: vi.fn(),
  deleteAuthCookieServer: vi.fn(),
}));

const { getTwoFactorStatus } = await import('@/server/two-factor');
const { getAdminSessions } = await import('@/server/admin-security');
const { getAuth } = await import('@/server/infrastructure/auth/better-auth-instance');

describe('Better Auth import safety (DEBT-MASTER-3 regression)', () => {
  it('never constructs Better Auth when the authentik-reachable chunk graph loads', () => {
    expect(mockBetterAuth).not.toHaveBeenCalled();
  });

  it('throws a clear error if code nonetheless asks for the instance', () => {
    expect(() => getAuth()).toThrow(/AUTH_PROVIDER="authentik"/);
  });

  it('server fns from the same chunk stay callable after import', async () => {
    await expect(getTwoFactorStatus()).rejects.toThrow('not enabled');
    await expect(getAdminSessions()).rejects.toThrow();
  });
});
