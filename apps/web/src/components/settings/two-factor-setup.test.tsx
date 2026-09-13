import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TWO_FACTOR } from '@/test/test-ids';
import { TwoFactorSetup } from './two-factor-setup';

const mockEnableTwoFactor = vi.fn();
const mockDisableTwoFactor = vi.fn();
const mockGetTwoFactorStatus = vi.fn();
const mockVerifyTwoFactorSetup = vi.fn();
const mockToDataURL = vi.fn();
let mockIsSubmitting = false;

vi.mock('@/server/two-factor', () => ({
  enableTwoFactor: (...args: unknown[]) => mockEnableTwoFactor(...args),
  disableTwoFactor: (...args: unknown[]) => mockDisableTwoFactor(...args),
  getTwoFactorStatus: (...args: unknown[]) => mockGetTwoFactorStatus(...args),
  verifyTwoFactorSetup: (...args: unknown[]) => mockVerifyTwoFactorSetup(...args),
}));

vi.mock('@/hooks', () => ({
  useFormSubmission: () => ({
    isSubmitting: mockIsSubmitting,
    handleSubmit: async (fn: () => Promise<unknown>, _message?: string) => {
      await fn();
    },
  }),
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: (...args: unknown[]) => mockToDataURL(...args) },
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
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
      validate?: (values: { value: string }) => string | undefined;
    }
  ) => {
    const [error, setError] = useState<string | null>(null);
    const { validate, ...inputProps } = props;
    return (
      <>
        <input
          {...inputProps}
          onBlur={(event) => setError(validate?.({ value: event.target.value }) ?? null)}
        />
        {error && <span>{error}</span>}
      </>
    );
  },
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
  ShieldCheck: () => <svg data-testid="shield-check-icon" />,
  ShieldOff: () => <svg data-testid="shield-off-icon" />,
}));

