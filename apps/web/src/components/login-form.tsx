import { Link } from '@tanstack/react-router';
import { Loader2, Shield } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useFormSubmission } from '@/hooks';
import { useTheme } from '@/hooks/use-theme';
import { type LoginFormSchema, loginFormSchema } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { getAuthentikAuthUrl, getAuthProvider, validateAccessCode } from '@/server/auth';
import { getTurnstileSiteKey } from '@/server/turnstile';
import { AUTH } from '@/test/test-ids';
import { isSafeRedirectUrl, storeOAuthParams } from '@/utils/auth-client';
import { betterAuthClient } from '@/utils/better-auth-client';
import {
  accessCodeFieldError,
  assertValidAccessCode,
  resolvePostLoginHref,
} from './login-redirect';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Form, FormSubmit } from './ui/form';
import { FormInput } from './ui/form-fields';
import { TurnstileWidget } from './ui/turnstile-widget';

interface LoginFormProps extends React.ComponentPropsWithoutRef<'div'> {
  redirectTo?: string | undefined;
}

export function LoginForm({ className, redirectTo, ...props }: LoginFormProps) {
  const { effectiveTheme } = useTheme();

  // Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [isTurnstileEnabled, setIsTurnstileEnabled] = useState(false);

  // Resolved admin-login provider ('authentik' | 'better-auth'). Determines
  // whether the admin section renders the OAuth button or the email/password
  // form. Null while resolving (falls back to the Authentik button).
  const [authProvider, setAuthProvider] = useState<string | null>(null);

  // Better Auth two-factor login step state.
  const [adminLoginStep, setAdminLoginStep] = useState<'email' | 'totp'>('email');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // Initialize Turnstile + resolve the auth provider on mount
  useEffect(() => {
    const initTurnstile = async () => {
      try {
        const config = await getTurnstileSiteKey();
        if (config.isConfigured) {
          setTurnstileSiteKey(config.siteKey);
          setIsTurnstileEnabled(true);
        }
      } catch (_error) {
        setIsTurnstileEnabled(false);
      }
    };

    const initAuthProvider = async () => {
      try {
        setAuthProvider(await getAuthProvider());
      } catch (_error) {
        // Default to the Authentik UI if the provider can't be resolved.
        setAuthProvider('authentik');
      }
    };

    initTurnstile();
    initAuthProvider();
  }, []);

  const { isSubmitting, handleSubmit } = useFormSubmission({
    onSuccess: () => {
      // Full reload so AuthContext re-resolves from the new httpOnly cookie.
      // Client-side navigation would see stale auth state and bounce back to /login.
      window.location.href = resolvePostLoginHref(redirectTo, isSafeRedirectUrl);
    },
    successTitle: m.login_successTitle(),
    successMessage: m.login_successMessage(),
    errorTitle: m.login_errorTitle(),
  });

  /**
   * Handle Turnstile verification success
   */
  const handleTurnstileVerify = (token: string) => {
    setTurnstileToken(token);
    setTurnstileError(null);
  };

  /**
   * Handle Turnstile errors
   */
  const handleTurnstileError = (error: unknown) => {
    setTurnstileToken(null);

    // Check if this is a PAT-related error
    if (error && typeof error === 'string' && error.includes('Private Access Token')) {
      setTurnstileError(
        'Security verification failed due to Private Access Token issues. You can bypass this verification below.'
      );
    } else {
      setTurnstileError(
        'Security verification failed. Please try again or bypass verification if issues persist.'
      );
    }
  };

  /**
   * Handle Turnstile token expiration/timeout
   */
  const handleTurnstileExpired = () => {
    setTurnstileToken(null);
    setTurnstileError('Security verification expired. Please try again.');
  };

  /**
   * Handle colleague login with access code and Turnstile token
   */
  const handleColleagueLogin = async (values: LoginFormSchema) => {
    await handleSubmit(async () => {
      // Call the server function with access code and optional Turnstile token
      const result = await validateAccessCode({
        data: {
          code: values.accessCode,
          turnstileToken: turnstileToken || undefined,
        },
      });

      assertValidAccessCode(result);
    }, 'Access granted successfully.');
  };

  /**
   * Initiate admin login via Authentik OAuth
   */
  const handleAdminLogin = async () => {
    try {
      // Store redirect URL in localStorage if provided and safe
      if (redirectTo && isSafeRedirectUrl(redirectTo)) {
        localStorage.setItem('debt-master-redirect', redirectTo);
      } else {
        localStorage.removeItem('debt-master-redirect');
      }

      // Get the Authentik OAuth URL from the server
      const authData = await getAuthentikAuthUrl();

      if (authData.authUrl) {
        // Store OAuth state for verification
        storeOAuthParams(authData.state);

        // Redirect to Authentik for authentication
        window.location.href = authData.authUrl;
      } else {
        throw new Error('Failed to generate authentication URL');
      }
    } catch (_error) {
      alert('Failed to initiate admin login. Please check your Authentik configuration.');
    }
  };

  const validateAccessCodeField = ({ value }: { value: string }) => {
    return accessCodeFieldError(value, (v) => loginFormSchema.shape.accessCode.safeParse(v));
  };

  /**
   * Handle admin email/password login via Better Auth (provider === 'better-auth').
   * The session cookie is set by the BA handler. If the account has 2FA enabled,
   * the flow advances to the TOTP verification step instead of redirecting.
   */
  const handleAdminEmailLogin = async (values: { email: string; password: string }) => {
    setAdminSubmitting(true);
    setAdminError(null);
    try {
      const { data, error } = await betterAuthClient.signIn.email({
        email: values.email,
        password: values.password,
      });
      if (error) {
        throw new Error(error.message ?? 'Sign-in failed');
      }
      if (
        data &&
        typeof data === 'object' &&
        'twoFactorRedirect' in data &&
        data.twoFactorRedirect
      ) {
        setAdminLoginStep('totp');
        return;
      }
      window.location.href = resolvePostLoginHref(redirectTo, isSafeRedirectUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      setAdminError(message);
      toast.error(message, { description: m.login_errorTitle() });
    } finally {
      setAdminSubmitting(false);
    }
  };

  const validateTotpCodeField = ({ value }: { value: string }) => {
    if (!value) return 'Verification code is required';
    if (!/^\d{6}$/.test(value)) return 'Enter a 6-digit code';
    return undefined;
  };

  function isErrorPayload(value: unknown): value is { error?: { message?: string } } {
    return typeof value === 'object' && value !== null && 'error' in value;
  }

  const handleTotpVerify = async (values: { code: string }) => {
    setAdminSubmitting(true);
    setAdminError(null);
    try {
      const response = await fetch('/api/auth/two-factor/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: values.code }),
      });
      const data = (await response.json()) as unknown;
      if (!response.ok) {
        const message =
          isErrorPayload(data) && data.error?.message ? data.error.message : 'Verification failed';
        throw new Error(message);
      }
      window.location.href = resolvePostLoginHref(redirectTo, isSafeRedirectUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setAdminError(message);
      toast.error(message, { description: m.login_errorTitle() });
    } finally {
      setAdminSubmitting(false);
    }
  };

  const validateEmailField = ({ value }: { value: string }) => {
    if (!value) return 'Email is required';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : 'Enter a valid email';
  };

  const validatePasswordField = ({ value }: { value: string }) => {
    if (!value) return 'Password is required';
    return undefined;
  };

  /**
   * Get the appropriate button content based on current state
   */
  const getButtonContent = () => {
    if (isSubmitting) {
      return (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {m.login_button_verifying()}
        </>
      );
    }

    // Show loading state when Turnstile is enabled but no token yet
    if (isTurnstileEnabled && !turnstileToken && !turnstileError) {
      return (
        <>
          <Shield className="mr-2 h-4 w-4 animate-pulse" />
          {m.login_button_human()}
        </>
      );
    }

    return m.login_button_continue();
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardContent className="mt-4">
          <div className="flex flex-col gap-6">
            {/* Colleague Login Section */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold" data-testid={AUTH.COLLEAGUE_ACCESS_HEADING}>
                  {m.login_title_colleague()}
                </h3>
                <p className="text-sm text-muted-foreground">{m.login_desc_colleague()}</p>
              </div>

              <Form<LoginFormSchema>
                defaultValues={{
                  accessCode: '',
                }}
                onSubmit={handleColleagueLogin}
              >
                <div className="flex flex-col gap-4 mt-6">
                  <FormInput
                    name="accessCode"
                    label={m.login_label_accessCode()}
                    placeholder={m.login_placeholder_accessCode()}
                    data-testid={AUTH.ACCESS_CODE_INPUT}
                    required
                    validate={validateAccessCodeField}
                  />

                  {/* Turnstile Widget */}
                  {isTurnstileEnabled && turnstileSiteKey && (
                    <div className="absolute top-0 left-0">
                      <TurnstileWidget
                        siteKey={turnstileSiteKey}
                        size="invisible"
                        theme={effectiveTheme}
                        onVerify={handleTurnstileVerify}
                        onError={handleTurnstileError}
                        onExpired={handleTurnstileExpired}
                        onTimeout={handleTurnstileExpired}
                      />
                      {turnstileError && (
                        <div className="text-sm text-destructive-text mt-1">
                          {turnstileError}
                          <br />
                          <p className="text-xs text-muted-foreground">
                            If you are having issues, please contact your admin.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <FormSubmit
                    data-testid={AUTH.COLLEAGUE_LOGIN_BTN}
                    disabled={
                      isSubmitting || (isTurnstileEnabled && !turnstileToken && !turnstileError)
                    }
                  >
                    {getButtonContent()}
                  </FormSubmit>
                </div>
              </Form>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {m.login_divider_or()}
                </span>
              </div>
            </div>

            {/* Admin Login Section */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold" data-testid={AUTH.ADMIN_ACCESS_HEADING}>
                  {m.login_title_admin()}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {authProvider === 'authentik'
                    ? m.login_desc_admin()
                    : m.login_desc_admin_password()}
                </p>
              </div>

              {authProvider === null && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled
                  data-testid={AUTH.ADMIN_LOGIN_BTN}
                >
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading…
                </Button>
              )}

              {authProvider !== 'better-auth' && authProvider !== null && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleAdminLogin}
                  data-testid={AUTH.ADMIN_LOGIN_BTN}
                >
                  {m.login_button_admin()}
                </Button>
              )}

              {/* Better Auth email/password admin login (provider === 'better-auth') */}
              {authProvider === 'better-auth' && adminLoginStep === 'email' && (
                <Form<{ email: string; password: string }>
                  defaultValues={{ email: '', password: '' }}
                  onSubmit={handleAdminEmailLogin}
                >
                  <div className="flex flex-col gap-4">
                    <FormInput
                      name="email"
                      type="email"
                      label="Admin email"
                      placeholder="admin@example.com"
                      data-testid={AUTH.ADMIN_EMAIL_INPUT}
                      required
                      validate={validateEmailField}
                    />
                    <FormInput
                      name="password"
                      type="password"
                      label="Password"
                      data-testid={AUTH.ADMIN_PASSWORD_INPUT}
                      required
                      validate={validatePasswordField}
                    />
                    <div className="text-right">
                      <Button
                        asChild
                        variant="link"
                        className="h-auto p-0 text-xs text-muted-foreground"
                      >
                        <Link to="/forgot-password/">Forgot password?</Link>
                      </Button>
                    </div>
                    {adminError && (
                      <p
                        className="text-sm text-destructive-text"
                        data-testid={AUTH.ADMIN_LOGIN_ERROR}
                      >
                        {adminError}
                      </p>
                    )}
                    <FormSubmit data-testid={AUTH.ADMIN_LOGIN_BTN} disabled={adminSubmitting}>
                      {adminSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in…
                        </>
                      ) : (
                        'Sign in'
                      )}
                    </FormSubmit>
                  </div>
                </Form>
              )}

              {authProvider === 'better-auth' && adminLoginStep === 'totp' && (
                <Form<{ code: string }> defaultValues={{ code: '' }} onSubmit={handleTotpVerify}>
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                      Two-factor authentication is enabled. Enter the 6-digit code from your
                      authenticator app.
                    </p>
                    <FormInput
                      name="code"
                      type="text"
                      label="Authentication code"
                      placeholder="000000"
                      data-testid={AUTH.ADMIN_TOTP_INPUT}
                      required
                      validate={validateTotpCodeField}
                    />
                    {adminError && (
                      <p
                        className="text-sm text-destructive-text"
                        data-testid={AUTH.ADMIN_LOGIN_ERROR}
                      >
                        {adminError}
                      </p>
                    )}
                    <FormSubmit data-testid={AUTH.ADMIN_TOTP_SUBMIT_BTN} disabled={adminSubmitting}>
                      {adminSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        'Verify'
                      )}
                    </FormSubmit>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      data-testid={AUTH.ADMIN_TOTP_BACK_BTN}
                      onClick={() => {
                        setAdminLoginStep('email');
                        setAdminError(null);
                      }}
                    >
                      Back to email sign-in
                    </Button>
                  </div>
                </Form>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
