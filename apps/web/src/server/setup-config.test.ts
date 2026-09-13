import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => {
  const createBuilder = () => {
    const builder = {
      validator: () => builder,
      inputValidator: () => builder,
      handler: (fn: () => Promise<unknown>) => fn,
    };
    return builder;
  };
  return { createServerFn: () => createBuilder() };
});

const { mockCount, authConfig } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  authConfig: { authProvider: 'better-auth' as string },
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    betterAuthUser: { count: () => mockCount() },
  },
}));

vi.mock('@/server/infrastructure/config', () => ({ infraConfig: authConfig }));

const { getSetupConfig } = await import('./setup-config');

describe('getSetupConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.SETUP_TOKEN;
    authConfig.authProvider = 'better-auth';
    mockCount.mockResolvedValue(0);
  });

  it('reports setup required and no token by default', async () => {
    expect(await getSetupConfig()).toEqual({ setupRequired: true, tokenRequired: false });
  });

  it('reports token required when SETUP_TOKEN is set', async () => {
    process.env.SETUP_TOKEN = 'secret';
    expect(await getSetupConfig()).toEqual({ setupRequired: true, tokenRequired: true });
  });

  it('reports setup not required once an admin exists', async () => {
    mockCount.mockResolvedValue(1);
    expect(await getSetupConfig()).toEqual({ setupRequired: false, tokenRequired: false });
  });

  it('reports setup not required under authentik', async () => {
    authConfig.authProvider = 'authentik';
    expect(await getSetupConfig()).toEqual({ setupRequired: false, tokenRequired: false });
  });
});
