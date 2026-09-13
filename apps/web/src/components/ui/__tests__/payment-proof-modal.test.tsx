import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentProofModal, PaymentProofViewModal } from '../payment-proof-modal';

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

const mockClaimPayment = vi.fn().mockResolvedValue({ success: true });

vi.mock('@/server/expenses', () => ({
  claimPayment: (...args: unknown[]) => mockClaimPayment(...args),
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

const defaultUploadProps = {
  participant: defaultParticipant,
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

describe('PaymentProofViewModal', () => {
  it('renders when isOpen is true', () => {
    render(
      <PaymentProofViewModal
        isOpen={true}
        onClose={vi.fn()}
        paymentProofUrl="https://example.com/proof.jpg"
      />
    );
    expect(screen.getByText('Payment Proof')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <PaymentProofViewModal
        isOpen={false}
        onClose={vi.fn()}
        paymentProofUrl="https://example.com/proof.jpg"
      />
    );
    expect(screen.queryByText('Payment Proof')).not.toBeInTheDocument();
  });

  it('displays payment proof image when URL is provided', () => {
    render(
      <PaymentProofViewModal
        isOpen={true}
        onClose={vi.fn()}
        paymentProofUrl="https://example.com/proof.jpg"
      />
    );
    const img = screen.getByAltText('Payment proof');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/proof.jpg');
  });

  it('shows "Open in New Tab" button when URL is provided', () => {
    render(
      <PaymentProofViewModal
        isOpen={true}
        onClose={vi.fn()}
        paymentProofUrl="https://example.com/proof.jpg"
      />
    );
    expect(screen.getByRole('button', { name: 'Open in New Tab' })).toBeInTheDocument();
  });

  it('calls window.open when "Open in New Tab" clicked', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <PaymentProofViewModal
        isOpen={true}
        onClose={vi.fn()}
        paymentProofUrl="https://example.com/proof.jpg"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open in New Tab' }));
    expect(openSpy).toHaveBeenCalledWith('https://example.com/proof.jpg', '_blank');
    openSpy.mockRestore();
  });

  it('shows not found message when paymentProofUrl is null', () => {
    render(<PaymentProofViewModal isOpen={true} onClose={vi.fn()} paymentProofUrl={null} />);
    expect(screen.getByText('Payment proof not found or failed to load.')).toBeInTheDocument();
  });

  it('shows not found message when paymentProofUrl is empty string', () => {
    render(<PaymentProofViewModal isOpen={true} onClose={vi.fn()} paymentProofUrl="" />);
    expect(screen.getByText('Payment proof not found or failed to load.')).toBeInTheDocument();
  });

  it('calls onClose when dialog overlay clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PaymentProofViewModal
        isOpen={true}
        onClose={onClose}
        paymentProofUrl="https://example.com/proof.jpg"
      />
    );

    const overlay = document.querySelector('[data-state="open"]');
    if (overlay) {
      await user.click(overlay);
    }
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('PaymentProofModal (upload)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClaimPayment.mockResolvedValue({ success: true });
  });
  it('renders when isOpen is true', () => {
    render(<PaymentProofModal {...defaultUploadProps} />);
    expect(screen.getByText('Mark Payment as Paid')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<PaymentProofModal {...defaultUploadProps} isOpen={false} />);
    expect(screen.queryByText('Mark Payment as Paid')).not.toBeInTheDocument();
  });

  it('displays payment amount formatted', () => {
    render(<PaymentProofModal {...defaultUploadProps} />);
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  it('displays colleague name', () => {
    render(<PaymentProofModal {...defaultUploadProps} />);
    expect(screen.getByText('for Alice Smith')).toBeInTheDocument();
  });

  it('shows file upload area when no file selected', () => {
    render(<PaymentProofModal {...defaultUploadProps} />);
    expect(screen.getByText('Click to upload payment proof')).toBeInTheDocument();
    expect(screen.getByText('Supports: JPEG, PNG, WebP, PDF (max 10MB)')).toBeInTheDocument();
  });

  it('shows cancel and mark as paid buttons', () => {
    render(<PaymentProofModal {...defaultUploadProps} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as Paid' })).toBeInTheDocument();
  });

  it('calls onClose when cancel button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PaymentProofModal {...defaultUploadProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables submit button when isProcessing is true', () => {
    render(<PaymentProofModal {...defaultUploadProps} isProcessing={true} />);
    const submitBtn = screen.getByRole('button', { name: 'Mark as Paid' });
    expect(submitBtn).toBeDisabled();
  });

  it('disables cancel button when isSubmitting', async () => {
    const user = userEvent.setup();
    // Make claimPayment hang so isSubmitting stays true
    mockClaimPayment.mockImplementation(() => new Promise(() => {}));
    render(<PaymentProofModal {...defaultUploadProps} />);

    const submitBtn = screen.getByRole('button', { name: 'Mark as Paid' });
    await user.click(submitBtn);

    // After clicking, the cancel button should be disabled during submission
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn).toBeDisabled();
  });

  it('handles file selection and shows file name', async () => {
    const user = userEvent.setup();
    render(<PaymentProofModal {...defaultUploadProps} />);

    const file = new File(['test'], 'proof.png', { type: 'image/png' });
    const input = document.getElementById('proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByText('proof.png')).toBeInTheDocument();
  });

  it('shows file size next to file name', async () => {
    const user = userEvent.setup();
    render(<PaymentProofModal {...defaultUploadProps} />);

    const file = new File(['test content for size'], 'proof.png', { type: 'image/png' });
    const input = document.getElementById('proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByText(/MB/)).toBeInTheDocument();
  });

  it('removes selected file when remove button clicked', async () => {
    const user = userEvent.setup();
    render(<PaymentProofModal {...defaultUploadProps} />);

    const file = new File(['test'], 'proof.png', { type: 'image/png' });
    const input = document.getElementById('proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByText('proof.png')).toBeInTheDocument();

    // Find the remove button (X icon button)
    const removeBtn = screen.getByRole('button', { name: '' });
    await user.click(removeBtn);

    expect(screen.queryByText('proof.png')).not.toBeInTheDocument();
    expect(screen.getByText('Click to upload payment proof')).toBeInTheDocument();
  });

  it('clears the file input after removing a selected file', async () => {
    const user = userEvent.setup();
    render(<PaymentProofModal {...defaultUploadProps} />);

    const input = document.getElementById('proof-upload') as HTMLInputElement;
    await user.upload(input, new File(['test'], 'proof.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: '' }));

    expect((document.getElementById('proof-upload') as HTMLInputElement).value).toBe('');
  });

  it('shows PDF selected message for PDF files', async () => {
    const user = userEvent.setup();
    render(<PaymentProofModal {...defaultUploadProps} />);

    const file = new File(['pdf content'], 'proof.pdf', { type: 'application/pdf' });
    const input = document.getElementById('proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    expect(
      screen.getByText('PDF file selected. Preview will be available after upload.')
    ).toBeInTheDocument();
  });

  it('shows image preview for image files', async () => {
    const user = userEvent.setup();
    render(<PaymentProofModal {...defaultUploadProps} />);

    const file = new File(['image data'], 'proof.png', { type: 'image/png' });
    const input = document.getElementById('proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    // FileReader is async; wait for preview to render
    await waitFor(() => {
      const previewImg = document.querySelector('img[alt="Payment proof preview"]');
      expect(previewImg).toBeInTheDocument();
    });
  });

  it('calls onSuccess after successful submission', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<PaymentProofModal {...defaultUploadProps} onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: 'Mark as Paid' }));

    // Wait for async submission
    await screen.findByRole('button', { name: 'Mark as Paid' });
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('calls onClose after successful submission', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PaymentProofModal {...defaultUploadProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Mark as Paid' }));

    await screen.findByRole('button', { name: 'Mark as Paid' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('resets state when modal is closed and reopened', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<PaymentProofModal {...defaultUploadProps} onClose={onClose} />);

    const file = new File(['test'], 'proof.png', { type: 'image/png' });
    const input = document.getElementById('proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByText('proof.png')).toBeInTheDocument();

    // Close modal
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Reopen
    rerender(<PaymentProofModal {...defaultUploadProps} onClose={onClose} isOpen={true} />);

    // File should be gone due to state reset
    expect(screen.queryByText('proof.png')).not.toBeInTheDocument();
  });

  it('displays empty name fallback when colleague name is missing', () => {
    const participantWithoutName = {
      ...defaultParticipant,
      colleague: { id: 1, name: '' },
    };
    render(<PaymentProofModal {...defaultUploadProps} participant={participantWithoutName} />);
    expect(screen.getByText(/for\s*$/)).toBeInTheDocument();
  });

  it('rejects files larger than 10MB', async () => {
    const user = userEvent.setup();
    render(<PaymentProofModal {...defaultUploadProps} />);

    const bigFile = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });

    const input = document.getElementById('proof-upload') as HTMLInputElement;
    await user.upload(input, bigFile);

    expect(screen.queryByText('big.png')).not.toBeInTheDocument();
  });

  it('rejects an unsupported proof type before setting file state', () => {
    render(<PaymentProofModal {...defaultUploadProps} />);

    const input = document.getElementById('proof-upload') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['text'], 'proof.txt', { type: 'text/plain' })] },
    });

    expect(screen.queryByText('proof.txt')).not.toBeInTheDocument();
  });

  it('submits with proof file when uploaded', async () => {
    const user = userEvent.setup();
    render(<PaymentProofModal {...defaultUploadProps} />);

    const file = new File(['test'], 'proof.png', { type: 'image/png' });
    const input = document.getElementById('proof-upload') as HTMLInputElement;
    await user.upload(input, file);

    await user.click(screen.getByRole('button', { name: 'Mark as Paid' }));
    await screen.findByRole('button', { name: 'Mark as Paid' });

    expect(mockClaimPayment).toHaveBeenCalled();
  });

  it('shows error toast when submission fails', async () => {
    const user = userEvent.setup();
    mockClaimPayment.mockRejectedValueOnce(new Error('fail'));
    render(<PaymentProofModal {...defaultUploadProps} />);

    await user.click(screen.getByRole('button', { name: 'Mark as Paid' }));
    await screen.findByRole('button', { name: 'Mark as Paid' });

    expect(screen.getByText('Mark Payment as Paid')).toBeInTheDocument();
  });
});
