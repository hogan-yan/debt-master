import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SECURITY } from '@/test/test-ids';
import { SecurityPanel, securityValidators } from './security-panel';

const mockChangeAdminPassword = vi.fn();
let mockIsSubmitting = false;

vi.mock('@/paraglide/messages', () => ({
  m: {
    settings_security_title: () => 'Security',
    settings_changePassword_title: () => 'Change password',
    settings_changePassword_description: () => 'Update your admin password.',
    settings_changePassword_current: () => 'Current password',
    settings_changePassword_new: () => 'New password',
    settings_changePassword_confirm: () => 'Confirm new password',
    settings_changePassword_submit: () => 'Change password',
    settings_changePassword_submitting: () => 'Updating…',
    settings_changePassword_currentRequired: () => 'Current password is required',
    settings_changePassword_newRequired: () => 'New password is required',
    settings_changePassword_confirmRequired: () => 'Please confirm your new password',
    settings_changePassword_mismatch: () => 'New passwords do not match',
    settings_changePassword_successTitle: () => 'Password changed',
    settings_changePassword_successDescription: () => 'Your password has been updated.',
    settings_changePassword_successToast: () => 'Password changed successfully.',
  },
}));

vi.mock('@/server/admin-security', () => ({
  changeAdminPassword: (...args: unknown[]) => mockChangeAdminPassword(...args),
}));

vi.mock('@/hooks', () => ({
  useFormSubmission: () => ({
    isSubmitting: mockIsSubmitting,
    handleSubmit: async (fn: () => Promise<unknown>, _message?: string) => {
      await fn();
    },
  }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  CardContent: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  CardHeader: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  CardTitle: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
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

vi.mock('lucide-react', () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
  Shield: () => <svg data-testid="shield-icon" />,
}));

vi.mock('@/utils/password-policy', () => ({
  validatePassword: (password: string) => ({
    valid: password.length >= 12,
    errors: password.length >= 12 ? [] : ['Password must be at least 12 characters'],
  }),
}));

vi.mock('./two-factor-setup', () => ({
  TwoFactorSetup: () => <div data-testid="two-factor-setup" />,
}));

describe('SecurityPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsSubmitting = false;
    mockChangeAdminPassword.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders change password form', () => {
    render(<SecurityPanel />);

    expect(screen.getByTestId(SECURITY.PANEL)).toBeInTheDocument();
    expect(screen.getByTestId(SECURITY.CHANGE_PASSWORD_FORM)).toBeInTheDocument();
  });

  it('submits change password with valid matching passwords', async () => {
    const user = userEvent.setup();
    render(<SecurityPanel />);

    await user.type(screen.getByTestId(SECURITY.CURRENT_PASSWORD_INPUT), 'OldStr0ng!Pass');
    await user.type(screen.getByTestId(SECURITY.NEW_PASSWORD_INPUT), 'NewStr0ng!Pass');
    await user.type(screen.getByTestId(SECURITY.CONFIRM_PASSWORD_INPUT), 'NewStr0ng!Pass');
    await user.click(screen.getByTestId(SECURITY.CHANGE_PASSWORD_SUBMIT_BTN));

    await waitFor(() => {
      expect(mockChangeAdminPassword).toHaveBeenCalledWith({
        data: {
          currentPassword: 'OldStr0ng!Pass',
          newPassword: 'NewStr0ng!Pass',
        },
      });
    });
  });

  it('shows validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    render(<SecurityPanel />);

    await user.click(screen.getByTestId(SECURITY.CURRENT_PASSWORD_INPUT));
    await user.tab();
    await user.click(screen.getByTestId(SECURITY.CONFIRM_PASSWORD_INPUT));
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId(`${SECURITY.CURRENT_PASSWORD_INPUT}-error`)).toHaveTextContent(
        'Current password is required'
      );
      expect(screen.getByTestId(`${SECURITY.CONFIRM_PASSWORD_INPUT}-error`)).toHaveTextContent(
        'Please confirm your new password'
      );
    });
  });

  it('rejects a weak new password via client validation', async () => {
    const user = userEvent.setup();
    render(<SecurityPanel />);

    await user.click(screen.getByTestId(SECURITY.NEW_PASSWORD_INPUT));
    await user.type(screen.getByTestId(SECURITY.NEW_PASSWORD_INPUT), 'short');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId(`${SECURITY.NEW_PASSWORD_INPUT}-error`)).toHaveTextContent(
        'Password must be at least 12 characters'
      );
    });
  });

  it('rejects mismatched passwords before calling server', async () => {
    const user = userEvent.setup();
    render(<SecurityPanel />);

    await user.type(screen.getByTestId(SECURITY.CURRENT_PASSWORD_INPUT), 'OldStr0ng!Pass');
    await user.type(screen.getByTestId(SECURITY.NEW_PASSWORD_INPUT), 'NewStr0ng!Pass');
    await user.type(screen.getByTestId(SECURITY.CONFIRM_PASSWORD_INPUT), 'Different!Pass');
    fireEvent.submit(screen.getByTestId(SECURITY.CHANGE_PASSWORD_SUBMIT_BTN).closest('form')!);

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent('New passwords do not match');
    });
    expect(mockChangeAdminPassword).not.toHaveBeenCalled();
  });

  it('shows updating button text while changing password', () => {
    mockIsSubmitting = true;
    render(<SecurityPanel />);

    expect(screen.getByTestId(SECURITY.CHANGE_PASSWORD_SUBMIT_BTN)).toHaveTextContent('Updating…');
  });
});

describe('securityValidators.confirmPassword', () => {
  const formWith = (newPassword: unknown) => ({
    getFieldValue: (_name: string) => newPassword,
  });

  it('flags mismatch against the new password', () => {
    expect(
      securityValidators.confirmPassword({
        value: 'Different!Pass',
        fieldApi: { form: formWith('NewStr0ng!Pass') } as never,
      })
    ).toBe('New passwords do not match');
  });

  it('passes when confirm equals new password', () => {
    expect(
      securityValidators.confirmPassword({
        value: 'NewStr0ng!Pass',
        fieldApi: { form: formWith('NewStr0ng!Pass') } as never,
      })
    ).toBeUndefined();
  });

  it('keeps the required message when empty', () => {
    expect(
      securityValidators.confirmPassword({
        value: '',
        fieldApi: { form: formWith('NewStr0ng!Pass') } as never,
      })
    ).toBe('Please confirm your new password');
  });
});
