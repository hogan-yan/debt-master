import { beforeEach, describe, expect, it, vi } from 'vitest';

// createServerFn → chainable builder that returns the handler directly
// (schema validation is exercised by the zod schema's own tests).
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

const {
  mockCount,
  mockFindUnique,
  mockSignUpEmail,
  mockIsLocalSetupAllowed,
  mockLogAuditEvent,
  authConfig,
} = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockFindUnique: vi.fn(),
  mockSignUpEmail: vi.fn(),
  mockIsLocalSetupAllowed: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  authConfig: { authProvider: 'better-auth' as string },
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    betterAuthUser: {
      count: () => mockCount(),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('@/server/infrastructure/config', () => ({ infraConfig: authConfig }));

vi.mock('@/server/infrastructure/network', () => ({
  isLocalSetupAllowed: () => mockIsLocalSetupAllowed(),
}));

vi.mock('@/server/infrastructure/auth/better-auth-instance', () => {
  const instance = { api: { signUpEmail: (...args: unknown[]) => mockSignUpEmail(...args) } };
  return { getAuth: () => instance };
});

vi.mock('@/server/infrastructure/audit-log', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

const { createFirstAdmin, isFirstRun } = await import('./setup');

const validInput = {
  name: 'Admin',
  email: 'admin@example.com',
  password: 'Str0ng!Passw0rd',
  setupToken: '',
};

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.SETUP_TOKEN;
  authConfig.authProvider = 'better-auth';
  mockCount.mockResolvedValue(0);
  mockIsLocalSetupAllowed.mockReturnValue(true);
  mockSignUpEmail.mockResolvedValue({});
  mockFindUnique.mockResolvedValue({ id: 'user-1', email: validInput.email });
  mockLogAuditEvent.mockResolvedValue(undefined);
});

describe('isFirstRun', () => {
  it('requires setup when better-auth and zero admins', async () => {
    mockCount.mockResolvedValue(0);
    expect(await isFirstRun()).toEqual({ setupRequired: true });
  });

  it('does not require setup once an admin exists', async () => {
    mockCount.mockResolvedValue(1);
    expect(await isFirstRun()).toEqual({ setupRequired: false });
  });

  it('never requires setup under the authentik provider', async () => {
    authConfig.authProvider = 'authentik';
    mockCount.mockResolvedValue(0);
    expect(await isFirstRun()).toEqual({ setupRequired: false });
  });
});

describe('createFirstAdmin', () => {
  it('creates the admin when all gates pass', async () => {
    const result = await createFirstAdmin({ data: validInput });
    expect(result).toEqual({ success: true });
    expect(mockSignUpEmail).toHaveBeenCalledWith({
      body: {
        email: validInput.email,
        password: validInput.password,
        name: validInput.name,
      },
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.setup_completed',
      userId: 'user-1',
      details: { email: validInput.email },
    });
  });

  it('logs the setup email when the new user cannot be reloaded', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(createFirstAdmin({ data: validInput })).resolves.toEqual({ success: true });

    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      action: 'admin.setup_completed',
      userId: validInput.email,
      details: { email: validInput.email },
    });
  });

  it('refuses when the provider is not better-auth', async () => {
    authConfig.authProvider = 'authentik';
    const result = (await createFirstAdmin({ data: validInput })) as {
      success: false;
      error: string;
    };
    expect(result.success).toBe(false);
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });

  it('locks once an admin already exists', async () => {
    mockCount.mockResolvedValue(1);
    const result = (await createFirstAdmin({ data: validInput })) as {
      success: false;
      error: string;
    };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });

  it('refuses when reached from a public network', async () => {
    mockIsLocalSetupAllowed.mockReturnValue(false);
    const result = (await createFirstAdmin({ data: validInput })) as {
      success: false;
      error: string;
    };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/private\/local network/i);
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });

  it('requires the configured setup token when SETUP_TOKEN is set', async () => {
    process.env.SETUP_TOKEN = 'secret-token';
    const result = (await createFirstAdmin({
      data: { ...validInput, setupToken: 'wrong' },
    })) as { success: false; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid setup token/i);
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });

  it('treats a missing setupToken field as empty when SETUP_TOKEN is set', async () => {
    process.env.SETUP_TOKEN = 'secret-token';
    const result = (await createFirstAdmin({
      data: { ...validInput, setupToken: undefined },
    })) as { success: false; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid setup token/i);
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });

  it('accepts the configured setup token', async () => {
    process.env.SETUP_TOKEN = 'secret-token';
    const result = await createFirstAdmin({
      data: { ...validInput, setupToken: 'secret-token' },
    });
    expect(result).toEqual({ success: true });
  });

  it('rejects a password that does not meet the policy', async () => {
    const result = (await createFirstAdmin({
      data: { ...validInput, password: 'weak' },
    })) as { success: false; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Password does not meet the policy/i);
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });

  it('surfaces a generic error when sign-up fails', async () => {
    mockSignUpEmail.mockRejectedValue(new Error('boom'));
    const result = (await createFirstAdmin({ data: validInput })) as {
      success: false;
      error: string;
    };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to create/i);
  });
});
