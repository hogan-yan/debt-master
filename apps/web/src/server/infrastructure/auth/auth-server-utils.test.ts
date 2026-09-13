import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret';

vi.mock('@tanstack/start-server-core', () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
}));

const { getCookie, setCookie } = await import('@tanstack/start-server-core');
const authUtils = await import('./auth-server-utils');
const authCookie = await import('./auth-cookie');

const mockGetCookie = vi.mocked(getCookie);
const mockSetCookie = vi.mocked(setCookie);

describe('auth-server-utils sliding session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('refreshToken', () => {
    it('should produce a new token with the same payload', async () => {
      const payload = {
        isAdmin: true,
        permissions: ['view', 'edit'] as string[],
        username: 'alice',
      };
      const token = jwt.sign(payload, 'test-secret', { expiresIn: '1h' });

      const result = await authUtils.refreshToken(token);

      const decoded = jwt.verify(result, 'test-secret') as Record<string, unknown>;
      expect(decoded.isAdmin).toBe(true);
      expect(decoded.permissions).toEqual(['view', 'edit']);
      expect(decoded.username).toBe('alice');
      // New token should have a later expiry
      const originalDecoded = jwt.decode(token) as { exp: number };
      expect(typeof decoded.exp === 'number' && decoded.exp > originalDecoded.exp).toBe(true);
    });

    it('should throw if verify fails', async () => {
      await expect(authUtils.refreshToken('bad-token')).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('getAuthFromCookie', () => {
    it('should refresh a valid token and call setCookie', async () => {
      const token = jwt.sign(
        { isAdmin: false, permissions: ['view'], username: 'bob' },
        'test-secret',
        { expiresIn: '1h' }
      );
      mockGetCookie.mockReturnValue(token);

      const result = await authCookie.getAuthFromCookie();

      expect(mockGetCookie).toHaveBeenCalledWith('debt-master-auth');
      expect(mockSetCookie).toHaveBeenCalledWith('debt-master-auth', expect.any(String), {
        path: '/',
        sameSite: 'lax',
        maxAge: expect.any(Number),
        secure: false,
        httpOnly: true,
      });
      expect(result).toEqual({ isAdmin: false, permissions: ['view'], username: 'bob' });

      const call = mockSetCookie.mock.calls[0];
      if (call === undefined) throw new Error('Expected setCookie to be called');
      const refreshedToken = call[1] as string;
      const decoded = jwt.verify(refreshedToken, 'test-secret') as Record<string, unknown>;
      expect(decoded.username).toBe('bob');
    });

    it('should return null when no cookie is present', async () => {
      mockGetCookie.mockReturnValue(undefined);

      const result = await authCookie.getAuthFromCookie();

      expect(result).toBeNull();
      expect(mockSetCookie).not.toHaveBeenCalled();
    });

    it('should return null when token is invalid', async () => {
      mockGetCookie.mockReturnValue('bad-token');

      const result = await authCookie.getAuthFromCookie();

      expect(result).toBeNull();
      expect(mockSetCookie).not.toHaveBeenCalled();
    });
  });

  describe('requireAuthFromCookie', () => {
    it('should refresh token and set cookie for valid auth', async () => {
      const token = jwt.sign({ isAdmin: false, permissions: ['view'] }, 'test-secret', {
        expiresIn: '1h',
      });
      mockGetCookie.mockReturnValue(token);

      const result = await authCookie.requireAuthFromCookie();

      expect(result).toEqual({ isAdmin: false, permissions: ['view'] });
      expect(mockSetCookie).toHaveBeenCalledWith('debt-master-auth', expect.any(String), {
        path: '/',
        sameSite: 'lax',
        maxAge: expect.any(Number),
        secure: false,
        httpOnly: true,
      });
    });

    it('should throw when cookie is missing', async () => {
      mockGetCookie.mockReturnValue(undefined);

      await expect(authCookie.requireAuthFromCookie()).rejects.toThrow('Authentication required');
    });
  });

  describe('extractToken', () => {
    it('extracts token from object with token property', () => {
      expect(authUtils.extractToken({ token: 'abc123' })).toBe('abc123');
    });

    it('returns null for object without token', () => {
      expect(authUtils.extractToken({})).toBeNull();
    });

    it('returns null for non-string token', () => {
      expect(authUtils.extractToken({ token: 123 })).toBeNull();
    });

    it('extracts token from FormData', () => {
      const fd = new FormData();
      fd.append('token', 'form-token');
      expect(authUtils.extractToken(fd)).toBe('form-token');
    });

    it('returns null for FormData without token', () => {
      const fd = new FormData();
      expect(authUtils.extractToken(fd)).toBeNull();
    });

    it('returns null for unknown input', () => {
      expect(authUtils.extractToken('string')).toBeNull();
      expect(authUtils.extractToken(42)).toBeNull();
    });
  });

  describe('validateTokenPayload', () => {
    it('validates correct payload', () => {
      const result = authUtils.validateTokenPayload({
        isAdmin: true,
        permissions: ['view'],
      });
      expect(result.isAdmin).toBe(true);
    });

    it('throws for invalid payload', () => {
      expect(() => authUtils.validateTokenPayload({ isAdmin: 'yes' })).toThrow();
    });
  });
});

describe('auth-server-utils module configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret' };
  });

  afterEach(() => {
    vi.doUnmock('jsonwebtoken');
    process.env = originalEnv;
  });

  it('uses numeric seconds for expiry values outside the lookup table', async () => {
    process.env.JWT_EXPIRY_DAYS = '4';

    const module = await import('./auth-server-utils');

    expect(module.getJwtExpiry()).toBe('345600');
  });

  it('rejects a non-positive configured expiry during module initialization', async () => {
    process.env.JWT_EXPIRY_DAYS = '-1';

    await expect(import('./auth-server-utils')).rejects.toThrow(
      'JWT_EXPIRY_DAYS must be a positive number'
    );
  });

  it('rejects a missing JWT secret when it is accessed', async () => {
    delete process.env.JWT_SECRET;

    const module = await import('./auth-server-utils');

    expect(() => module.getJwtSecret()).toThrow('JWT_SECRET environment variable is required');
  });

  it('rejects a short JWT secret in production', async () => {
    const module = await import('./auth-server-utils');

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      // 'test-secret' is 11 chars — well under the 32-char production floor.
      expect(() => module.getJwtSecret()).toThrow('at least 32 characters');
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('uses the module namespace when jsonwebtoken has no default export', async () => {
    vi.doMock('jsonwebtoken', () => ({
      default: undefined,
      verify: vi.fn(),
    }));

    const module = await import('./auth-server-utils');

    await expect(module.getJwt()).resolves.toMatchObject({ verify: expect.any(Function) });
  });

  it('starts periodic cleanup in a server runtime', async () => {
    vi.stubGlobal('window', undefined);
    const interval = vi.spyOn(globalThis, 'setInterval').mockImplementation(() => 0 as never);

    await import('./auth-server-utils');

    expect(interval).toHaveBeenCalledWith(expect.any(Function), 10 * 60 * 1000);
    interval.mockRestore();
    vi.unstubAllGlobals();
  });
});
