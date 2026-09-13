# Test cases — Authentication, sessions, setup, password reset, 2FA

**Common preconditions (all cases):** staging env reachable; seed data loaded; Turnstile keys configured only where the case says so; account list per TEST-PLAN §3. Cases run against `/login`, `/setup`, `/forgot-password`, `/reset-password`, `/settings`.

---

## AUTH-001: Admin login with valid email and password
**Priority:** P0 **Type:** Functional
### Preconditions
- better-auth provider; admin `admin@test.local` exists; 2FA disabled for the account.
### Test Steps
1. Open `/login`. **Expected:** email + password form renders; Authentik button hidden when provider is better-auth.
2. Enter valid credentials, submit. **Expected:** redirect to `/` (dashboard); `debt-master-auth` cookie set, httpOnly.
3. Reload the page. **Expected:** still authenticated; no login prompt.

## AUTH-002: Login with wrong password
**Priority:** P0 **Type:** Security
1. Enter valid email + wrong password, submit. **Expected:** error shown; message identical in wording to AUTH-003 (no hint the account exists).
2. Check audit log (Settings → audit). **Expected:** failed admin login recorded; no password value stored.

## AUTH-003: Login with non-existent email
**Priority:** P1 **Type:** Security
1. Enter `nobody@test.local` + any password, submit. **Expected:** same generic error as AUTH-002; response time not conspicuously longer.

## AUTH-004: Login with empty fields
**Priority:** P2 **Type:** Functional
1. Submit with both fields empty. **Expected:** inline validation messages; no network request in devtools.
2. Enter valid email + empty password, submit. **Expected:** password-required validation; no request.

## AUTH-005: Login rate limiting
**Priority:** P0 **Type:** Security
### Preconditions
- better-auth limiter defaults (10/60s); fresh IP or cleared store.
1. Submit 11 rapid login attempts (any credentials). **Expected:** 11th blocked with a rate-limit message; no bypass by retrying.
2. Wait for the window to pass. **Expected:** login works again.

## AUTH-006: Access-code login with valid code
**Priority:** P0 **Type:** Functional
### Preconditions
- Active access code `TESTCODE1` exists, not bound to a colleague (unbound).
1. On `/login`, switch to access-code mode, enter `TESTCODE1`, submit. **Expected:** success; colleague session issued (`isAdmin: false`, `permissions: ['view']`); `lastUsed` timestamp updated in DB.
2. Attempt to open `/settings`. **Expected:** blocked (admin-only) — redirect or admin-required message.

## AUTH-007: Access-code login with invalid code
**Priority:** P0 **Type:** Security
1. Enter `WRONGCODE`, submit. **Expected:** `Invalid or inactive access code`; audit `access_code.failed` has `codeHash`, never the raw code.
2. Enter a 3-character code. **Expected:** client-side minimum-length validation; no request.

## AUTH-008: Access-code login with deactivated code
**Priority:** P0 **Type:** Security
### Preconditions
- Code `DEADCODE` deactivated via Settings.
1. Log in with `DEADCODE`. **Expected:** `Invalid or inactive access code`; no session issued.

## AUTH-009: Access-code login with soft-deleted code
**Priority:** P1 **Type:** Security
### Preconditions
- Code deleted via Settings (soft delete, `deletedAt` set).
1. Log in with the deleted code. **Expected:** same generic invalid/inactive error; code not listed in Settings anymore.

## AUTH-010: Access-code rate limit — per-code bucket
**Priority:** P0 **Type:** Security
1. From one IP, enter the same wrong code 5 times. **Expected:** first 4 allowed through to validation, 5th+ blocked with `Too many failed attempts… 15 minutes` style message (1-minute singular wording when < 2 min).
2. Try a DIFFERENT wrong code from the same IP. **Expected:** allowed (per-code bucket is separate) until the per-IP bucket trips.

## AUTH-011: Access-code rate limit — per-IP bucket (code enumeration)
**Priority:** P0 **Type:** Security
1. From one IP, submit 20 different wrong codes. **Expected:** subsequent attempts with any NEW code are also blocked (IP bucket), before any DB lookup.
2. From a second IP, try a code. **Expected:** allowed — buckets are per client.

