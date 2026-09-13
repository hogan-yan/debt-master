import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable config so individual cases can vary `AUTH_PROVIDER`.
const config = vi.hoisted(() => ({ authProvider: 'authentik' as string }));
vi.mock('../config', () => ({ infraConfig: config }));

const mockBetterAuthAdapter = {
  getCurrentUser: vi.fn(),
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  signInUrl: vi.fn(),
  signOut: vi.fn(),
};
vi.mock('./better-auth-adapter', () => ({
  betterAuthAdapter: mockBetterAuthAdapter,
}));

const { getAuthAdapter, __resetAuthAdapterCacheForTests } = await import('./index');
const { authentikAdapter } = await import('./authentik-adapter');

describe('getAuthAdapter', () => {
  beforeEach(() => {
    __resetAuthAdapterCacheForTests();
    vi.clearAllMocks();
    config.authProvider = 'authentik';
  });

  it('returns the authentik adapter when provider is authentik', async () => {
    expect(await getAuthAdapter()).toBe(authentikAdapter);
  });

  it('dynamically imports + returns the better-auth adapter when provider is better-auth', async () => {
    config.authProvider = 'better-auth';
    expect(await getAuthAdapter()).toBe(mockBetterAuthAdapter);
  });

  it('caches the adapter across calls', async () => {
    const first = await getAuthAdapter();
    const second = await getAuthAdapter();
    expect(first).toBe(second);
  });

  it('throws an INFRASTRUCTURE_ERROR for an unsupported provider', async () => {
    config.authProvider = 'sso-magic';
    await expect(getAuthAdapter()).rejects.toThrow(/Unsupported auth provider: "sso-magic"/);
    // A failed resolution must not poison the cache.
    config.authProvider = 'authentik';
    expect(await getAuthAdapter()).toBe(authentikAdapter);
  });
});
