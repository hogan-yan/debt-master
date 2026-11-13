import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockResetPassword = vi.fn();

let mockSearchToken = 'reset-token-123';
let mockIsSubmitting = false;

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useSearch: () => ({ token: mockSearchToken }),
  createFileRoute: () => () => ({}),
}));

vi.mock('@/hooks', () => ({
  useFormSubmission: () => ({
    isSubmitting: mockIsSubmitting,
    handleSubmit: async (fn: () => Promise<unknown>, _message?: string) => {
      await fn();
    },
  }),
}));

vi.mock('@/server/password-reset', () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
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
    const [submitError, setSubmitError] = useState<string | null>(null);
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitError(null);
      const formData = new FormData(e.currentTarget);
      const values = Object.fromEntries(formData.entries()) as Record<string, string>;
      for (const key of Object.keys(values)) {
        values[key] = String(values[key]);
      }
      try {
        await onSubmit(values as T);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : String(err));
      }
    };
    return (
      <form onSubmit={handleSubmit}>
        {children}
        {submitError && <span data-testid="form-error">{submitError}</span>}
      </form>
    );
  },
  FormSubmit: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="submit" {...props} />
  ),
}));

vi.mock('@/components/ui/form-fields', () => ({
  FormInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
}));

vi.mock('@/utils/password-policy', () => ({
  validatePassword: (password: string) => ({
    valid: password.length >= 12,
    errors: password.length >= 12 ? [] : ['Password must be at least 12 characters'],
  }),
}));

import {
  ResetPasswordPage,
  validateConfirmPasswordField,
  validatePasswordField,
} from '@/components/auth/reset-password-page';
import { AUTH } from '@/test/test-ids';

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchToken = 'reset-token-123';
    mockIsSubmitting = false;
    mockResetPassword.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the reset password heading', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByTestId(AUTH.LOGIN_HEADING)).toBeInTheDocument();
  });

  it('disables submit when token is missing', () => {
    mockSearchToken = '';
    render(<ResetPasswordPage />);
    expect(screen.getByTestId(AUTH.RESET_PASSWORD_SUBMIT_BTN)).toBeDisabled();
  });

  it('throws a token error when the form submission bypasses the disabled button', async () => {
    mockSearchToken = undefined as unknown as string;
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByTestId(AUTH.RESET_PASSWORD_INPUT), 'Str0ng!Passw0rd');
    await user.type(screen.getByTestId(AUTH.RESET_PASSWORD_CONFIRM_INPUT), 'Str0ng!Passw0rd');
    fireEvent.submit(screen.getByTestId(AUTH.RESET_PASSWORD_SUBMIT_BTN).closest('form')!);

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent('Reset token is missing.');
    });
  });

  it('keeps the form visible when reset succeeds without a success result', async () => {
    mockResetPassword.mockResolvedValue({ success: false });
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByTestId(AUTH.RESET_PASSWORD_INPUT), 'Str0ng!Passw0rd');
    await user.type(screen.getByTestId(AUTH.RESET_PASSWORD_CONFIRM_INPUT), 'Str0ng!Passw0rd');
    fireEvent.submit(screen.getByTestId(AUTH.RESET_PASSWORD_SUBMIT_BTN).closest('form')!);

    await waitFor(() => expect(mockResetPassword).toHaveBeenCalledOnce());
    expect(screen.queryByText(/Your password has been updated/i)).not.toBeInTheDocument();
  });

  it('shows submission state while reset is in progress', () => {
    mockIsSubmitting = true;
    render(<ResetPasswordPage />);

    expect(screen.getByText('Updating…')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('calls resetPassword with token and new password on submit', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByTestId(AUTH.RESET_PASSWORD_INPUT), 'Str0ng!Passw0rd');
    await user.type(screen.getByTestId(AUTH.RESET_PASSWORD_CONFIRM_INPUT), 'Str0ng!Passw0rd');
    await user.click(screen.getByTestId(AUTH.RESET_PASSWORD_SUBMIT_BTN));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({
        data: { token: 'reset-token-123', password: 'Str0ng!Passw0rd' },
      });
      expect(screen.getByText(/Your password has been updated/i)).toBeInTheDocument();
      expect(screen.getByText('Go to login')).toHaveAttribute('href', '/login/');
    });
  });

  it('rejects mismatched passwords', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByTestId(AUTH.RESET_PASSWORD_INPUT), 'Str0ng!Passw0rd');
    await user.type(screen.getByTestId(AUTH.RESET_PASSWORD_CONFIRM_INPUT), 'Different!Pass');
    fireEvent.submit(screen.getByTestId(AUTH.RESET_PASSWORD_SUBMIT_BTN).closest('form')!);

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent('Passwords do not match');
    });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('surfaces reset errors', async () => {
    mockResetPassword.mockRejectedValue(new Error('expired token'));

    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByTestId(AUTH.RESET_PASSWORD_INPUT), 'Str0ng!Passw0rd');
    await user.type(screen.getByTestId(AUTH.RESET_PASSWORD_CONFIRM_INPUT), 'Str0ng!Passw0rd');
    fireEvent.submit(screen.getByTestId(AUTH.RESET_PASSWORD_SUBMIT_BTN).closest('form')!);

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalled();
    });
  });
});

describe('validatePasswordField', () => {
  it('requires a value', () => {
    expect(validatePasswordField({ value: '' })).toBe('Password is required');
  });

  it('rejects weak password', () => {
    expect(validatePasswordField({ value: 'short' })).toMatch(/12 characters/);
  });

  it('accepts strong password', () => {
    expect(validatePasswordField({ value: 'Str0ng!Passw0rd' })).toBeUndefined();
  });
});

describe('validateConfirmPasswordField', () => {
  it('requires a value', () => {
    expect(validateConfirmPasswordField({ value: '' })).toBe('Please confirm your password');
  });

  it('accepts any non-empty value', () => {
    expect(validateConfirmPasswordField({ value: 'anything' })).toBeUndefined();
  });
});
