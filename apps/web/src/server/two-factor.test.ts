import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

vi.mock('@tanstack/react-start', () => {
  const createBuilder = () => {
    let schema: z.ZodType<unknown> | undefined;
    const builder = {
      validator: (validator: z.ZodType<unknown>) => {
        schema = validator;
        return builder;
      },
      inputValidator: (validator: z.ZodType<unknown>) => {
        schema = validator;
        return builder;
      },
      handler: (fn: (ctx?: { data: unknown }) => Promise<unknown>) => {
        const currentSchema = schema;
        if (!currentSchema) return fn;
        return async (ctx: { data: unknown }) => {
          const validated = currentSchema.parse(ctx.data);
          return fn({ data: validated });
        };
      },
    };
    return builder;
  };
  return { createServerFn: () => createBuilder() };
});

const {
  mockGetSession,
  mockEnableTwoFactor,
  mockDisableTwoFactor,
  mockVerifyTOTP,
  mockLogAuditEvent,
  mockRequireAdminFromCookie,
  mockGetRequestHeader,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockEnableTwoFactor: vi.fn(),
  mockDisableTwoFactor: vi.fn(),
  mockVerifyTOTP: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockRequireAdminFromCookie: vi.fn(),
  mockGetRequestHeader: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}));

vi.mock('@tanstack/start-server-core', () => ({
  getRequestHeader: (name: string) => mockGetRequestHeader(name),
}));

vi.mock('@/server/infrastructure/auth/better-auth-instance', () => {
  const instance = {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      enableTwoFactor: (...args: unknown[]) => mockEnableTwoFactor(...args),
      disableTwoFactor: (...args: unknown[]) => mockDisableTwoFactor(...args),
      verifyTOTP: (...args: unknown[]) => mockVerifyTOTP(...args),
    },
  };
  return {
    getAuth: () => instance,
    isTwoFactorEnabled: () => process.env.ENABLE_2FA === 'true',
  };
});

vi.mock('@/server/infrastructure/audit-log', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  requireAdminFromCookie: () => mockRequireAdminFromCookie(),
}));

vi.mock('@/server/infrastructure/auth/auth-rate-limit', () => ({
  getClientIdentifier: () => 'test-ip',
}));

vi.mock('@/server/infrastructure/auth/auth-server-utils', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  RATE_LIMIT: {
    TWO_FACTOR: { maxAttempts: 10, windowMs: 300_000, blockDurationMs: 900_000 },
  },
}));

const { enableTwoFactor, disableTwoFactor, getTwoFactorStatus, verifyTwoFactorSetup } =
  await import('@/server/two-factor');

beforeEach(() => {
  vi.resetAllMocks();
  process.env.ENABLE_2FA = 'true';
  mockCheckRateLimit.mockReturnValue({ allowed: true, remainingAttempts: 10 });
  mockRequireAdminFromCookie.mockResolvedValue({ isAdmin: true, permissions: [] });
  mockGetRequestHeader.mockReturnValue('debt-master-auth=token; better-auth-session=sess');
  mockGetSession.mockResolvedValue({
    user: { id: 'admin-user-1' },
    session: { token: 'current-token' },
  });
  mockEnableTwoFactor.mockResolvedValue({
    totpURI: 'otpauth://totp/Debt%20Master:admin@example.com?secret=ABC',
    backupCodes: ['code-1', 'code-2'],
  });
  mockDisableTwoFactor.mockResolvedValue(undefined);
  mockVerifyTOTP.mockResolvedValue(undefined);
  mockLogAuditEvent.mockResolvedValue(undefined);
});

