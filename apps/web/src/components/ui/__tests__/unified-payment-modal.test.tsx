import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { UnifiedPaymentModal } from '../unified-payment-modal';

beforeAll(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => (args?: Record<string, unknown>) =>
        args ? `${String(key)}-${JSON.stringify(args)}` : String(key),
    }
  ),
}));

const mockClaimPayment = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));
const mockUndoClaim = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));

vi.mock('@/server/expenses', () => ({
  claimPayment: mockClaimPayment,
  undoClaim: mockUndoClaim,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
}));

const defaultParticipant = {
  id: 101,
  amount: 50.0,
  colleague: { id: 1, name: 'Alice Smith' },
  expenseId: 10,
  colleagueId: 1,
  isPaid: false,
  isPending: false,
  hasPartialPayment: false,
  submittedAt: null,
};

const defaultProps = {
  participant: defaultParticipant,
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

describe('UnifiedPaymentModal', () => {
  it('renders modal when isOpen is true', () => {
    render(<UnifiedPaymentModal {...defaultProps} />);
    expect(screen.getByText('payment_modal_title')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<UnifiedPaymentModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('payment_modal_title')).not.toBeInTheDocument();
  });

  it('displays payment amount formatted', () => {
    render(<UnifiedPaymentModal {...defaultProps} />);
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  it('displays colleague name', () => {
    render(<UnifiedPaymentModal {...defaultProps} />);
    expect(screen.getByText('payment_modal_forName-{"name":"Alice Smith"}')).toBeInTheDocument();
  });

  it('displays payment method options', () => {
    render(<UnifiedPaymentModal {...defaultProps} />);
    expect(screen.getByText('payment_modal_payme')).toBeInTheDocument();
    expect(screen.getByText('payment_modal_fps')).toBeInTheDocument();
    expect(screen.getByText('payment_modal_cash')).toBeInTheDocument();
    expect(screen.getByText('payment_modal_other')).toBeInTheDocument();
  });

  it('has PAYME selected by default', () => {
    render(<UnifiedPaymentModal {...defaultProps} />);
    const paymeRadio = screen.getByRole('radio', { name: 'payment_modal_payme' });
    expect(paymeRadio).toBeChecked();
  });

  it('changes payment method when radio clicked', async () => {
    const user = userEvent.setup();
    render(<UnifiedPaymentModal {...defaultProps} />);

    const fpsRadio = screen.getByRole('radio', { name: 'payment_modal_fps' });
    await user.click(fpsRadio);

    expect(fpsRadio).toBeChecked();
    expect(screen.getByRole('radio', { name: 'payment_modal_payme' })).not.toBeChecked();
  });

  it('shows file upload area when no file selected', () => {
    render(<UnifiedPaymentModal {...defaultProps} />);
    expect(screen.getByText('payment_modal_clickToUpload')).toBeInTheDocument();
    expect(screen.getByText('payment_modal_supportedFormats')).toBeInTheDocument();
  });

  it('shows cancel and mark as paid buttons', () => {
    render(<UnifiedPaymentModal {...defaultProps} />);
    expect(screen.getByText('common_cancel')).toBeInTheDocument();
    expect(screen.getByText('payment_modal_markAsPaid')).toBeInTheDocument();
  });

  it('calls onClose when cancel button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<UnifiedPaymentModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByText('common_cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when dialog overlay clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<UnifiedPaymentModal {...defaultProps} onClose={onClose} />);

    const overlay = document.querySelector('[data-state="open"]');
    if (overlay) {
      await user.click(overlay);
    }
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables submit button when isProcessing is true', () => {
    render(<UnifiedPaymentModal {...defaultProps} isProcessing={true} />);
    const submitBtn = screen.getByText('payment_modal_submitting').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  it('disables cancel button when isProcessing is true', () => {
    render(<UnifiedPaymentModal {...defaultProps} isProcessing={true} />);
    const cancelBtn = screen.getByText('common_cancel').closest('button');
    expect(cancelBtn).toBeDisabled();
  });

  it('calls onSubmissionStart and onSubmissionHandler when provided', async () => {
    const user = userEvent.setup();
    const onSubmissionStart = vi.fn();
    const onSubmissionHandler = vi.fn().mockResolvedValue({ success: true });
    const onSuccess = vi.fn();

    render(
      <UnifiedPaymentModal
        {...defaultProps}
        onSubmissionStart={onSubmissionStart}
        onSubmissionHandler={onSubmissionHandler}
        onSuccess={onSuccess}
      />
    );

    await user.click(screen.getByText('payment_modal_markAsPaid'));

    expect(onSubmissionStart).toHaveBeenCalledOnce();
    expect(onSubmissionHandler).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('does not call onSuccess when external handler returns failure', async () => {
    const user = userEvent.setup();
    const onSubmissionHandler = vi.fn().mockResolvedValue({ success: false });
    const onSuccess = vi.fn();

    render(
      <UnifiedPaymentModal
        {...defaultProps}
        onSubmissionHandler={onSubmissionHandler}
        onSuccess={onSuccess}
      />
    );

    await user.click(screen.getByText('payment_modal_markAsPaid'));

    expect(onSubmissionHandler).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('prevents double submission when isProcessing', async () => {
    const onSubmissionHandler = vi.fn().mockResolvedValue({ success: true });

    render(
      <UnifiedPaymentModal
        {...defaultProps}
        isProcessing={true}
        onSubmissionHandler={onSubmissionHandler}
      />
    );

    const submitBtn = screen.getByText('payment_modal_submitting').closest('button');
    if (!submitBtn) throw new Error('submit button missing');
    // Disabled buttons still need the guard path exercised via fireEvent.
    fireEvent.click(submitBtn);

    expect(onSubmissionHandler).not.toHaveBeenCalled();
  });

  it('ignores empty file selections', () => {
    render(<UnifiedPaymentModal {...defaultProps} />);
    const input = document.getElementById('unified-proof-upload') as HTMLInputElement;
    fireEvent.change(input, { target: { files: null } });
    expect(screen.queryByText(/MB/)).not.toBeInTheDocument();
  });

  it('handles file selection and shows file name', async () => {
    const user = userEvent.setup();
    render(<UnifiedPaymentModal {...defaultProps} />);

    const file = new File(['test'], 'proof.png', { type: 'image/png' });
    const input = document.getElementById('unified-proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByText('proof.png')).toBeInTheDocument();
  });

  it('shows file size next to file name', async () => {
    const user = userEvent.setup();
    render(<UnifiedPaymentModal {...defaultProps} />);

    const file = new File(['test content'], 'proof.png', { type: 'image/png' });
    const input = document.getElementById('unified-proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByText(/MB/)).toBeInTheDocument();
  });

  it('removes selected file when remove button clicked', async () => {
    const user = userEvent.setup();
    render(<UnifiedPaymentModal {...defaultProps} />);

    const file = new File(['test'], 'proof.png', { type: 'image/png' });
    const input = document.getElementById('unified-proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByText('proof.png')).toBeInTheDocument();

    const removeBtn = screen.getByRole('button', { name: 'Remove proof file' });
    await user.click(removeBtn);

    expect(screen.queryByText('proof.png')).not.toBeInTheDocument();
    expect(screen.getByText('payment_modal_clickToUpload')).toBeInTheDocument();
  });

  it('shows PDF selected message for PDF files', async () => {
    const user = userEvent.setup();
    render(<UnifiedPaymentModal {...defaultProps} />);

    const file = new File(['pdf content'], 'proof.pdf', { type: 'application/pdf' });
    const input = document.getElementById('unified-proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByText('payment_modal_pdfSelected')).toBeInTheDocument();
  });

  it('shows image preview for image files', async () => {
    const user = userEvent.setup();
    render(<UnifiedPaymentModal {...defaultProps} />);

    const file = new File(['image data'], 'proof.png', { type: 'image/png' });
    const input = document.getElementById('unified-proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    // FileReader.readAsDataURL is async — wait for the preview image to appear
    await waitFor(() => {
      const previewImg = document.querySelector('img[alt="payment_modal_proofPreviewAlt"]');
      expect(previewImg).toBeInTheDocument();
    });
  });

  it('resets state when modal is closed and reopened', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<UnifiedPaymentModal {...defaultProps} onClose={onClose} />);

    const file = new File(['test'], 'proof.png', { type: 'image/png' });
    const input = document.getElementById('unified-proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByText('proof.png')).toBeInTheDocument();

    // Close modal
    await user.click(screen.getByText('common_cancel'));

    // Reopen
    rerender(<UnifiedPaymentModal {...defaultProps} onClose={onClose} isOpen={true} />);

    // File should be gone due to state reset
    expect(screen.queryByText('proof.png')).not.toBeInTheDocument();
  });

  it('shows error toast for invalid file type', async () => {
    render(<UnifiedPaymentModal {...defaultProps} />);

    const input = document.getElementById('unified-proof-upload') as HTMLInputElement;
    const file = new File(['test'], 'proof.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('payment_modal_invalidFileType');
    });
  });

  it('shows error toast for oversized file', async () => {
    const user = userEvent.setup();
    render(<UnifiedPaymentModal {...defaultProps} />);

    const file = new File([new Uint8Array(11 * 1024 * 1024)], 'proof.png', {
      type: 'image/png',
    });
    const input = document.getElementById('unified-proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('payment_modal_fileTooLarge');
    });
  });

  it('submits with proof file via external handler', async () => {
    const user = userEvent.setup();
    const onSubmissionHandler = vi.fn().mockResolvedValue({ success: true });
    const file = new File(['proof'], 'proof.png', { type: 'image/png' });

    render(<UnifiedPaymentModal {...defaultProps} onSubmissionHandler={onSubmissionHandler} />);

    const input = document.getElementById('unified-proof-upload') as HTMLInputElement;
    await user.upload(input, file);
    await user.click(screen.getByText('payment_modal_markAsPaid'));

    await waitFor(() => {
      expect(onSubmissionHandler).toHaveBeenCalledOnce();
    });

    const firstCall = onSubmissionHandler.mock.calls[0];
    if (!firstCall) throw new Error('Expected submission handler to be called');
    const formData = firstCall[1] as FormData;
    expect(formData.get('participantId')).toBe('101');
    expect(formData.get('paymentMethod')).toBe('PAYME');
    expect(formData.get('paymentProofFile')).toBe(file);
  });

  it('submits using internal claimPayment and shows undo action', async () => {
    const user = userEvent.setup();
    mockClaimPayment.mockResolvedValue({ success: true });
    mockUndoClaim.mockResolvedValue({ success: true });
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(<UnifiedPaymentModal {...defaultProps} onSuccess={onSuccess} onClose={onClose} />);

    await user.click(screen.getByText('payment_modal_markAsPaid'));

    await waitFor(() => {
      expect(mockClaimPayment).toHaveBeenCalledOnce();
      expect(toast.success).toHaveBeenCalledWith(
        'payment_modal_claimSubmitted',
        expect.objectContaining({
          description: 'payment_modal_claimPendingApproval',
          action: expect.objectContaining({ label: 'payment_modal_undo' }),
        })
      );
      expect(onSuccess).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    });

    const successCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'payment_modal_claimSubmitted'
    );
    expect(successCall).toBeDefined();
    if (!successCall?.[1]) throw new Error('Expected success call with options');
    const action = successCall[1].action;
    expect(action).toBeDefined();
    await (action as { onClick: () => Promise<void> }).onClick();

    await waitFor(() => {
      expect(mockUndoClaim).toHaveBeenCalledWith({
        data: { participantId: 101, type: 'PENDING' },
      });
      expect(toast.success).toHaveBeenCalledWith('payment_modal_claimCancelled');
      expect(onSuccess).toHaveBeenCalledTimes(2);
    });
  });

  it('shows error toast when internal claimPayment fails', async () => {
    const user = userEvent.setup();
    mockClaimPayment.mockRejectedValue(new Error('claim failed'));

    render(<UnifiedPaymentModal {...defaultProps} />);

    await user.click(screen.getByText('payment_modal_markAsPaid'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('payment_modal_submitFailed');
    });
  });

  it('shows error toast when undo claim fails', async () => {
    const user = userEvent.setup();
    mockClaimPayment.mockResolvedValue({ success: true });
    mockUndoClaim.mockRejectedValue(new Error('undo failed'));

    render(<UnifiedPaymentModal {...defaultProps} />);

    await user.click(screen.getByText('payment_modal_markAsPaid'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('payment_modal_claimSubmitted', expect.anything());
    });

    const successCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'payment_modal_claimSubmitted'
    );
    expect(successCall).toBeDefined();
    if (!successCall?.[1]) throw new Error('Expected success call with options');
    const action = successCall[1].action;
    expect(action).toBeDefined();
    await (action as { onClick: () => Promise<void> }).onClick();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('payment_modal_cancelFailed');
    });
  });

  it('displays empty name fallback when colleague name is missing', () => {
    const participantWithoutName = {
      ...defaultParticipant,
      colleague: { id: 1, name: '' },
    };
    render(<UnifiedPaymentModal {...defaultProps} participant={participantWithoutName} />);
    expect(screen.getByText('payment_modal_forName-{"name":""}')).toBeInTheDocument();
  });
});
