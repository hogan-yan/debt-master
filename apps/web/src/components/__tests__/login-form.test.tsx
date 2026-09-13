import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mutable Mock State ───────────────────────────────────────────

let mockAuthProvider: string | null = 'authentik';
let mockIsSubmitting = false;

const mockBetterAuthSignIn = vi.fn();
let mockIsTurnstileEnabled = false;
let mockTurnstileSiteKey: string | null = null;
let mockIsSafeRedirect = true;
let mockValidateAccessCodeResult: unknown = {
  valid: true,
  token: 'tok123',
  isAdmin: false,
  permissions: ['view'],
};

const mockNavigate = vi.fn();
const mockLogin = vi.fn();
const mockStoreOAuthParams = vi.fn();

// Track the onSuccess callback passed to useFormSubmission so tests can invoke it
let capturedOnSuccess: (() => void) | undefined;

const mockHandleSubmit = vi.fn(async (fn: () => Promise<unknown>, _message?: string) => {
  const result = await fn();
  if (capturedOnSuccess) {
    capturedOnSuccess();
  }
  return result;
});

let mockFetch = vi.fn<typeof fetch>();

// ─── Module Mocks ─────────────────────────────────────────────────

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks', () => ({
  useFormSubmission: (options: { onSuccess?: () => void }) => {
    capturedOnSuccess = options?.onSuccess;
    return {
      handleSubmit: mockHandleSubmit,
      isSubmitting: mockIsSubmitting,
    };
  },
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({ effectiveTheme: 'light' as const }),
}));

let mockAccessCodeSafeParse = (value: string) =>
  value.length >= 3
    ? { success: true as const, data: value }
    : {
        success: false as const,
        error: { issues: [{ message: 'Invalid access code' }] },
      };

vi.mock('@/lib/schemas', () => ({
  loginFormSchema: {
    shape: {
      accessCode: {
        safeParse: (value: string) => mockAccessCodeSafeParse(value),
      },
    },
  },
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    login_title_colleague: () => 'Colleague Login',
    login_desc_colleague: () => 'Enter your access code',
    login_title_admin: () => 'Admin Login',
    login_desc_admin: () => 'Sign in with Authentik',
    login_desc_admin_password: () => 'Sign in with your admin email and password',
    login_label_accessCode: () => 'Access Code',
    login_placeholder_accessCode: () => 'Enter code',
    login_button_continue: () => 'Continue',
    login_button_verifying: () => 'Verifying...',
    login_button_human: () => 'Verifying human...',
    login_button_admin: () => 'Sign in with Authentik',
    login_divider_or: () => 'OR',
    login_successTitle: () => 'Success',
    login_successMessage: () => 'Logged in',
    login_errorTitle: () => 'Error',
  },
}));

vi.mock('@/server/auth', () => ({
  getAuthentikAuthUrl: vi.fn(async () => ({
    authUrl: 'http://auth.example.com',
    state: 'state123',
  })),
  getAuthProvider: vi.fn(async () => mockAuthProvider),
  validateAccessCode: vi.fn(async () => mockValidateAccessCodeResult),
}));

vi.mock('@/server/turnstile', () => ({
  getTurnstileSiteKey: vi.fn(async () => ({
    isConfigured: mockIsTurnstileEnabled,
    siteKey: mockTurnstileSiteKey,
  })),
}));

vi.mock('@/utils/auth-client', () => ({
  isSafeRedirectUrl: () => mockIsSafeRedirect,
  storeOAuthParams: (...args: unknown[]) => mockStoreOAuthParams(...args),
}));

vi.mock('@/utils/better-auth-client', () => ({
  betterAuthClient: {
    signIn: {
      email: (...args: unknown[]) => mockBetterAuthSignIn(...args),
    },
  },
}));

vi.mock('@/utils/auth-context', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}));

