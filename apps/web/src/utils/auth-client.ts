// Client-side authentication utilities.
//
// The auth TOKEN is never held client-side: it lives only in the httpOnly
// `debt-master-auth` cookie, set by the server, unreadable by JS. These helpers
// cover only non-sensitive client concerns: OAuth state, redirect safety,
// callback parsing, auth-error detection, and logout (which delegates to the
// server so the httpOnly cookie is actually cleared).

import { logout as logoutServerFn } from '@/server/auth';
import { AUTH_ERROR_CODES, isAppError } from '@/utils/errors';

/**
 * Logout: clear the httpOnly auth cookie via the server fn, then drop the
 * non-sensitive redirect hint. The token is server-managed, so there is no
 * client token store to clear.
 */
export const logout = async (): Promise<void> => {
  try {
    await logoutServerFn();
  } catch {
    // best-effort: the server may already be unreachable
  }
  localStorage.removeItem('debt-master-redirect');
};

/**
 * Store OAuth state for verification (non-sensitive CSRF nonce).
 */
export const storeOAuthParams = (state: string) => {
  localStorage.setItem('debt-master-oauth-state', state);
};

/**
 * Get stored OAuth state for verification.
 */
export const getStoredOAuthState = (): string | null => {
  return localStorage.getItem('debt-master-oauth-state');
};

/**
 * Clear OAuth parameters after use.
 */
export const clearOAuthParams = () => {
  localStorage.removeItem('debt-master-oauth-state');
};

/**
 * Validate that a redirect URL is safe (same-origin relative path only).
 * Rejects absolute URLs, protocol-relative URLs, and URLs with embedded auth.
 */
export function isSafeRedirectUrl(url: string): boolean {
  if (!url.startsWith('/')) return false;
  if (url.startsWith('//')) return false;
  if (url.includes('\0')) return false;
  return true;
}

/**
 * Parse OAuth callback URL parameters.
 */
export const parseOAuthCallback = (url: string) => {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);

    return {
      code: params.get('code'),
      state: params.get('state'),
      error: params.get('error'),
      errorDescription: params.get('error_description'),
    };
  } catch {
    return {
      code: null,
      state: null,
      error: 'invalid_callback_url',
      errorDescription: 'The callback URL is malformed',
    };
  }
};

/**
 * Verify OAuth state parameter matches stored value.
 */
export const verifyOAuthState = (receivedState: string): boolean => {
  const storedState = getStoredOAuthState();
  return storedState === receivedState;
};

/**
 * Check if an error is an authentication error.
 */
export const isAuthError = (error: unknown): boolean => {
  // Structured error code first (AppError), then message fallback.
  if (isAppError(error) && AUTH_ERROR_CODES.has(error.code)) return true;
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('authentication required') ||
    message.includes('invalid or expired token') ||
    message.includes('admin access required') ||
    message.includes('no token provided')
  );
};