## AUTH-012: Turnstile enforced on access-code login (configured)
**Priority:** P0 **Type:** Security
### Preconditions
- `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` set; widget renders on the access-code form.
1. Submit a valid code WITHOUT completing the widget. **Expected:** `Security verification is required`; no code lookup (server rejects first).
2. Fail the challenge, submit. **Expected:** `Security verification failed. Please try again.`; audit reason `turnstile_rejected`.
3. Complete the challenge, submit a valid code. **Expected:** login succeeds.
4. Repeat AUTH-001 on the **admin email/password** form under the same config (widget initializes for both forms). **Expected:** admin login succeeds with the widget; a token-less replay of the admin login request is rejected server-side — enforcement is per-request, not per-form.
5. Capture the Turnstile token from a successful login (devtools) and replay the same request with it. **Expected:** rejected — tokens are single-use.

## AUTH-013: Turnstile skipped when not configured
**Priority:** P1 **Type:** Functional
### Preconditions
- Turnstile keys removed; app restarted.
1. Submit a valid code with no widget on the form. **Expected:** login succeeds; no turnstile call in devtools.

## AUTH-014: Authentik OAuth — happy path (new user becomes admin)
**Priority:** P0 **Type:** Integration
### Preconditions
- `AUTH_PROVIDER=authentik`; test user exists in Authentik; no matching local user.
1. Click the Authentik button on `/login`. **Expected:** redirect to Authentik authorize URL with a `state` param; `debt-master-oidc-state` cookie set, httpOnly, 10-minute expiry.
2. Authenticate at Authentik. **Expected:** callback returns to the app; local user created with `isAdmin: true`; admin session issued; audit `admin.login` with provider `authentik`.

## AUTH-015: Authentik OAuth — state mismatch rejected (login CSRF)
**Priority:** P0 **Type:** Security
1. Start OAuth (state cookie issued), then craft/complete the callback with a different `state` value. **Expected:** `Invalid or expired login attempt`; no token exchange request goes out; no session issued.
2. Reuse an old consumed state. **Expected:** same rejection (cookie was cleared on first use).

## AUTH-016: Authentik OAuth — existing non-admin NOT escalated
**Priority:** P0 **Type:** Security
### Preconditions
- Colleague-bound username `colleague1` exists locally as non-admin; an Authentik account with the same preferred_username exists.
1. Complete OAuth with that Authentik account. **Expected:** login refused, `This account does not have admin access.`; `users.is_admin` still false in DB; audit `admin.login_refused`; no auth cookie set.

## AUTH-017: Authentik callback when provider is better-auth
**Priority:** P1 **Type:** Security
1. With `AUTH_PROVIDER=better-auth`, POST the callback route directly with a code+state. **Expected:** refused (`Authentik login is not enabled on this instance.`); no session.

## AUTH-018: Logout clears the session
**Priority:** P0 **Type:** Functional
1. As any authenticated user, log out. **Expected:** `debt-master-auth` cookie cleared; navigating to `/` redirects to `/login`; audit `admin.logout` for admin sessions only.

## AUTH-019: Session cookie refresh on activity
**Priority:** P2 **Type:** Functional
### Preconditions
- `JWT_EXPIRY_DAYS=30`; note the cookie's expiry timestamp.
1. Make several authenticated requests (navigate pages). **Expected:** cookie expiry moves forward (sliding refresh); user not logged out mid-work.

## AUTH-020: Tampered auth cookie is rejected, not a 500
**Priority:** P1 **Type:** Security
1. Set the cookie to garbage (`debt-master-auth=garbage`) and load any page or a storage URL. **Expected:** treated as signed-out (401/redirect), never a 500 error page.

## AUTH-021: Deactivated access code leaves no working session
**Priority:** P1 **Type:** Security
### Preconditions
- Colleague logged in with `CODE-A`; admin then deactivates `CODE-A`.
1. Colleague continues using the existing session for up to 30 days (documented gap). **Expected (current):** session still works — **known issue, documented**; verify the audit at least records deactivation.
> NOTE: this is an accepted gap in the current build; if fixed, this case flips to Expected: session refused on next request.

## AUTH-022: Setup wizard — first-run happy path
**Priority:** P0 **Type:** Functional
### Preconditions
- Fresh DB with zero better-auth users; visiting from a private/loopback IP; `SETUP_TOKEN` unset (or matching token prepared).
1. Open `/`. **Expected:** redirected to `/setup` (setup-required state).
2. Create the admin (email, strong password, name). **Expected:** account created; wizard locks; login works.
3. Re-open `/setup`. **Expected:** refused — an admin already exists.

