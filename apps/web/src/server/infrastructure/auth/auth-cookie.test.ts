import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/start-server-core', () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock('@/server/infrastructure/auth', () => ({
  getAuthAdapter: vi.fn().mockResolvedValue({
    getCurrentUser: vi.fn().mockResolvedValue(null),
    requireAuth: vi.fn().mockRejectedValue(new Error('auth required')),
    requireAdmin: vi.fn().mockRejectedValue(new Error('admin required')),
    signInUrl: vi.fn().mockResolvedValue('/login'),
    signOut: vi.fn(),
  }),
}));

vi.mock('./auth-server-utils', () => ({
  getJwtExpirySeconds: vi.fn().mockReturnValue(3600),
  refreshToken: vi
    .fn()
    .mockImplementation((token: string) => Promise.resolve(`refreshed-${token}`)),
  verifyToken: vi.fn().mockImplementation((token: string) =>
    Promise.resolve({
      isAdmin: token.includes('admin'),
      permissions: ['view'],
      username: 'testuser',
      accessCodeId: token.includes('code') ? 7 : undefined,
    })
  ),
}));

const { mockIsAccessCodeActive } = vi.hoisted(() => ({
  mockIsAccessCodeActive: vi.fn(),
}));

vi.mock('@/server/infrastructure/auth/access-code-status', () => ({
  isAccessCodeActive: () => mockIsAccessCodeActive(),
  invalidateAccessCodeStatus: () => Promise.resolve(),
}));

const { getCookie, setCookie } = await import('@tanstack/start-server-core');
const { refreshToken } = await import('./auth-server-utils');
const { getAuthAdapter } = await import('@/server/infrastructure/auth');
const {
  setAuthCookieServer,
  deleteAuthCookieServer,
  getAuthFromCookie,
  requireAuthFromCookie,
  requireAdminFromCookie,
} = await import('./auth-cookie');

const mockGetCookie = vi.mocked(getCookie);
const mockSetCookie = vi.mocked(setCookie);
const mockRefreshToken = vi.mocked(refreshToken);
const mockGetAuthAdapter = vi.mocked(getAuthAdapter);

describe('auth-cookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAccessCodeActive.mockResolvedValue(true);
    mockGetAuthAdapter.mockResolvedValue({
      getCurrentUser: vi.fn().mockResolvedValue(null),
      requireAuth: vi.fn().mockRejectedValue(new Error('auth required')),
      requireAdmin: vi.fn().mockRejectedValue(new Error('admin required')),
      signInUrl: vi.fn().mockResolvedValue('/login'),
      signOut: vi.fn(),
    });
  });

  describe('setAuthCookieServer', () => {
    it('sets httpOnly cookie with correct options', async () => {
      await setAuthCookieServer('test-token');

      expect(mockSetCookie).toHaveBeenCalledWith(
        'debt-master-auth',
        'test-token',
        expect.objectContaining({
          path: '/',
          sameSite: 'lax',
          maxAge: 3600,
          httpOnly: true,
        })
      );
    });
  });

  describe('deleteAuthCookieServer', () => {
    it('clears cookie with empty value and maxAge 0', async () => {
      await deleteAuthCookieServer();

      expect(mockSetCookie).toHaveBeenCalledWith(
        'debt-master-auth',
        '',
        expect.objectContaining({
          path: '/',
          maxAge: 0,
          httpOnly: true,
        })
      );
    });
  });

  describe('getAuthFromCookie', () => {
    it('returns user when valid token exists', async () => {
      mockGetCookie.mockReturnValue('valid-token');

      const result = await getAuthFromCookie();

      expect(result).toEqual({
        isAdmin: false,
        permissions: ['view'],
        username: 'testuser',
      });
      expect(mockRefreshToken).toHaveBeenCalledWith('valid-token');
      expect(mockSetCookie).toHaveBeenCalledWith(
        'debt-master-auth',
        'refreshed-valid-token',
        expect.objectContaining({
          path: '/',
          sameSite: 'lax',
          maxAge: 3600,
        })
      );
    });

    it('falls back to the auth adapter when no JWT cookie', async () => {
      mockGetCookie.mockReturnValue(undefined);
      mockGetAuthAdapter.mockResolvedValue({
        getCurrentUser: vi.fn().mockResolvedValue({
          isAdmin: true,
          permissions: ['admin'],
          username: undefined,
          accessCodeId: undefined,
        }),
        requireAuth: vi.fn().mockRejectedValue(new Error('auth required')),
        requireAdmin: vi.fn().mockRejectedValue(new Error('admin required')),
        signInUrl: vi.fn().mockResolvedValue('/login'),
        signOut: vi.fn(),
      });

      const result = await getAuthFromCookie();

      expect(result).toEqual({
        isAdmin: true,
        permissions: ['admin'],
        username: undefined,
        accessCodeId: undefined,
      });
    });

    it('returns null when no token', async () => {
      mockGetCookie.mockReturnValue(undefined);

      const result = await getAuthFromCookie();

      expect(result).toBeNull();
      expect(mockSetCookie).not.toHaveBeenCalled();
    });

    it('returns null when token is empty string', async () => {
      mockGetCookie.mockReturnValue('');

      const result = await getAuthFromCookie();

      expect(result).toBeNull();
    });

    it('revokes a session whose access code was deactivated or deleted', async () => {
      mockGetCookie.mockReturnValue('code-token');
      mockIsAccessCodeActive.mockResolvedValue(false);

      const result = await getAuthFromCookie();

      expect(result).toBeNull();
      // Revoked cookies must never be refreshed — a fresh signature would
      // otherwise extend the session past the revocation.
      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(mockSetCookie).not.toHaveBeenCalled();
    });

    it('refreshes normally when the access code is still active', async () => {
      mockGetCookie.mockReturnValue('code-token');
      mockIsAccessCodeActive.mockResolvedValue(true);

      const result = await getAuthFromCookie();

      expect(result).toEqual({
        isAdmin: false,
        permissions: ['view'],
        username: 'testuser',
        accessCodeId: 7,
      });
      expect(mockRefreshToken).toHaveBeenCalledWith('code-token');
    });
  });

  describe('requireAuthFromCookie', () => {
    it('returns user when authenticated', async () => {
      mockGetCookie.mockReturnValue('valid-token');

      const result = await requireAuthFromCookie();

      expect(result).toEqual({
        isAdmin: false,
        permissions: ['view'],
        username: 'testuser',
      });
    });

    it('throws when not authenticated', async () => {
      mockGetCookie.mockReturnValue(undefined);

      await expect(requireAuthFromCookie()).rejects.toThrow('Authentication required');
    });
  });

  describe('requireAdminFromCookie', () => {
    it('returns admin user when admin token in cookie', async () => {
      mockGetCookie.mockReturnValue('admin-token');

      const result = await requireAdminFromCookie();

      expect(result).toEqual({
        isAdmin: true,
        permissions: ['view'],
        username: 'testuser',
      });
    });

    it('throws AUTH_REQUIRED when no cookie', async () => {
      mockGetCookie.mockReturnValue(undefined);

      await expect(requireAdminFromCookie()).rejects.toThrow('Authentication required');
    });

    it('throws AUTH_ADMIN_REQUIRED for non-admin token', async () => {
      mockGetCookie.mockReturnValue('valid-token');

      await expect(requireAdminFromCookie()).rejects.toThrow('Admin access required');
    });
  });
});
