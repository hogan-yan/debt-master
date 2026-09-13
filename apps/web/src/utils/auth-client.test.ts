import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStorageState, storageState } from '@/test/helpers/local-storage-mock';
import { AppError, ErrorCode } from './errors';

const mockLogoutServerFn = vi.fn();

vi.mock('@/server/auth', () => ({
  logout: (...args: unknown[]) => mockLogoutServerFn(...args),
}));

const authClient = await import('./auth-client');

beforeEach(() => {
  vi.clearAllMocks();
  resetStorageState();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('logout', () => {
  it('invokes the server logout fn and drops the redirect hint', async () => {
    storageState['debt-master-redirect'] = '/somewhere';
    mockLogoutServerFn.mockResolvedValueOnce({ success: true });

    await authClient.logout();

    expect(mockLogoutServerFn).toHaveBeenCalledTimes(1);
    expect(storageState['debt-master-redirect']).toBeUndefined();
  });

  it('still clears the redirect hint when the server call throws', async () => {
    storageState['debt-master-redirect'] = '/somewhere';
    mockLogoutServerFn.mockRejectedValueOnce(new Error('server down'));

    await authClient.logout();

    expect(storageState['debt-master-redirect']).toBeUndefined();
  });
});

describe('storeOAuthParams / getStoredOAuthState / clearOAuthParams', () => {
  it('stores and retrieves OAuth state', () => {
    authClient.storeOAuthParams('state-123');
    expect(authClient.getStoredOAuthState()).toBe('state-123');
  });

  it('returns null when no OAuth state stored', () => {
    expect(authClient.getStoredOAuthState()).toBeNull();
  });

  it('clears OAuth state', () => {
    authClient.storeOAuthParams('state-456');
    authClient.clearOAuthParams();
    expect(authClient.getStoredOAuthState()).toBeNull();
  });
});

describe('parseOAuthCallback', () => {
  it('parses valid callback URL with code and state', () => {
    const result = authClient.parseOAuthCallback(
      'https://example.com/auth/callback?code=abc123&state=random-state'
    );
    expect(result.code).toBe('abc123');
    expect(result.state).toBe('random-state');
    expect(result.error).toBeNull();
    expect(result.errorDescription).toBeNull();
  });

  it('parses callback URL with error parameters', () => {
    const result = authClient.parseOAuthCallback(
      'https://example.com/auth/callback?error=access_denied&error_description=User+cancelled'
    );
    expect(result.code).toBeNull();
    expect(result.state).toBeNull();
    expect(result.error).toBe('access_denied');
    expect(result.errorDescription).toBe('User cancelled');
  });

  it('returns error for malformed URL', () => {
    const result = authClient.parseOAuthCallback('not-a-valid-url');
    expect(result.error).toBe('invalid_callback_url');
    expect(result.code).toBeNull();
    expect(result.state).toBeNull();
    expect(result.errorDescription).toBe('The callback URL is malformed');
  });

  it('handles empty URL string', () => {
    const result = authClient.parseOAuthCallback('');
    expect(result.error).toBe('invalid_callback_url');
  });
});

describe('verifyOAuthState', () => {
  it('returns true when state matches stored value', () => {
    authClient.storeOAuthParams('expected-state');
    expect(authClient.verifyOAuthState('expected-state')).toBe(true);
  });

  it('returns false when state does not match', () => {
    authClient.storeOAuthParams('expected-state');
    expect(authClient.verifyOAuthState('wrong-state')).toBe(false);
  });

  it('returns false when no state stored', () => {
    expect(authClient.verifyOAuthState('any-state')).toBe(false);
  });
});

describe('isSafeRedirectUrl', () => {
  it('accepts relative paths', () => {
    expect(authClient.isSafeRedirectUrl('/dashboard')).toBe(true);
  });

  it('rejects absolute URLs', () => {
    expect(authClient.isSafeRedirectUrl('https://evil.com')).toBe(false);
  });

  it('rejects protocol-relative URLs', () => {
    expect(authClient.isSafeRedirectUrl('//evil.com')).toBe(false);
  });

  it('rejects URLs with null bytes', () => {
    expect(authClient.isSafeRedirectUrl('/dashboard\0.evil.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(authClient.isSafeRedirectUrl('')).toBe(false);
  });
});

describe('isAuthError', () => {
  it('returns true for structured authentication AppErrors', () => {
    expect(
      authClient.isAuthError(
        new AppError(ErrorCode.AUTH_INVALID_TOKEN, 'opaque authentication error')
      )
    ).toBe(true);
  });

  it('returns true for known auth error messages', () => {
    expect(authClient.isAuthError(new Error('Authentication required'))).toBe(true);
    expect(authClient.isAuthError(new Error('Invalid or expired token'))).toBe(true);
    expect(authClient.isAuthError(new Error('Admin access required'))).toBe(true);
    expect(authClient.isAuthError(new Error('No token provided'))).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(authClient.isAuthError(new Error('AUTHENTICATION REQUIRED'))).toBe(true);
  });

  it('returns false for non-auth errors', () => {
    expect(authClient.isAuthError(new Error('Network timeout'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(authClient.isAuthError('string')).toBe(false);
    expect(authClient.isAuthError(42)).toBe(false);
    expect(authClient.isAuthError(null)).toBe(false);
  });
});
