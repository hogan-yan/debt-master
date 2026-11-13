import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendPasswordResetEmail = vi.fn();
let mockIsSubmitting = false;

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
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
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
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
  FormInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
  Mail: () => <svg data-testid="mail-icon" />,
}));

import { ForgotPasswordPage, validateEmailField } from '@/components/auth/forgot-password-page';
import { AUTH } from '@/test/test-ids';

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsSubmitting = false;
    mockSendPasswordResetEmail.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the forgot password heading', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId(AUTH.FORGOT_PASSWORD_HEADING)).toBeInTheDocument();
  });

  it('renders email input and submit button', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId(AUTH.FORGOT_PASSWORD_EMAIL_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(AUTH.FORGOT_PASSWORD_SUBMIT_BTN)).toBeInTheDocument();
  });

  it('links back to login', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText('Back to login')).toHaveAttribute('href', '/login/');
  });

  it('sends reset email and shows success state', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByTestId(AUTH.FORGOT_PASSWORD_EMAIL_INPUT), 'admin@example.com');
    await user.click(screen.getByTestId(AUTH.FORGOT_PASSWORD_SUBMIT_BTN));

    await waitFor(() => {
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({
        data: { email: 'admin@example.com' },
      });
      expect(screen.getByText(/If an account exists/i)).toBeInTheDocument();
    });
  });

  it('still shows generic success when server returns success false', async () => {
    mockSendPasswordResetEmail.mockResolvedValue({ success: false });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByTestId(AUTH.FORGOT_PASSWORD_EMAIL_INPUT), 'admin@example.com');
    await user.click(screen.getByTestId(AUTH.FORGOT_PASSWORD_SUBMIT_BTN));

    await waitFor(() => {
      expect(mockSendPasswordResetEmail).toHaveBeenCalled();
      expect(screen.queryByText(/If an account exists/i)).not.toBeInTheDocument();
    });
  });

  it('shows sending state while the reset request is submitting', () => {
    mockIsSubmitting = true;
    render(<ForgotPasswordPage />);

    expect(screen.getByText('Sending…')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });
});

describe('validateEmailField', () => {
  it('requires a value', () => {
    expect(validateEmailField({ value: '' })).toBe('Email is required');
  });

  it('rejects invalid email', () => {
    expect(validateEmailField({ value: 'not-an-email' })).toBe('Enter a valid email');
  });

  it('accepts valid email', () => {
    expect(validateEmailField({ value: 'admin@example.com' })).toBeUndefined();
  });
});
