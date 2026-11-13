/**
 * Swappable authentication adapter interface (DEBTCOM-1).
 *
 * The app supports two admin-login mechanisms behind a single interface:
 *   - {@link AuthentikAdapter}  — OAuth against a self-hosted Authentik deploy.
 *   - {@link BetterAuthAdapter} — email/password via `better-auth` (DEBTCOM-2).
 *
 * The current signed-in identity is always resolved from the request context
 * (httpOnly cookie / BA session) — there is no `request` parameter. This matches
 * TanStack Start's async-local-storage cookie access used elsewhere in the app.
 *
 * NOTE: colleague access-code login is orthogonal to this interface and stays on
 * the shared `debt-master-auth` JWT cookie regardless of the active provider.
 */

/**
 * Non-sensitive view of the signed-in user.
 * Never carries a token — only the fields the UI / guards need.
 */
export interface AuthUserIdentity {
  readonly isAdmin: boolean;
  readonly username: string | null;
  readonly accessCodeId: number | null;
  readonly permissions: readonly string[];
}

export interface AuthAdapter {
  /** Resolve the current user, or `null` when unauthenticated. Never throws. */
  getCurrentUser(): Promise<AuthUserIdentity | null>;

  /** Resolve the current user; reject (AUTH_REQUIRED) when unauthenticated. */
  requireAuth(): Promise<AuthUserIdentity>;

  /** Resolve the current user; reject when unauthenticated or not an admin. */
  requireAdmin(): Promise<AuthUserIdentity>;

  /** URL the browser should be sent to in order to begin admin sign-in. */
  signInUrl(redirectTo: string): Promise<string>;

  /** Tear down the current session (revoke server-side + clear the cookie). */
  signOut(): Promise<void>;
}
