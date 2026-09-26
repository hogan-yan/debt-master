import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {},
}));

const mockSendEmail = vi.hoisted(() => vi.fn());
vi.mock('@/server/infrastructure/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

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
  },
}));

import {
  __resetAuthInstanceForTests,
  buildBetterAuthConfig,
  getAuth,
  isTwoFactorEnabled,
} from '@/server/infrastructure/auth/better-auth-instance';

describe('buildBetterAuthConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_2FA;
    delete process.env.ENABLE_EMAIL_VERIFICATION;
  });

  it('includes rate limiting and a 12-character password minimum', () => {
    const config = buildBetterAuthConfig();
    expect(config.rateLimit).toEqual({ enabled: true, window: 60, max: 10 });
    expect(config.emailAndPassword.minPasswordLength).toBe(12);
    expect(config.emailAndPassword.requireEmailVerification).toBe(false);
  });

  it('does not include 2FA or email verification by default', () => {
    const config = buildBetterAuthConfig();
    expect(config.plugins).toHaveLength(0);
    expect(config).not.toHaveProperty('emailVerification');
  });

  it('enables 2FA plugin when ENABLE_2FA=true', () => {
    process.env.ENABLE_2FA = 'true';
    const config = buildBetterAuthConfig();
    expect(config.plugins).toHaveLength(1);
  });

  it('reports whether two-factor authentication is enabled', () => {
    expect(isTwoFactorEnabled()).toBe(false);
    process.env.ENABLE_2FA = 'true';
    expect(isTwoFactorEnabled()).toBe(true);
  });

  it('enables email verification when ENABLE_EMAIL_VERIFICATION=true', () => {
    process.env.ENABLE_EMAIL_VERIFICATION = 'true';
    const config = buildBetterAuthConfig();
    expect(config.emailAndPassword.requireEmailVerification).toBe(true);
    expect(config).toHaveProperty('emailVerification');
  });

  it('sends a reset password email via the configured callback', async () => {
    const config = buildBetterAuthConfig();
    const sendResetPassword = config.emailAndPassword.sendResetPassword;
    expect(sendResetPassword).toBeDefined();

    await sendResetPassword?.({
      user: { email: 'admin@example.com', name: 'Admin' },
      url: 'http://localhost:3000/reset-password?token=abc',
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const args = mockSendEmail.mock.calls[0]?.[0] as {
      to: string;
      subject: string;
      html: string;
      text: string;
    };
    expect(args.to).toBe('admin@example.com');
    expect(args.subject).toContain('password reset');
    expect(args.html).toContain('token=abc');
  });

  it('sends a verification email when verification is enabled', async () => {
    process.env.ENABLE_EMAIL_VERIFICATION = 'true';
    const config = buildBetterAuthConfig();
    const sendVerification = config.emailVerification?.sendVerificationEmail;
    expect(sendVerification).toBeDefined();

    await sendVerification?.({
      user: { email: 'admin@example.com', name: 'Admin' },
      url: 'http://localhost:3000/verify?token=xyz',
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const args = mockSendEmail.mock.calls[0]?.[0] as {
      to: string;
      subject: string;
      html: string;
    };
    expect(args.to).toBe('admin@example.com');
    expect(args.subject).toContain('Verify');
    expect(args.html).toContain('token=xyz');
  });
});

describe('buildBetterAuthConfig env-gated surfaces', () => {
  const savedNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_2FA;
    delete process.env.ENABLE_EMAIL_VERIFICATION;
    delete process.env.VALKEY_URL;
    delete process.env.VALKEY_HOST;
    delete process.env.CACHE_PROVIDER;
    delete process.env.BETTER_AUTH_TRUSTED_PROXIES;
  });

  afterEach(() => {
    process.env.NODE_ENV = savedNodeEnv;
    delete process.env.VALKEY_URL;
    delete process.env.VALKEY_HOST;
    delete process.env.CACHE_PROVIDER;
    delete process.env.BETTER_AUTH_TRUSTED_PROXIES;
  });

  it('wires the Valkey storage into rateLimit.customStorage when Valkey env is set', () => {
    process.env.VALKEY_URL = 'valkey://localhost:6379';
    const config = buildBetterAuthConfig();
    expect(config.rateLimit).toEqual({
      enabled: true,
      window: 60,
      max: 10,
      customStorage: expect.any(Object),
    });
  });

  it('omits rateLimit.customStorage entirely when no Valkey is configured', () => {
    const config = buildBetterAuthConfig();
    expect(config.rateLimit).toEqual({ enabled: true, window: 60, max: 10 });
    expect(config.rateLimit).not.toHaveProperty('customStorage');
  });

  it('builds the storage when only CACHE_PROVIDER selects valkey', () => {
    process.env.CACHE_PROVIDER = 'valkey';
    const config = buildBetterAuthConfig();
    expect(config.rateLimit).toHaveProperty('customStorage');
  });

  it('trusts a single BETTER_AUTH_TRUSTED_PROXIES entry', () => {
    process.env.BETTER_AUTH_TRUSTED_PROXIES = '10.42.0.0/16';
    const config = buildBetterAuthConfig();
    expect(config.advanced.ipAddress?.trustedProxies).toEqual(['10.42.0.0/16']);
  });

  it('parses comma-separated trusted proxies and trims each entry', () => {
    process.env.BETTER_AUTH_TRUSTED_PROXIES = ' 10.42.0.0/16 , 10.0.0.1,  172.16.0.0/12  ';
    const config = buildBetterAuthConfig();
    expect(config.advanced.ipAddress?.trustedProxies).toEqual([
      '10.42.0.0/16',
      '10.0.0.1',
      '172.16.0.0/12',
    ]);
  });

  it('drops trustedProxies entirely for empty or whitespace-only values', () => {
    process.env.BETTER_AUTH_TRUSTED_PROXIES = '   ';
    const config = buildBetterAuthConfig();
    expect(config.advanced).toEqual({ useSecureCookies: false });
    expect(config.advanced).not.toHaveProperty('ipAddress');

    process.env.BETTER_AUTH_TRUSTED_PROXIES = '';
    expect(buildBetterAuthConfig().advanced).not.toHaveProperty('ipAddress');
  });

  it('keeps useSecureCookies production-gated', () => {
    expect(buildBetterAuthConfig().advanced.useSecureCookies).toBe(false);
    process.env.NODE_ENV = 'production';
    expect(buildBetterAuthConfig().advanced.useSecureCookies).toBe(true);
    process.env.NODE_ENV = 'development';
    expect(buildBetterAuthConfig().advanced.useSecureCookies).toBe(false);
  });
});

describe('getAuth', () => {
  beforeEach(() => {
    __resetAuthInstanceForTests();
    configState.authProvider = 'authentik';
    mockBetterAuth.mockClear();
  });

  it('throws a clear error when the deploy does not select better-auth', () => {
    expect(() => getAuth()).toThrow(/AUTH_PROVIDER="authentik"/);
    expect(mockBetterAuth).not.toHaveBeenCalled();
  });

  it('builds once and memoizes under the better-auth provider', () => {
    configState.authProvider = 'better-auth';
    const first = getAuth();
    const second = getAuth();
    expect(mockBetterAuth).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('can rebuild after the test reset helper', () => {
    configState.authProvider = 'better-auth';
    const first = getAuth();
    __resetAuthInstanceForTests();
    getAuth();
    expect(mockBetterAuth).toHaveBeenCalledTimes(2);
    expect(mockBetterAuth.mock.results[1]?.value).not.toBe(first);
  });
});