vi.mock('@/components/ui/card', () => ({
  Card: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  CardContent: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));

vi.mock('@/components/ui/form', () => ({
  Form: <T extends Record<string, string>>({
    children,
    onSubmit,
  }: {
    children: React.ReactNode;
    onSubmit: (values: T) => void | Promise<void>;
    defaultValues?: T;
  }) => {
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const values = Object.fromEntries(formData.entries()) as Record<string, string>;
      for (const key of Object.keys(values)) {
        values[key] = String(values[key]);
      }
      try {
        await onSubmit(values as T);
      } catch (_err) {
        // swallow for test
      }
    };
    return <form onSubmit={handleSubmit}>{children}</form>;
  },
  FormSubmit: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="submit" {...props} />
  ),
}));

vi.mock('@/components/ui/form-fields', () => ({
  FormInput: (
    props: React.InputHTMLAttributes<HTMLInputElement> & {
      validate?: (v: { value: string }) => string | undefined;
      'data-testid'?: string;
    }
  ) => {
    const [error, setError] = useState<string | null>(null);
    const { validate, onBlur, ...rest } = props;
    return (
      <>
        <input
          {...rest}
          onBlur={(e) => {
            if (validate) {
              const message = validate({ value: e.target.value });
              setError(message ?? null);
            }
            onBlur?.(e);
          }}
        />
        {error && <span data-testid={`${props['data-testid']}-error`}>{error}</span>}
      </>
    );
  },
}));

interface TurnstileProps {
  onVerify?: (token: string) => void;
  onError?: (error: unknown) => void;
  onExpired?: () => void;
  [key: string]: unknown;
}

let lastTurnstileProps: TurnstileProps = {};

vi.mock('@/components/ui/turnstile-widget', () => ({
  TurnstileWidget: (props: TurnstileProps) => {
    lastTurnstileProps = props;
    return (
      <div data-testid="turnstile-widget">
        <button
          type="button"
          data-testid="trigger-turnstile-error"
          onClick={() => {
            const error = props['data-error'] ?? 'generic error';
            props.onError?.(error);
          }}
        >
          Trigger Error
        </button>
      </div>
    );
  },
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
  Shield: () => <svg data-testid="shield-icon" />,
}));

// ─── Import Component After Mocks ─────────────────────────────────

import { AUTH } from '@/test/test-ids';
import { LoginForm } from '../login-form';

