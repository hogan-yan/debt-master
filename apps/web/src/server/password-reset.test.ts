import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => {
  const createBuilder = () => {
    const builder = {
      validator: () => builder,
      inputValidator: () => builder,
      handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) => fn,
    };
    return builder;
  };
  return { createServerFn: () => createBuilder() };
});

const { mockRequestPasswordReset, mockResetPassword, mockLogAuditEvent, mockCheckRateLimit } =
  vi.hoisted(() => ({
    mockRequestPasswordReset: vi.fn(),
    mockResetPassword: vi.fn(),
    mockLogAuditEvent: vi.fn(),
    mockCheckRateLimit: vi.fn(),
  }));

vi.mock('@/server/infrastructure/auth/better-auth-instance', () => {
  const instance = {
    api: {
      requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
      resetPassword: (...args: unknown[]) => mockResetPassword(...args),
    },
  };
  return { getAuth: () => instance };
});

vi.mock('@/server/infrastructure/auth/auth-rate-limit', () => ({
  getClientIdentifier: () => 'test-ip',
}));

vi.mock('@/server/infrastructure/auth/auth-server-utils', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  RATE_LIMIT: {
    PASSWORD_RESET: { maxAttempts: 5, windowMs: 900_000, blockDurationMs: 900_000 },
  },
}));

vi.mock('@/server/infrastructure/audit-log', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

const { sendPasswordResetEmail, resetPassword } = await import('@/server/password-reset');

beforeEach(() => {
  vi.resetAllMocks();
  mockCheckRateLimit.mockReturnValue({ allowed: true, remainingAttempts: 5 });
  mockRequestPasswordReset.mockResolvedValue(undefined);
  mockResetPassword.mockResolvedValue(undefined);
  mockLogAuditEvent.mockResolvedValue(undefined);
});

describe('sendPasswordResetEmail', () => {
  it('requests a reset email and returns generic success', async () => {
    const result = await sendPasswordResetEmail({ data: { email: 'admin@example.com' } });

    expect(result).toEqual({ success: true });
    expect(mockRequestPasswordReset).toHaveBeenCalledWith({
      body: { email: 'admin@example.com' },
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.password_reset_requested',
      userId: 'admin@example.com',
    });
  });

  it('does not leak when the account does not exist', async () => {
    mockRequestPasswordReset.mockRejectedValue(new Error('not found'));

    const result = await sendPasswordResetEmail({ data: { email: 'missing@example.com' } });

    expect(result).toEqual({ success: true });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.password_reset_requested',
      userId: 'missing@example.com',
    });
  });

  it('returns generic success and audits when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remainingAttempts: 0, blockedForMs: 1 });

    const result = await sendPasswordResetEmail({ data: { email: 'admin@example.com' } });

    expect(result).toEqual({ success: true });
    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.password_reset_requested',
        details: expect.objectContaining({ reason: 'rate_limited' }),
      })
    );
  });
});

describe('resetPassword', () => {
  const validInput = {
    token: 'reset-token-123',
    password: 'Str0ng!Passw0rd',
  };

  it('resets the password when policy passes', async () => {
    const result = await resetPassword({ data: validInput });

    expect(result).toEqual({ success: true });
    expect(mockResetPassword).toHaveBeenCalledWith({
      body: { token: validInput.token, newPassword: validInput.password },
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.password_reset_completed',
      // The reset token is deliberately not logged.
      userId: 'admin',
      details: { source: 'reset_token' },
    });
  });

  it('rejects a weak password', async () => {
    await expect(
      resetPassword({ data: { token: validInput.token, password: 'weak' } })
    ).rejects.toThrow(/Password does not meet the policy/i);

    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('rejects an empty password', async () => {
    await expect(
      resetPassword({ data: { token: validInput.token, password: '' } })
    ).rejects.toThrow(/Password does not meet the policy/i);
  });

  it('surfaces Better Auth reset failures', async () => {
    mockResetPassword.mockRejectedValue(new Error('expired token'));

    await expect(resetPassword({ data: validInput })).rejects.toThrow('expired token');
  });

  it('throws when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remainingAttempts: 0, blockedForMs: 1 });

    await expect(resetPassword({ data: validInput })).rejects.toThrow(/Too many attempts/);
    expect(mockResetPassword).not.toHaveBeenCalled();
  });
});