describe('TwoFactorSetup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsSubmitting = false;
    mockGetTwoFactorStatus.mockResolvedValue({ enabled: false });
    mockEnableTwoFactor.mockResolvedValue({
      success: true,
      totpURI: 'otpauth://totp/Debt%20Master:admin@example.com?secret=ABC',
      backupCodes: ['backup-1', 'backup-2', 'backup-3', 'backup-4'],
    });
    mockDisableTwoFactor.mockResolvedValue({ success: true });
    mockVerifyTwoFactorSetup.mockResolvedValue({ success: true });
    mockToDataURL.mockResolvedValue('data:image/png;base64,fake');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state then disabled status', async () => {
    render(<TwoFactorSetup />);

    expect(screen.getByText(/Loading two-factor status/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(TWO_FACTOR.STATUS_DISABLED)).toBeInTheDocument();
    });
  });

  it('shows enabled status without enable form', async () => {
    mockGetTwoFactorStatus.mockResolvedValue({ enabled: true });
    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.getByTestId(TWO_FACTOR.STATUS_ENABLED)).toBeInTheDocument();
    });
    expect(screen.queryByTestId(TWO_FACTOR.ENABLE_BTN)).not.toBeInTheDocument();
  });

  it('enables 2FA, verifies a code, and shows backup codes', async () => {
    const user = userEvent.setup();
    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.getByTestId(TWO_FACTOR.STATUS_DISABLED)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(TWO_FACTOR.ENABLE_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(TWO_FACTOR.ENABLE_BTN));

    await waitFor(() => {
      expect(mockEnableTwoFactor).toHaveBeenCalledWith({ data: { password: 'Str0ng!Pass' } });
      expect(screen.getByTestId(TWO_FACTOR.QR_CODE)).toBeInTheDocument();
      expect(screen.getByTestId(TWO_FACTOR.VERIFY_CODE_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(TWO_FACTOR.VERIFY_CODE_INPUT), '123456');
    await user.click(screen.getByTestId(TWO_FACTOR.VERIFY_BTN));

    await waitFor(() => {
      expect(mockVerifyTwoFactorSetup).toHaveBeenCalledWith({ data: { code: '123456' } });
      expect(screen.getByTestId(TWO_FACTOR.STATUS_ENABLED)).toBeInTheDocument();
      expect(screen.getByTestId(TWO_FACTOR.BACKUP_CODES)).toBeInTheDocument();
    });
    expect(screen.getByText('backup-1')).toBeInTheDocument();
  });

  it('hides backup codes after clicking hide button', async () => {
    const user = userEvent.setup();
    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.getByTestId(TWO_FACTOR.STATUS_DISABLED)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(TWO_FACTOR.ENABLE_PASSWORD_INPUT), 'Str0ng!Pass');
    fireEvent.submit(screen.getByTestId(TWO_FACTOR.ENABLE_BTN).closest('form')!);

    await waitFor(() => {
      expect(screen.getByTestId(TWO_FACTOR.VERIFY_CODE_INPUT)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(TWO_FACTOR.VERIFY_CODE_INPUT), '123456');
    await user.click(screen.getByTestId(TWO_FACTOR.VERIFY_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(TWO_FACTOR.BACKUP_CODES)).toBeInTheDocument();
    });

    await user.click(screen.getByText('Hide backup codes'));

    await waitFor(() => {
      expect(screen.queryByTestId(TWO_FACTOR.BACKUP_CODES)).not.toBeInTheDocument();
    });
  });

  it('disables 2FA from enabled state', async () => {
    const user = userEvent.setup();
    mockGetTwoFactorStatus.mockResolvedValue({ enabled: true });
    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.getByTestId(TWO_FACTOR.STATUS_ENABLED)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(TWO_FACTOR.DISABLE_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(TWO_FACTOR.DISABLE_BTN));

    await waitFor(() => {
      expect(mockDisableTwoFactor).toHaveBeenCalledWith({ data: { password: 'Str0ng!Pass' } });
      expect(screen.getByTestId(TWO_FACTOR.STATUS_DISABLED)).toBeInTheDocument();
    });
  });

  it('handles QR code generation failure gracefully', async () => {
    const user = userEvent.setup();
    mockToDataURL.mockRejectedValue(new Error('QR failed'));
    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.getByTestId(TWO_FACTOR.STATUS_DISABLED)).toBeInTheDocument();
    });

    await user.type(screen.getByTestId(TWO_FACTOR.ENABLE_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(TWO_FACTOR.ENABLE_BTN));

    await waitFor(() => {
      expect(mockEnableTwoFactor).toHaveBeenCalled();
    });
    expect(screen.queryByTestId(TWO_FACTOR.QR_CODE)).not.toBeInTheDocument();
    expect(screen.getByTestId(TWO_FACTOR.VERIFY_CODE_INPUT)).toBeInTheDocument();
    expect(screen.queryByTestId(TWO_FACTOR.BACKUP_CODES)).not.toBeInTheDocument();
  });

  it('shows enabling button text while enabling 2FA', async () => {
    mockIsSubmitting = true;
    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.getByTestId(TWO_FACTOR.STATUS_DISABLED)).toBeInTheDocument();
    });

    expect(screen.getByTestId(TWO_FACTOR.ENABLE_BTN)).toHaveTextContent('Enabling…');
  });

  it('shows verifying button text while finalizing 2FA', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TwoFactorSetup />);
    await waitFor(() => expect(screen.getByTestId(TWO_FACTOR.STATUS_DISABLED)).toBeInTheDocument());
    await user.type(screen.getByTestId(TWO_FACTOR.ENABLE_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(TWO_FACTOR.ENABLE_BTN));

    await waitFor(() => expect(screen.getByTestId(TWO_FACTOR.VERIFY_BTN)).toBeInTheDocument());
    mockIsSubmitting = true;
    rerender(<TwoFactorSetup />);
    await waitFor(() =>
      expect(screen.getByTestId(TWO_FACTOR.VERIFY_BTN)).toHaveTextContent('Verifying…')
    );
  });

  it('shows disabling button text while disabling 2FA', async () => {
    mockIsSubmitting = true;
    mockGetTwoFactorStatus.mockResolvedValue({ enabled: true });
    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.getByTestId(TWO_FACTOR.STATUS_ENABLED)).toBeInTheDocument();
    });

    expect(screen.getByTestId(TWO_FACTOR.DISABLE_BTN)).toHaveTextContent('Disabling…');
  });

  it('validates empty, malformed, and valid setup verification codes', async () => {
    const user = userEvent.setup();
    render(<TwoFactorSetup />);
    await waitFor(() => expect(screen.getByTestId(TWO_FACTOR.STATUS_DISABLED)).toBeInTheDocument());
    await user.type(screen.getByTestId(TWO_FACTOR.ENABLE_PASSWORD_INPUT), 'Str0ng!Pass');
    await user.click(screen.getByTestId(TWO_FACTOR.ENABLE_BTN));
    await waitFor(() =>
      expect(screen.getByTestId(TWO_FACTOR.VERIFY_CODE_INPUT)).toBeInTheDocument()
    );

    const codeInput = screen.getByTestId(TWO_FACTOR.VERIFY_CODE_INPUT);
    await user.click(codeInput);
    await user.tab();
    expect(screen.getByText('Verification code is required')).toBeInTheDocument();
    await user.type(codeInput, 'abc');
    await user.tab();
    expect(screen.getByText('Enter a 6-digit code')).toBeInTheDocument();
    await user.clear(codeInput);
    await user.type(codeInput, '123456');
    await user.tab();
    expect(screen.queryByText('Enter a 6-digit code')).not.toBeInTheDocument();
  });

  it('renders nothing when status lookup fails (2FA disabled in env)', async () => {
    mockGetTwoFactorStatus.mockRejectedValue(new Error('unavailable'));
    render(<TwoFactorSetup />);

    await waitFor(() => {
      expect(screen.queryByTestId(TWO_FACTOR.SECTION)).not.toBeInTheDocument();
    });
  });
});