describe('LoginForm', () => {
  let hrefSetter: (url: string) => void;
  let localStorageSetItem: ReturnType<typeof vi.fn>;
  let localStorageRemoveItem: ReturnType<typeof vi.fn>;
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mutable mock state
    mockAuthProvider = 'authentik';
    mockIsSubmitting = false;
    mockIsTurnstileEnabled = false;
    mockTurnstileSiteKey = null;
    mockIsSafeRedirect = true;
    mockValidateAccessCodeResult = {
      valid: true,
      token: 'tok123',
      isAdmin: false,
      permissions: ['view'],
    };
    mockAccessCodeSafeParse = (value: string) =>
      value.length >= 3
        ? { success: true as const, data: value }
        : {
            success: false as const,
            error: { issues: [{ message: 'Invalid access code' }] },
          };
    capturedOnSuccess = undefined;

    // Reset mock functions
    mockNavigate.mockClear();
    mockLogin.mockClear();
    mockBetterAuthSignIn.mockClear();
    mockHandleSubmit.mockClear();
    mockStoreOAuthParams.mockClear();

    // Mock fetch for TOTP verification
    mockFetch = vi.fn<typeof fetch>();
    global.fetch = mockFetch;

    // Mock window.location.href
    hrefSetter = vi.fn<(url: string) => void>();
    const mockLocation = { pathname: '/' };
    Object.defineProperty(mockLocation, 'href', {
      get: () => '/',
      set: (url: string) => {
        hrefSetter(url);
      },
      configurable: true,
    });
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });

    // Mock localStorage
    localStorageSetItem = vi.fn();
    localStorageRemoveItem = vi.fn();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: localStorageSetItem,
        removeItem: localStorageRemoveItem,
        clear: vi.fn(),
      },
      writable: true,
    });

    // Mock alert
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders colleague login heading', () => {
    render(<LoginForm />);
    expect(screen.getByTestId(AUTH.COLLEAGUE_ACCESS_HEADING)).toBeInTheDocument();
    expect(screen.getByText('Colleague Login')).toBeInTheDocument();
  });

  it('shows client-side validation error for short access code', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByTestId(AUTH.ACCESS_CODE_INPUT), 'ab');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId(`${AUTH.ACCESS_CODE_INPUT}-error`)).toHaveTextContent(
        'Invalid access code'
      );
    });
  });

  it('renders admin login heading', () => {
    render(<LoginForm />);
    expect(screen.getByTestId(AUTH.ADMIN_ACCESS_HEADING)).toBeInTheDocument();
    expect(screen.getByText('Admin Login')).toBeInTheDocument();
  });

  it('renders access code input', () => {
    render(<LoginForm />);
    expect(screen.getByTestId(AUTH.ACCESS_CODE_INPUT)).toBeInTheDocument();
  });

  it('shows verifying button text when submitting', () => {
    mockIsSubmitting = true;
    render(<LoginForm />);
    const btn = screen.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN);
    expect(btn).toHaveTextContent('Verifying...');
  });

  it('shows human button text when turnstile enabled but no token', async () => {
    mockIsTurnstileEnabled = true;
    mockTurnstileSiteKey = 'site-key-123';
    render(<LoginForm />);

    await waitFor(() => {
      const btn = screen.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN);
      expect(btn).toHaveTextContent('Verifying human...');
    });
  });

  it('shows continue button text by default', () => {
    render(<LoginForm />);
    const btn = screen.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN);
    expect(btn).toHaveTextContent('Continue');
  });

  it('calls handleAdminLogin on admin button click', async () => {
    const user = userEvent.setup();
    render(<LoginForm redirectTo="/dashboard" />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN)).toHaveTextContent('Sign in with Authentik');
    });
    const adminBtn = screen.getByTestId(AUTH.ADMIN_LOGIN_BTN);
    await user.click(adminBtn);

    await waitFor(() => {
      expect(localStorageSetItem).toHaveBeenCalledWith('debt-master-redirect', '/dashboard');
      expect(mockStoreOAuthParams).toHaveBeenCalledWith('state123');
      expect(hrefSetter).toHaveBeenCalledWith('http://auth.example.com');
    });
  });

  it('does not render turnstile widget when not configured', async () => {
    const { getTurnstileSiteKey } = await import('@/server/turnstile');
    vi.mocked(getTurnstileSiteKey).mockResolvedValueOnce({
      isConfigured: false,
      siteKey: 'unused-key',
    });
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.queryByTestId('turnstile-widget')).not.toBeInTheDocument();
    });
  });

  it('handles turnstile config lookup error gracefully', async () => {
    const { getTurnstileSiteKey } = await import('@/server/turnstile');
    vi.mocked(getTurnstileSiteKey).mockRejectedValueOnce(new Error('config failed'));
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.queryByTestId('turnstile-widget')).not.toBeInTheDocument();
    });
  });

  it('falls back to authentik UI when auth provider lookup fails', async () => {
    const { getAuthProvider } = await import('@/server/auth');
    vi.mocked(getAuthProvider).mockRejectedValueOnce(new Error('provider failed'));
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN)).toHaveTextContent('Sign in with Authentik');
    });
  });

  it('turnstile error message renders when error set', async () => {
    mockIsTurnstileEnabled = true;
    mockTurnstileSiteKey = 'site-key-123';
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument();
    });

    // Trigger error via the widget's onError prop
    const widget = screen.getByTestId('turnstile-widget');
    expect(widget.getAttribute('onError')).toBeNull();
    expect(widget).toBeInTheDocument();
  });

  it('shows PAT-specific turnstile error message', async () => {
    mockIsTurnstileEnabled = true;
    mockTurnstileSiteKey = 'site-key-123';
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument();
    });

    lastTurnstileProps.onError?.('Private Access Token issue');

    await waitFor(() => {
      expect(screen.getByText(/Private Access Token/i)).toBeInTheDocument();
    });
  });

  it('shows generic turnstile error message', async () => {
    mockIsTurnstileEnabled = true;
    mockTurnstileSiteKey = 'site-key-123';
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument();
    });

    lastTurnstileProps.onError?.('some other failure');

    await waitFor(() => {
      expect(screen.getByText(/Security verification failed/i)).toBeInTheDocument();
    });
  });

  it('clears token and shows error when turnstile expires or times out', async () => {
    mockIsTurnstileEnabled = true;
    mockTurnstileSiteKey = 'site-key-123';
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument();
    });

    lastTurnstileProps.onVerify?.('token-123');
    lastTurnstileProps.onExpired?.();

    await waitFor(() => {
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });
  });

  it('form submit is disabled when turnstile enabled but no token', async () => {
    mockIsTurnstileEnabled = true;
    mockTurnstileSiteKey = 'site-key-123';
    render(<LoginForm />);

    await waitFor(() => {
      const btn = screen.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN);
      expect(btn).toBeDisabled();
    });
  });

  it('onSuccess navigates to home when no redirectTo', async () => {
    render(<LoginForm />);

    // Trigger the captured onSuccess callback directly
    expect(capturedOnSuccess).toBeDefined();
    if (capturedOnSuccess) {
      capturedOnSuccess();
    }

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith('/');
    });
  });

  it('onSuccess redirects to redirectTo when provided and safe', async () => {
    mockIsSafeRedirect = true;
    render(<LoginForm redirectTo="/dashboard" />);

    expect(capturedOnSuccess).toBeDefined();
    if (capturedOnSuccess) {
      capturedOnSuccess();
    }

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('onSuccess navigates to home when redirectTo is unsafe', async () => {
    mockIsSafeRedirect = false;
    render(<LoginForm redirectTo="http://evil.com" />);

    expect(capturedOnSuccess).toBeDefined();
    capturedOnSuccess!();

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith('/');
    });
  });

  it('admin login removes localStorage redirect when no redirectTo', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN)).toHaveTextContent('Sign in with Authentik');
    });
    const adminBtn = screen.getByTestId(AUTH.ADMIN_LOGIN_BTN);
    await user.click(adminBtn);

    await waitFor(() => {
      expect(localStorageRemoveItem).toHaveBeenCalledWith('debt-master-redirect');
    });
  });

  it('admin login alerts when auth URL generation fails', async () => {
    const { getAuthentikAuthUrl } = await import('@/server/auth');
    vi.mocked(getAuthentikAuthUrl).mockResolvedValueOnce({
      authUrl: '',
      state: '00000000-0000-0000-0000-000000000000',
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN)).toHaveTextContent('Sign in with Authentik');
    });
    const adminBtn = screen.getByTestId(AUTH.ADMIN_LOGIN_BTN);
    await user.click(adminBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  it('admin login alerts on network error', async () => {
    const { getAuthentikAuthUrl } = await import('@/server/auth');
    vi.mocked(getAuthentikAuthUrl).mockRejectedValueOnce(new Error('network'));

    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN)).toHaveTextContent('Sign in with Authentik');
    });
    const adminBtn = screen.getByTestId(AUTH.ADMIN_LOGIN_BTN);
    await user.click(adminBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  it('colleague login throws when access code invalid', async () => {
    mockValidateAccessCodeResult = { valid: false, error: 'Invalid' };

    const { validateAccessCode } = await import('@/server/auth');
    vi.mocked(validateAccessCode).mockResolvedValueOnce(
      mockValidateAccessCodeResult as
        | {
            valid: false;
            error: string;
            token?: undefined;
            permissions?: undefined;
            isAdmin?: undefined;
          }
        | { valid: true; token: string; permissions: string[]; isAdmin: boolean; error?: undefined }
    );

    render(<LoginForm />);

    const form = screen.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN).closest('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(mockHandleSubmit).toHaveBeenCalled();
    });
  });

  it('colleague login uses server error message when provided', async () => {
    mockValidateAccessCodeResult = { valid: false, error: 'Server says no' };

    render(<LoginForm />);

    const form = screen.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN).closest('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(mockHandleSubmit).toHaveBeenCalled();
    });
  });

  it('shows default error when result is not an object', async () => {
    mockValidateAccessCodeResult = null;

    render(<LoginForm />);

    const form = screen.getByTestId(AUTH.COLLEAGUE_LOGIN_BTN).closest('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(mockHandleSubmit).toHaveBeenCalled();
    });
  });

  it('shows Better Auth email/password form when provider is better-auth', async () => {
    mockAuthProvider = 'better-auth';
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument();
      expect(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT)).toBeInTheDocument();
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN)).toHaveTextContent('Sign in');
    });
  });

  it('shows forgot password link when provider is better-auth', async () => {
    mockAuthProvider = 'better-auth';
    render(<LoginForm />);

    await waitFor(() => {
      const link = screen.getByText('Forgot password?');
      expect(link).toHaveAttribute('href', '/forgot-password/');
    });
  });

  it('submits email/password via Better Auth client', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({ data: null, error: null });

    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));

    await waitFor(() => {
      expect(mockBetterAuthSignIn).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'Str0ng!Pass',
      });
      expect(hrefSetter).toHaveBeenCalledWith('/');
    });
  });

  it('redirects Better Auth login to home when redirect is unsafe', async () => {
    mockAuthProvider = 'better-auth';
    mockIsSafeRedirect = false;
    mockBetterAuthSignIn.mockResolvedValue({ data: null, error: null });
    const user = userEvent.setup();
    render(<LoginForm redirectTo="https://evil.example" />);

    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));
    await waitFor(() => expect(hrefSetter).toHaveBeenCalledWith('/'));
  });

  it('shows client-side validation errors for empty admin fields', async () => {
    mockAuthProvider = 'better-auth';
    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument();
    });

    await user.click(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT));
    await user.tab();
    await user.click(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT));
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId(`${AUTH.ADMIN_EMAIL_INPUT}-error`)).toHaveTextContent(
        'Email is required'
      );
      expect(screen.getByTestId(`${AUTH.ADMIN_PASSWORD_INPUT}-error`)).toHaveTextContent(
        'Password is required'
      );
    });
  });

  it('shows client-side validation error for invalid email', async () => {
    mockAuthProvider = 'better-auth';
    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'not-an-email');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId(`${AUTH.ADMIN_EMAIL_INPUT}-error`)).toHaveTextContent(
        'Enter a valid email'
      );
    });
  });

  it('shows no password error when password field has a value', async () => {
    mockAuthProvider = 'better-auth';
    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.tab();

    await waitFor(() => {
      expect(screen.queryByTestId(`${AUTH.ADMIN_PASSWORD_INPUT}-error`)).not.toBeInTheDocument();
    });
  });

  it('shows error when Better Auth sign-in returns an error', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_ERROR)).toHaveTextContent('Invalid credentials');
    });
  });

  it('advances to TOTP step when sign-in requires two-factor', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT)).toBeInTheDocument();
    });
  });

  it('shows client-side validation error for non 6-digit TOTP code', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT), '12345');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId(`${AUTH.ADMIN_TOTP_INPUT}-error`)).toHaveTextContent(
        'Enter a 6-digit code'
      );
    });
  });

  it('shows client-side validation error for an empty TOTP code', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);
    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));
    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT)).toBeInTheDocument());
    await user.click(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT));
    await user.tab();
    expect(screen.getByTestId(`${AUTH.ADMIN_TOTP_INPUT}-error`)).toHaveTextContent(
      'Verification code is required'
    );
  });

  it('verifies TOTP code and redirects on success', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    });
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ token: 'tok', user: { id: 'u1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const user = userEvent.setup();
    render(<LoginForm redirectTo="/dashboard" />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT), '123456');
    await user.click(screen.getByTestId(AUTH.ADMIN_TOTP_SUBMIT_BTN));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/two-factor/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      });
      expect(hrefSetter).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error when TOTP verification fails', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    });
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid code' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT), '000000');
    await user.click(screen.getByTestId(AUTH.ADMIN_TOTP_SUBMIT_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_ERROR)).toHaveTextContent('Invalid code');
    });
  });

  it('uses the error message from a rejected TOTP request', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    mockFetch.mockRejectedValue(new Error('Network unavailable'));
    const user = userEvent.setup();
    render(<LoginForm />);
    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));
    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT), '123456');
    await user.click(screen.getByTestId(AUTH.ADMIN_TOTP_SUBMIT_BTN));
    await waitFor(() =>
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_ERROR)).toHaveTextContent('Network unavailable')
    );
  });

  it('uses the fallback message when Better Auth returns an error without text', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({ data: null, error: {} });
    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));

    await waitFor(() =>
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_ERROR)).toHaveTextContent('Sign-in failed')
    );
  });

  it('uses the fallback message for a non-error TOTP response payload', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ reason: 'nope' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));
    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT), '123456');
    await user.click(screen.getByTestId(AUTH.ADMIN_TOTP_SUBMIT_BTN));

    await waitFor(() =>
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_ERROR)).toHaveTextContent('Verification failed')
    );
  });

  it('uses fallback errors for rejected admin sign-in and TOTP requests', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockRejectedValue('network down');
    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));
    await waitFor(() =>
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_ERROR)).toHaveTextContent('Sign-in failed')
    );
  });

  it('returns to email step from TOTP step', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT)).toBeInTheDocument();
    });

    await user.click(screen.getByTestId(AUTH.ADMIN_TOTP_BACK_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument();
    });
  });

  it('redirects Better Auth login to a safe redirectTo', async () => {
    mockAuthProvider = 'better-auth';
    mockIsSafeRedirect = true;
    mockBetterAuthSignIn.mockResolvedValue({ data: { user: { id: '1' } }, error: null });
    const user = userEvent.setup();
    render(<LoginForm redirectTo="/dashboard" />);

    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));
    await waitFor(() => expect(hrefSetter).toHaveBeenCalledWith('/dashboard'));
  });

  it('redirects TOTP success to home when redirect is missing', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));
    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT), '123456');
    await user.click(screen.getByTestId(AUTH.ADMIN_TOTP_SUBMIT_BTN));
    await waitFor(() => expect(hrefSetter).toHaveBeenCalledWith('/'));
  });

  it('uses fallback message when TOTP throws a non-Error', async () => {
    mockAuthProvider = 'better-auth';
    mockBetterAuthSignIn.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    mockFetch.mockRejectedValue('totp down');
    const user = userEvent.setup();
    render(<LoginForm />);

    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_EMAIL_INPUT), 'admin@example.com');
    await user.type(screen.getByTestId(AUTH.ADMIN_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(AUTH.ADMIN_LOGIN_BTN));
    await waitFor(() => expect(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT)).toBeInTheDocument());
    await user.type(screen.getByTestId(AUTH.ADMIN_TOTP_INPUT), '123456');
    await user.click(screen.getByTestId(AUTH.ADMIN_TOTP_SUBMIT_BTN));
    await waitFor(() =>
      expect(screen.getByTestId(AUTH.ADMIN_LOGIN_ERROR)).toHaveTextContent('Verification failed')
    );
  });

  it('shows no access-code message when issues array is empty', async () => {
    mockAccessCodeSafeParse = () => ({
      success: false as const,
      error: { issues: [] },
    });

    const user = userEvent.setup();
    render(<LoginForm />);
    const input = await screen.findByTestId(AUTH.ACCESS_CODE_INPUT);
    await user.type(input, 'ab');
    await user.tab();
    expect(screen.queryByTestId(`${AUTH.ACCESS_CODE_INPUT}-error`)).not.toBeInTheDocument();
  });
});