describe('enableTwoFactor', () => {
  it('enables TOTP and returns the setup URI and backup codes', async () => {
    const result = await enableTwoFactor({ data: { password: 'Str0ng!Pass' } });

    expect(result.success).toBe(true);
    expect(result.totpURI).toBe('otpauth://totp/Debt%20Master:admin@example.com?secret=ABC');
    expect(result.backupCodes).toEqual(['code-1', 'code-2']);
    expect(mockEnableTwoFactor).toHaveBeenCalledWith({
      headers: expect.objectContaining({}),
      body: {
        password: 'Str0ng!Pass',
        issuer: 'Debt Master',
      },
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.2fa_enabled',
      userId: 'admin-user-1',
      details: { source: 'security_panel' },
    });
  });

  it('does not audit when the current session cannot be resolved', async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await enableTwoFactor({ data: { password: 'Str0ng!Pass' } });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('normalises enable result when fields are not in expected shape', async () => {
    mockEnableTwoFactor.mockResolvedValue({
      totpURI: 123,
      backupCodes: 'not-an-array',
    });

    const result = await enableTwoFactor({ data: { password: 'Str0ng!Pass' } });

    expect(result.success).toBe(true);
    expect(result.totpURI).toBeUndefined();
    expect(result.backupCodes).toBeUndefined();
  });

  it('works when no cookie header is present', async () => {
    mockGetRequestHeader.mockReturnValue(undefined);

    const result = await enableTwoFactor({ data: { password: 'Str0ng!Pass' } });

    expect(result.success).toBe(true);
    expect(mockEnableTwoFactor).toHaveBeenCalledWith({
      headers: expect.objectContaining({}),
      body: expect.anything(),
    });
  });

  it('throws when password is missing', async () => {
    await expect(enableTwoFactor({ data: { password: '' } })).rejects.toThrow();
  });

  it('surfaces Better Auth errors', async () => {
    mockEnableTwoFactor.mockRejectedValue(new Error('invalid password'));

    await expect(enableTwoFactor({ data: { password: 'Str0ng!Pass' } })).rejects.toThrow(
      'invalid password'
    );
  });
});

describe('disableTwoFactor', () => {
  it('disables TOTP and logs the event', async () => {
    const result = await disableTwoFactor({ data: { password: 'Str0ng!Pass' } });

    expect(result.success).toBe(true);
    expect(mockDisableTwoFactor).toHaveBeenCalledWith({
      headers: expect.objectContaining({}),
      body: { password: 'Str0ng!Pass' },
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.2fa_disabled',
      userId: 'admin-user-1',
      details: { source: 'security_panel' },
    });
  });

  it('does not audit disable when the current session cannot be resolved', async () => {
    mockGetSession.mockRejectedValue(new Error('session lookup failed'));

    const result = await disableTwoFactor({ data: { password: 'Str0ng!Pass' } });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('throws when password is missing', async () => {
    await expect(disableTwoFactor({ data: { password: '' } })).rejects.toThrow();
  });

  it('throws when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remainingAttempts: 0, blockedForMs: 1 });

    await expect(disableTwoFactor({ data: { password: 'Str0ng!Pass' } })).rejects.toThrow(
      /Too many attempts/
    );
    expect(mockDisableTwoFactor).not.toHaveBeenCalled();
  });
});

describe('verifyTwoFactorSetup', () => {
  it('verifies the first TOTP code and logs the event', async () => {
    const result = await verifyTwoFactorSetup({ data: { code: '123456' } });

    expect(result.success).toBe(true);
    expect(mockVerifyTOTP).toHaveBeenCalledWith({
      headers: expect.objectContaining({}),
      body: { code: '123456' },
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.2fa_enabled',
      userId: 'admin-user-1',
      details: { source: 'security_panel', finalized: true },
    });
  });

  it('does not audit when the current session cannot be resolved', async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await verifyTwoFactorSetup({ data: { code: '123456' } });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('throws when code is missing', async () => {
    await expect(verifyTwoFactorSetup({ data: { code: '' } })).rejects.toThrow();
  });

  it('surfaces Better Auth verification errors', async () => {
    mockVerifyTOTP.mockRejectedValue(new Error('invalid code'));

    await expect(verifyTwoFactorSetup({ data: { code: '123456' } })).rejects.toThrow(
      'invalid code'
    );
  });
});

describe('getTwoFactorStatus', () => {
  it('returns enabled=true when user has twoFactorEnabled', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'admin-user-1', twoFactorEnabled: true },
      session: { token: 'current-token' },
    });

    const result = await getTwoFactorStatus();

    expect(result.enabled).toBe(true);
  });

  it('returns enabled=false when user does not have twoFactorEnabled', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'admin-user-1' },
      session: { token: 'current-token' },
    });

    const result = await getTwoFactorStatus();

    expect(result.enabled).toBe(false);
  });

  it('returns enabled=false when getSession returns null', async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await getTwoFactorStatus();

    expect(result.enabled).toBe(false);
  });

  it('throws when the two-factor plugin is not enabled', async () => {
    process.env.ENABLE_2FA = 'false';

    await expect(getTwoFactorStatus()).rejects.toThrow('Two-factor authentication is not enabled');
  });
});
