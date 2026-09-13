import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetJwt, mockRequireAuth, mockRequireAdmin, mockDeleteCookie } = vi.hoisted(() => ({
  mockGetJwt: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockRequireAdmin: vi.fn(),
  mockDeleteCookie: vi.fn(),
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getJwtAuthFromCookie: () => mockGetJwt(),
  requireAuthFromCookie: () => mockRequireAuth(),
  requireAdminFromCookie: () => mockRequireAdmin(),
  deleteAuthCookieServer: () => mockDeleteCookie(),
}));

vi.mock('@/server/infrastructure/config', () => ({
  infraConfig: {
    authProvider: 'authentik',
    authentik: {
      baseUrl: 'https://auth.example.com',
      clientId: 'client-123',
      clientSecret: 'secret',
      redirectUri: 'https://app.example.com/auth/callback',
      scope: 'openid profile email',
    },
  },
}));

import { authentikAdapter } from './authentik-adapter';

const adminPayload = {
  isAdmin: true,
  permissions: ['view', 'edit'],
  username: 'admin',
  accessCodeId: null,
};
const userPayload = { isAdmin: false, permissions: ['view'], username: 'bob', accessCodeId: 7 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authentikAdapter.getCurrentUser', () => {
  it('returns null when no session', async () => {
    mockGetJwt.mockResolvedValue(null);
    expect(await authentikAdapter.getCurrentUser()).toBeNull();
  });

  it('maps a TokenPayload to an AuthUserIdentity', async () => {
    mockGetJwt.mockResolvedValue(userPayload);
    expect(await authentikAdapter.getCurrentUser()).toEqual({
      isAdmin: false,
      username: 'bob',
      accessCodeId: 7,
      permissions: ['view'],
    });
  });

  it('coerces undefined username/accessCodeId to null', async () => {
    mockGetJwt.mockResolvedValue({ isAdmin: true, permissions: [] });
    expect(await authentikAdapter.getCurrentUser()).toEqual({
      isAdmin: true,
      username: null,
      accessCodeId: null,
      permissions: [],
    });
  });
});

describe('authentikAdapter.requireAuth / requireAdmin', () => {
  it('requireAuth delegates to requireAuthFromCookie', async () => {
    mockRequireAuth.mockResolvedValue(userPayload);
    expect(await authentikAdapter.requireAuth()).toEqual({
      isAdmin: false,
      username: 'bob',
      accessCodeId: 7,
      permissions: ['view'],
    });
  });

  it('requireAdmin delegates to requireAdminFromCookie', async () => {
    mockRequireAdmin.mockResolvedValue(adminPayload);
    const identity = await authentikAdapter.requireAdmin();
    expect(identity.isAdmin).toBe(true);
    expect(identity.username).toBe('admin');
  });

  it('requireAdmin propagates the underlying rejection', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Admin access required'));
    await expect(authentikAdapter.requireAdmin()).rejects.toThrow('Admin access required');
  });
});

describe('authentikAdapter.signInUrl', () => {
  it('builds the OAuth authorize URL from infraConfig', async () => {
    const url = new URL(await authentikAdapter.signInUrl('/expenses'));
    expect(url.origin).toBe('https://auth.example.com');
    expect(url.pathname).toBe('/application/o/authorize/');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/auth/callback');
    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('authentikAdapter.signOut', () => {
  it('clears the auth cookie', async () => {
    await authentikAdapter.signOut();
    expect(mockDeleteCookie).toHaveBeenCalledTimes(1);
  });
});
