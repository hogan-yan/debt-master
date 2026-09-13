import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());
const { mockGetRequestHeader, mockDeleteCookie } = vi.hoisted(() => ({
  mockGetRequestHeader: vi.fn(),
  mockDeleteCookie: vi.fn(),
}));

vi.mock('@tanstack/start-server-core', () => ({
  getRequestHeader: (name: string) => mockGetRequestHeader(name),
  deleteCookie: (...args: unknown[]) => mockDeleteCookie(...args),
}));

vi.mock('@/utils/errors', () => ({
  AppError: class AppError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', AUTH_ADMIN_REQUIRED: 'AUTH_ADMIN_REQUIRED' },
}));

vi.mock('./better-auth-instance', () => {
  const instance = {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  };
  return { getAuth: () => instance };
});

import { betterAuthAdapter } from './better-auth-adapter';

const adminIdentity = {
  isAdmin: true,
  username: 'admin@example.com',
  accessCodeId: null,
  permissions: ['view', 'create', 'edit', 'delete'],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRequestHeader.mockReturnValue('better-auth.session_token=tok');
});

describe('betterAuthAdapter.getCurrentUser', () => {
  it('returns null when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await betterAuthAdapter.getCurrentUser()).toBeNull();
  });

  it('maps a BA session to an admin identity', async () => {
    mockGetSession.mockResolvedValue({
      session: { user: { email: 'admin@example.com', name: 'Admin' } },
    });
    expect(await betterAuthAdapter.getCurrentUser()).toEqual(adminIdentity);
  });

  it('maps a top-level Better Auth user', async () => {
    mockGetSession.mockResolvedValue({
      user: { email: 'admin@example.com', name: 'Admin' },
      session: { id: 'session-1' },
    });

    expect(await betterAuthAdapter.getCurrentUser()).toEqual(adminIdentity);
  });

  it('falls back to name when email is absent', async () => {
    mockGetSession.mockResolvedValue({ session: { user: { name: 'Admin' } } });
    expect((await betterAuthAdapter.getCurrentUser())?.username).toBe('Admin');
  });

  it('does not use non-string Better Auth profile fields as an identity', async () => {
    mockGetSession.mockResolvedValue({
      user: { email: 123, name: { display: 'Admin' } },
      session: { id: 'session-1' },
    });

    expect(await betterAuthAdapter.getCurrentUser()).toEqual({
      ...adminIdentity,
      username: null,
    });
  });

  it('handles a nested profile when the top-level user shape is invalid', async () => {
    mockGetSession.mockResolvedValue({
      user: 'invalid',
      session: { user: { email: 123, name: null } },
    });

    expect((await betterAuthAdapter.getCurrentUser())?.username).toBeNull();
  });

  it('falls back to the outer session when session.session is not a record', async () => {
    mockGetSession.mockResolvedValue({
      user: 'invalid',
      session: null,
    });

    expect(await betterAuthAdapter.getCurrentUser()).toBeNull();
  });

  it('returns null when the user object is missing', async () => {
    mockGetSession.mockResolvedValue({ session: {} });
    expect(await betterAuthAdapter.getCurrentUser()).toBeNull();
  });

  it('does not send a cookie header when the request has none', async () => {
    mockGetRequestHeader.mockReturnValue(undefined);
    mockGetSession.mockResolvedValue(null);

    await betterAuthAdapter.getCurrentUser();

    expect(mockGetSession).toHaveBeenCalledWith({ headers: new Headers() });
  });
});

describe('betterAuthAdapter.requireAuth / requireAdmin', () => {
  it('requireAuth resolves the identity', async () => {
    mockGetSession.mockResolvedValue({
      session: { user: { email: 'admin@example.com' } },
    });
    expect(await betterAuthAdapter.requireAuth()).toEqual(adminIdentity);
  });

  it('requireAuth rejects when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(betterAuthAdapter.requireAuth()).rejects.toThrow('Authentication required');
  });

  it('requireAdmin resolves (BA users are always admin)', async () => {
    mockGetSession.mockResolvedValue({
      session: { user: { email: 'admin@example.com' } },
    });
    expect((await betterAuthAdapter.requireAdmin()).isAdmin).toBe(true);
  });

  it('requireAdmin rejects when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(betterAuthAdapter.requireAdmin()).rejects.toThrow('Authentication required');
  });
});

describe('betterAuthAdapter.signInUrl', () => {
  it('points at the app login page with the redirect preserved', async () => {
    const url = await betterAuthAdapter.signInUrl('/expenses');
    expect(url).toBe('/login?redirect=%2Fexpenses');
  });

  it('defaults the target to home when no redirect', async () => {
    const url = await betterAuthAdapter.signInUrl('');
    expect(url).toBe('/login?redirect=%2F');
  });
});

describe('betterAuthAdapter.signOut', () => {
  it('revokes the session and clears both BA cookies', async () => {
    mockSignOut.mockResolvedValue({ success: true });
    await betterAuthAdapter.signOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    // session token + cookie-cache companion
    expect(mockDeleteCookie).toHaveBeenCalledTimes(2);
    const names = mockDeleteCookie.mock.calls.map((c) => c[0]);
    expect(names).toEqual(['better-auth.session_token', 'better-auth.session_token.cookie-cache']);
  });

  it('still clears cookies when signOut rejects', async () => {
    mockSignOut.mockRejectedValue(new Error('already revoked'));
    await betterAuthAdapter.signOut();
    expect(mockDeleteCookie).toHaveBeenCalledTimes(2);
  });

  it('clears secure cookie names in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mockSignOut.mockResolvedValue({ success: true });

    await betterAuthAdapter.signOut();

    expect(mockDeleteCookie.mock.calls.map(([name]) => name)).toEqual([
      '__Secure-better-auth.session_token',
      '__Secure-better-auth.session_token.cookie-cache',
    ]);
    vi.unstubAllEnvs();
  });
});
