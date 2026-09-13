import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateAuthClient = vi.hoisted(() => vi.fn(() => ({ signIn: { email: vi.fn() } })));
const mockTwoFactorClient = vi.hoisted(() => vi.fn(() => 'two-factor-plugin'));

vi.mock('better-auth/react', () => ({
  createAuthClient: mockCreateAuthClient,
}));
vi.mock('better-auth/client/plugins', () => ({
  twoFactorClient: mockTwoFactorClient,
}));

describe('better-auth-client', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a client without the 2FA plugin by default', async () => {
    vi.stubEnv('PUBLIC_ENABLE_2FA', 'false');

    await import('@/utils/better-auth-client');

    expect(mockTwoFactorClient).not.toHaveBeenCalled();
    expect(mockCreateAuthClient).toHaveBeenCalledWith({ plugins: [] });
  });

  it('adds the 2FA client plugin when PUBLIC_ENABLE_2FA is true', async () => {
    vi.stubEnv('PUBLIC_ENABLE_2FA', 'true');

    await import('@/utils/better-auth-client');

    expect(mockTwoFactorClient).toHaveBeenCalled();
    expect(mockCreateAuthClient).toHaveBeenCalledWith({ plugins: ['two-factor-plugin'] });
  });
});
