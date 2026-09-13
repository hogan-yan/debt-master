/**
 * Tests for PaymentProofUpload component
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentProofUpload } from '../payment-proof-upload';

const mockImageProcessor = vi.hoisted(() => ({
  processFile: vi.fn(),
  isProcessing: false,
  progress: 0,
  error: null as string | null,
  result: null as {
    processedFile: File;
    wasConverted: boolean;
    wasCompressed: boolean;
    originalSize: number;
    finalSize: number;
  } | null,
  reset: vi.fn(),
}));

const mockGetPaymentProofUrlByPaymentId = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastInfo = vi.hoisted(() => vi.fn());

vi.mock('@/hooks', () => ({
  useImageProcessor: () => mockImageProcessor,
}));

vi.mock('@/server/payments', () => ({
  getPaymentProofUrlByPaymentId: mockGetPaymentProofUrlByPaymentId,
}));

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
    info: mockToastInfo,
  },
}));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => () => String(key),
    }
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label htmlFor="payment-proof" {...props}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value?: number }) => <div data-testid="progress" data-value={value} />,
}));

vi.mock('./payment-proof-modal', () => ({
  PaymentProofModal: ({
    isOpen,
    proofUrl,
    onClose,
  }: {
    isOpen: boolean;
    proofUrl: string;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="proof-modal">
        {proofUrl}
        <button type="button" onClick={onClose}>
          close proof
        </button>
      </div>
    ) : null,
}));

const baseProps = {
  proofFile: null,
  existingProofUrl: null,
  keepExistingProof: true,
  showExistingProof: false,
  onProofFileChange: vi.fn(),
  onExistingProofUrlChange: vi.fn(),
  onKeepExistingProofChange: vi.fn(),
  onHadExistingProofChange: vi.fn(),
  onShowExistingProofChange: vi.fn(),
  onProcessingChange: vi.fn(),
};

function createFile(name: string, type: string, size = 1024): File {
  return new File(['x'.repeat(size)], name, { type });
}

function resetImageProcessor() {
  mockImageProcessor.processFile = vi.fn();
  mockImageProcessor.isProcessing = false;
  mockImageProcessor.progress = 0;
  mockImageProcessor.error = null;
  mockImageProcessor.result = null;
  mockImageProcessor.reset = vi.fn();
}

describe('PaymentProofUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetImageProcessor();
  });

  it('renders upload area when no proof exists', () => {
    render(<PaymentProofUpload {...baseProps} />);

    expect(screen.getByText('payment_form_uploadProof')).toBeInTheDocument();
    expect(screen.getByText('payment_form_supportedFormatsProof')).toBeInTheDocument();
  });

  it('fetches and displays existing proof URL', async () => {
    mockGetPaymentProofUrlByPaymentId.mockResolvedValue({ url: 'https://example.com/proof.pdf' });

    render(<PaymentProofUpload {...baseProps} paymentId={123} hasExistingPaymentProof />);

    await waitFor(() => {
      expect(mockGetPaymentProofUrlByPaymentId).toHaveBeenCalledWith({ data: { paymentId: 123 } });
    });

    await waitFor(() => {
      expect(baseProps.onExistingProofUrlChange).toHaveBeenCalledWith(
        'https://example.com/proof.pdf'
      );
      expect(baseProps.onHadExistingProofChange).toHaveBeenCalledWith(true);
    });
  });

  it('ignores a failed existing-proof URL request', async () => {
    mockGetPaymentProofUrlByPaymentId.mockRejectedValue(new Error('unavailable'));
    render(<PaymentProofUpload {...baseProps} paymentId={123} hasExistingPaymentProof />);

    await waitFor(() => {
      expect(mockGetPaymentProofUrlByPaymentId).toHaveBeenCalledWith({ data: { paymentId: 123 } });
    });
    expect(baseProps.onExistingProofUrlChange).not.toHaveBeenCalled();
    expect(baseProps.onHadExistingProofChange).not.toHaveBeenCalled();
  });

  it('displays existing proof block when URL and keep flag are set', () => {
    render(<PaymentProofUpload {...baseProps} existingProofUrl="https://example.com/proof.pdf" />);

    expect(screen.getByText('payment_form_existingProof')).toBeInTheDocument();
    expect(screen.getByText('payment_form_keepProofDesc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /payment_form_viewProofAria/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /payment_form_removeProofAria/i })
    ).toBeInTheDocument();
  });

  it('opens proof modal when viewing existing proof', async () => {
    const user = userEvent.setup();
    const onShowExistingProofChange = vi.fn();

    render(
      <PaymentProofUpload
        {...baseProps}
        existingProofUrl="https://example.com/proof.pdf"
        onShowExistingProofChange={onShowExistingProofChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /payment_form_viewProofAria/i }));
    expect(onShowExistingProofChange).toHaveBeenCalledWith(true);
  });

  it('closes the existing-proof modal', async () => {
    const user = userEvent.setup();
    const onShowExistingProofChange = vi.fn();
    render(
      <PaymentProofUpload
        {...baseProps}
        existingProofUrl="https://example.com/proof.pdf"
        showExistingProof
        onShowExistingProofChange={onShowExistingProofChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /common_close/i }));
    expect(onShowExistingProofChange).toHaveBeenCalledWith(false);
  });

  it('removes existing proof when remove clicked', async () => {
    const user = userEvent.setup();
    const onKeepExistingProofChange = vi.fn();

    render(
      <PaymentProofUpload
        {...baseProps}
        existingProofUrl="https://example.com/proof.pdf"
        onKeepExistingProofChange={onKeepExistingProofChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /payment_form_removeProofAria/i }));
    expect(onKeepExistingProofChange).toHaveBeenCalledWith(false);
  });

  it('prompts for a replacement proof after removing the existing proof', () => {
    render(
      <PaymentProofUpload
        {...baseProps}
        existingProofUrl="https://example.com/proof.pdf"
        keepExistingProof={false}
      />
    );

    expect(screen.getByText('payment_form_uploadNewProof')).toBeInTheDocument();
  });

  it('processes image file and updates proof file', async () => {
    const onProofFileChange = vi.fn();
    const processedFile = createFile('processed.png', 'image/png');
    mockImageProcessor.processFile.mockResolvedValue(processedFile);

    render(<PaymentProofUpload {...baseProps} onProofFileChange={onProofFileChange} />);

    const input = document.getElementById('payment-proof') as HTMLInputElement;
    const file = createFile('receipt.png', 'image/png');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockImageProcessor.processFile).toHaveBeenCalledWith(file);
    });

    await waitFor(() => {
      expect(onProofFileChange).toHaveBeenCalledWith(processedFile);
    });
  });

  it('does not update proof when image processing produces no file', async () => {
    const onProofFileChange = vi.fn();
    mockImageProcessor.processFile.mockResolvedValue(null);
    render(<PaymentProofUpload {...baseProps} onProofFileChange={onProofFileChange} />);

    const input = document.getElementById('payment-proof') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [createFile('receipt.png', 'image/png')] } });

    await waitFor(() => expect(mockImageProcessor.processFile).toHaveBeenCalled());
    expect(onProofFileChange).not.toHaveBeenCalled();
  });

  it('ignores file-change events without a file', () => {
    const onProofFileChange = vi.fn();
    render(<PaymentProofUpload {...baseProps} onProofFileChange={onProofFileChange} />);

    const input = document.getElementById('payment-proof');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Expected payment proof input to render');
    }
    fireEvent.change(input, { target: { files: [] } });

    expect(onProofFileChange).not.toHaveBeenCalled();
  });

  it('accepts PDF files directly', async () => {
    const onProofFileChange = vi.fn();

    render(<PaymentProofUpload {...baseProps} onProofFileChange={onProofFileChange} />);

    const input = document.getElementById('payment-proof') as HTMLInputElement;
    const file = createFile('proof.pdf', 'application/pdf');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onProofFileChange).toHaveBeenCalledWith(file);
    });
    expect(mockImageProcessor.processFile).not.toHaveBeenCalled();
  });

  it('rejects invalid file types', async () => {
    const onProofFileChange = vi.fn();

    render(<PaymentProofUpload {...baseProps} onProofFileChange={onProofFileChange} />);

    const input = document.getElementById('payment-proof') as HTMLInputElement;
    const file = createFile('malware.exe', 'application/x-msdownload');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('expense_form_invalidFileType');
    });
    expect(onProofFileChange).not.toHaveBeenCalled();
  });

  it('rejects PDF files larger than 10 MB', async () => {
    const onProofFileChange = vi.fn();

    render(<PaymentProofUpload {...baseProps} onProofFileChange={onProofFileChange} />);

    const input = document.getElementById('payment-proof') as HTMLInputElement;
    const file = createFile('large.pdf', 'application/pdf', 11 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('payment_modal_fileTooLarge');
    });
    expect(onProofFileChange).not.toHaveBeenCalled();
  });

  it('shows processing state and progress text', () => {
    mockImageProcessor.isProcessing = true;
    mockImageProcessor.progress = 25;

    render(<PaymentProofUpload {...baseProps} />);

    expect(screen.getByText('expense_form_processingImage')).toBeInTheDocument();
    expect(screen.getByText('expense_form_converting')).toBeInTheDocument();
    expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '25');
  });

  it('shows compression text when progress is above threshold', () => {
    mockImageProcessor.isProcessing = true;
    mockImageProcessor.progress = 50;

    render(<PaymentProofUpload {...baseProps} />);

    expect(screen.getByText('expense_form_compressing')).toBeInTheDocument();
  });

  it('displays processed file and optimization badges', () => {
    const processedFile = createFile('processed.png', 'image/png');

    mockImageProcessor.result = {
      processedFile,
      wasConverted: true,
      wasCompressed: true,
      originalSize: 2000,
      finalSize: 800,
    };

    render(<PaymentProofUpload {...baseProps} proofFile={processedFile} />);

    expect(screen.getByText('processed.png')).toBeInTheDocument();
    expect(screen.getByText('expense_form_optimized')).toBeInTheDocument();
  });

  it('removes selected file and keeps existing proof if available', async () => {
    const user = userEvent.setup();
    const onProofFileChange = vi.fn();
    const onKeepExistingProofChange = vi.fn();
    const proofFile = createFile('selected.png', 'image/png');

    render(
      <PaymentProofUpload
        {...baseProps}
        proofFile={proofFile}
        existingProofUrl="https://example.com/proof.pdf"
        onProofFileChange={onProofFileChange}
        onKeepExistingProofChange={onKeepExistingProofChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /common_remove/i }));

    expect(onProofFileChange).toHaveBeenCalledWith(null);
    expect(onKeepExistingProofChange).toHaveBeenCalledWith(true);
  });

  it('removes a selected file without restoring a missing existing proof', async () => {
    const user = userEvent.setup();
    const onKeepExistingProofChange = vi.fn();
    render(
      <PaymentProofUpload
        {...baseProps}
        proofFile={createFile('selected.png', 'image/png')}
        onKeepExistingProofChange={onKeepExistingProofChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /common_remove/i }));
    expect(onKeepExistingProofChange).not.toHaveBeenCalled();
  });
});
