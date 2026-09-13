import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { m } from '@/paraglide/messages';
import { handleAuthentikCallback } from '@/server/auth';
import {
  clearOAuthParams,
  isSafeRedirectUrl,
  parseOAuthCallback,
  verifyOAuthState,
} from '@/utils/auth-client';

/**
 * OAuth callback route component
 * Handles the redirect from Authentik after user authentication
 */
export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
  head: () => ({
    meta: [{ title: 'Signing in — Debt Master' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
});

/**
 * AuthCallback component handles the OAuth callback flow
 */
function AuthCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Parse the callback URL parameters
        const callbackParams = parseOAuthCallback(window.location.href);

        if (callbackParams.error) {
          // Redirect to login with error
          window.location.href = `/login?error=${encodeURIComponent(callbackParams.errorDescription || callbackParams.error)}`;
          return;
        }

        if (!callbackParams.code || !callbackParams.state) {
          window.location.href = `/login?error=${encodeURIComponent(m.auth_invalidCallback())}`;
          return;
        }

        // Verify the state parameter to prevent CSRF attacks
        if (!verifyOAuthState(callbackParams.state)) {
          window.location.href = `/login?error=${encodeURIComponent(m.auth_invalidState())}`;
          return;
        }

        // Exchange the authorization code for our internal token
        const result = await handleAuthentikCallback({
          data: {
            code: callbackParams.code,
            state: callbackParams.state,
          },
        });

        if (result.valid) {
          // The httpOnly auth cookie is set server-side by handleAuthentikCallback;
          // nothing sensitive is held client-side. Just clear the OAuth nonce.
          clearOAuthParams();

          // Check for stored redirect URL
          const storedRedirect = localStorage.getItem('debt-master-redirect');
          if (storedRedirect && isSafeRedirectUrl(storedRedirect)) {
            localStorage.removeItem('debt-master-redirect');
            window.location.href = storedRedirect;
          } else {
            // Redirect to dashboard
            window.location.href = '/';
          }
        } else {
          window.location.href = `/login?error=${encodeURIComponent(result.error || m.auth_failed())}`;
        }
      } catch (_error) {
        window.location.href = `/login?error=${encodeURIComponent(m.auth_failed())}`;
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">
            {m.auth_authenticating()}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{m.auth_authenticatingDesc()}</p>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ring mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