## AUTH-023: Setup wizard — SETUP_TOKEN required and validated
**Priority:** P0 **Type:** Security
### Preconditions
- Zero admins; `SETUP_TOKEN=Z token value` set.
1. Submit setup without the token. **Expected:** `Invalid setup token.`; no account created.
2. Submit with a wrong token, then the correct one. **Expected:** wrong → refused; correct → admin created. (Comparison is constant-time — not directly observable; code-reviewed.)

## AUTH-024: Setup wizard — public network refusal
**Priority:** P0 **Type:** Security
### Preconditions
- Request arrives via a proxy that reports a PUBLIC client IP (or forwarded header showing a public address).
1. Open `/setup` and submit. **Expected:** refused with the local-network message; fallback guidance (`bun run create:admin`) shown in docs; no account created.

## AUTH-025: Forgot password — request email
**Priority:** P0 **Type:** Integration
### Preconditions
- SMTP sandbox reachable; admin email known and unknown.
1. Submit the form for a real admin email. **Expected:** generic success screen; reset email arrives with a single-use link.
2. Submit for a non-existent email. **Expected:** identical generic success; NO email; response indistinguishable from step 1.

## AUTH-026: Forgot password — rate limited (email-bombing guard)
**Priority:** P1 **Type:** Security
1. Submit 6 requests within 15 minutes from one IP. **Expected:** from the 6th on, no emails are sent; UI still shows generic success; audit records `reason: rate_limited`.

## AUTH-027: Reset password — happy path + policy
**Priority:** P0 **Type:** Functional
1. Open the reset link, set a valid strong password. **Expected:** success; old password rejected at next login; new one accepted.
2. Try `weak` as the new password. **Expected:** policy error listing requirements; nothing changed.

## AUTH-028: Reset password — invalid/expired token + rate limit
**Priority:** P1 **Type:** Security
1. Use a consumed/expired token. **Expected:** error from better-auth; no password change.
2. Rapid-fire 6 token attempts from one IP. **Expected:** from the 6th, `Too many attempts. Please try again later.` and better-auth is never called.

## AUTH-029: Enable 2FA end-to-end
**Priority:** P0 **Type:** Functional
### Preconditions
- `ENABLE_2FA=true`; admin logged in without 2FA.
1. Settings → security → enable 2FA, confirm with password. **Expected:** TOTP QR/URI + backup codes shown.
2. Enter the current 6-digit code. **Expected:** 2FA marked active; audit `admin.2fa_enabled` with `finalized: true`.
3. Log out, log back in. **Expected:** TOTP challenge shown; correct code → session; wrong code → rejected.

## AUTH-030: Disable 2FA requires current password; rate limited
**Priority:** P1 **Type:** Security
1. Disable with the wrong password. **Expected:** rejected by better-auth; 2FA still active.
2. Disable with the correct password. **Expected:** 2FA off; audit `admin.2fa_disabled`.
3. Fire 11 verify/disable attempts from one IP. **Expected:** from the 11th, `Too many attempts. Please try again later.` with no better-auth call.

## AUTH-031: 2FA status when plugin disabled
**Priority:** P2 **Type:** Functional
### Preconditions
- `ENABLE_2FA=false`.
1. Open Settings → security. **Expected:** 2FA panel shows an unavailable/disabled state — not a broken enable button.

## AUTH-032: Legacy JWT secret strength
**Priority:** P1 **Type:** Security
### Preconditions
- Staging-like run with `NODE_ENV=production` and `JWT_SECRET` shorter than 32 chars.
1. Boot the container. **Expected:** fatal startup error (message recommends `openssl rand -base64 32`); app does NOT serve with a weak secret. Dev is unaffected.

## AUTH-033: Email verification required (`ENABLE_EMAIL_VERIFICATION=true`)
**Priority:** P2 **Type:** Integration
### Preconditions
- `ENABLE_EMAIL_VERIFICATION=true` (default false); SMTP sandbox reachable; app restarted; unit-tested config matrix exists — this case proves the runtime behavior.
1. Log in with valid admin credentials. **Expected:** sign-in is blocked pending verification and a verification email arrives; no authenticated session usable mid-state.
2. Complete verification from the emailed link. **Expected:** login now proceeds to the dashboard; reloading admin routes works normally.
3. Flip the flag back to `false`, restart, log in. **Expected:** plain credential login with no verification step (matches the default deployment posture).
