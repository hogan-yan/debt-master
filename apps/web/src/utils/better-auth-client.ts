/**
 * Better Auth browser client (DEBTCOM-2).
 *
 * Used by the login form to submit admin email/password sign-in. `createAuthClient`
 * resolves its baseURL to the app origin + `/api/auth` (the mount in `src/ssr.tsx`),
 * and manages the session cookie itself — no token is held in JS.
 */

import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

const plugins = [];
if (import.meta.env.PUBLIC_ENABLE_2FA === 'true') {
  plugins.push(twoFactorClient());
}

export const betterAuthClient = createAuthClient({
  plugins,
});
