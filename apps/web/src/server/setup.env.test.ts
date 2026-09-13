import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The SETUP_TOKEN warning lives at module scope, so it runs once at import
 * time under whatever NODE_ENV/SETUP_TOKEN the process carries. These tests
 * reset the module registry and import `./setup` under controlled env to
 * exercise both sides of that bootstrap guard.
 */

// createServerFn → chainable builder that returns the handler directly.
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

const { mockWarn, authConfig, mockAuditEvent, mockSignUpEmail, networkGate } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
  authConfig: { authProvider: 'better-auth' as string },
  mockAuditEvent: vi.fn(),
  mockSignUpEmail: vi.fn(),
  networkGate: { localAllowed: true },
}));

vi.mock('@/server/infrastructure/logger', () => ({
  createServerLogger: () => ({ warn: (...args: unknown[]) => mockWarn(...args) }),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    betterAuthUser: {
      count: () => Promise.resolve(0),
      findUnique: () => Promise.resolve({ id: 'user-1' }),
    },
  },
}));

vi.mock('@/server/infrastructure/config', () => ({ infraConfig: authConfig }));

vi.mock('@/server/infrastructure/network', () => ({
  isLocalSetupAllowed: () => Promise.resolve(networkGate.localAllowed),
}));

vi.mock('@/server/infrastructure/audit-log', () => ({
  logAuditEvent: (event: unknown) => {
    mockAuditEvent(event);
    return Promise.resolve(undefined);
  },
}));

vi.mock('@/server/infrastructure/auth/better-auth-instance', () => ({
  getAuth: () => ({ api: { signUpEmail: (...args: unknown[]) => mockSignUpEmail(...args) } }),
}));

describe('setup module bootstrap (SETUP_TOKEN warning)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSetupToken = process.env.SETUP_TOKEN;

  beforeEach(() => {
    mockWarn.mockClear();
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSetupToken === undefined) delete process.env.SETUP_TOKEN;
    else process.env.SETUP_TOKEN = originalSetupToken;
    vi.resetModules();
  });

  it('warns at import time in production when SETUP_TOKEN is unset', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SETUP_TOKEN;
    vi.resetModules();

    await import('./setup');

    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('SETUP_TOKEN is not set'));
  });

  it('stays quiet at import time when SETUP_TOKEN is configured', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SETUP_TOKEN = 'shared-secret';
    vi.resetModules();

    await import('./setup');

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('stays quiet outside production even without SETUP_TOKEN', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.SETUP_TOKEN;
    vi.resetModules();

    await import('./setup');

    expect(mockWarn).not.toHaveBeenCalled();
  });
});

describe('createFirstAdmin — SETUP_TOKEN vs the local-network gate', () => {
  const originalSetupToken = process.env.SETUP_TOKEN;
  const DENIAL =
    'For security, first-run setup must run from a private/local network, or via `bun run create:admin`.';

  beforeEach(() => {
    mockAuditEvent.mockClear();
    mockSignUpEmail.mockClear();
    mockSignUpEmail.mockResolvedValue(undefined);
    networkGate.localAllowed = true;
  });

  afterEach(() => {
    if (originalSetupToken === undefined) delete process.env.SETUP_TOKEN;
    else process.env.SETUP_TOKEN = originalSetupToken;
    vi.resetModules();
  });

  function callCreateFirstAdmin(
    mod: typeof import('./setup'),
    setupToken?: string
  ): Promise<unknown> {
    return mod.createFirstAdmin({
      data: {
        email: 'admin@example.com',
        password: 'Str0ng!Passw0rd!',
        name: 'Admin',
        ...(setupToken === undefined ? {} : { setupToken }),
      },
    });
  }

  it('lets a public-IP client proceed past the guard with a valid SETUP_TOKEN', async () => {
    process.env.SETUP_TOKEN = 'shared-secret';
    networkGate.localAllowed = false;
    const setup = await import('./setup');

    const result = await callCreateFirstAdmin(setup, 'shared-secret');

    expect(result).toEqual({ success: true });
    expect(mockSignUpEmail).toHaveBeenCalledTimes(1);
    expect(mockAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.setup_authorized',
        details: { reason: 'setup_token' },
      })
    );
    expect(mockAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.setup_denied' })
    );
  });

  it('denies a public-IP client exactly as before when no SETUP_TOKEN is configured', async () => {
    delete process.env.SETUP_TOKEN;
    networkGate.localAllowed = false;
    const setup = await import('./setup');

    const result = await callCreateFirstAdmin(setup);

    expect(result).toEqual({ success: false, error: DENIAL });
    expect(mockAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.setup_denied',
        details: { reason: 'public_ip' },
      })
    );
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });

  it('denies a public-IP client exactly as before when the provided SETUP_TOKEN mismatches', async () => {
    process.env.SETUP_TOKEN = 'shared-secret';
    networkGate.localAllowed = false;
    const setup = await import('./setup');

    const result = await callCreateFirstAdmin(setup, 'wrong-token');

    expect(result).toEqual({ success: false, error: DENIAL });
    expect(mockAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.setup_denied',
        details: { reason: 'public_ip' },
      })
    );
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });

  it('keeps private-IP behavior unchanged: no token configured proceeds without an authorization audit', async () => {
    delete process.env.SETUP_TOKEN;
    networkGate.localAllowed = true;
    const setup = await import('./setup');

    const result = await callCreateFirstAdmin(setup);

    expect(result).toEqual({ success: true });
    expect(mockSignUpEmail).toHaveBeenCalledTimes(1);
    expect(mockAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.setup_authorized' })
    );
    expect(mockAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.setup_denied' })
    );
  });

  it('keeps private-IP behavior unchanged: configured token must still match locally', async () => {
    process.env.SETUP_TOKEN = 'shared-secret';
    networkGate.localAllowed = true;
    const setup = await import('./setup');

    const result = await callCreateFirstAdmin(setup, 'wrong-token');

    expect(result).toEqual({ success: false, error: 'Invalid setup token.' });
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });
});
