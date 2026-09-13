/**
 * Tests for ReceiptUploadSection component
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPENSE_FORM } from '@/test/test-ids';
import { stringReaderResult } from '../../ui/payment-form-guards';
import { ReceiptUploadSection } from '../receipt-upload-section';

interface ImageProcessorState {
  processFile: ReturnType<typeof vi.fn>;
  isProcessing: boolean;
  progress: number;
  error: string | null;
  result: {
    processedFile: File;
    wasConverted: boolean;
    wasCompressed: boolean;
    originalSize: number;
    finalSize: number;
  } | null;
}

describe('stringReaderResult', () => {
  it('returns previews only for string reader results', () => {
    expect(stringReaderResult('data:image/png;base64,test')).toBe('data:image/png;base64,test');
    expect(stringReaderResult(new ArrayBuffer(0))).toBeNull();
  });
});

const mockImageProcessor = vi.hoisted(
  (): ImageProcessorState => ({
    processFile: vi.fn(),
    isProcessing: false,
    progress: 0,
    error: null,
    result: null,
  })
);

const mockGetExpenseReceiptUrl = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock('@/hooks', () => ({
  useImageProcessor: () => mockImageProcessor,
}));

vi.mock('@/server/expenses', () => ({
  getExpenseReceiptUrl: mockGetExpenseReceiptUrl,
}));

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
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

function createFile(name: string, type: string, size = 1024): File {
  return new File(['x'.repeat(size)], name, { type });
}

function resetImageProcessor() {
  mockImageProcessor.processFile = vi.fn();
  mockImageProcessor.isProcessing = false;
  mockImageProcessor.progress = 0;
  mockImageProcessor.error = null;
  mockImageProcessor.result = null;
}

const baseProps = {
  isEditing: false,
  onReceiptChange: vi.fn(),
  onKeepExistingChange: vi.fn(),
  onProcessingChange: vi.fn(),
  onExistingUrlChange: vi.fn(),
};

describe('ReceiptUploadSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetImageProcessor();
  });

  it('renders upload area when no existing receipt', () => {
    render(<ReceiptUploadSection {...baseProps} />);

    expect(screen.getByText('expense_form_clickToUploadReceipt')).toBeInTheDocument();
    expect(screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT)).toBeInTheDocument();
  });

  it('fetches and displays existing receipt when editing', async () => {
    mockGetExpenseReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });
    render(
      <ReceiptUploadSection
        {...baseProps}
        isEditing
        initialExpenseId={5}
        existingReceiptBucket="receipts"
        existingReceiptObjectKey="r.jpg"
      />
    );

    await waitFor(() => {
      expect(mockGetExpenseReceiptUrl).toHaveBeenCalledWith({ data: { expenseId: 5 } });
    });
    await waitFor(() => {
      expect(screen.getByText('expense_form_currentReceipt')).toBeInTheDocument();
    });
    expect(baseProps.onExistingUrlChange).toHaveBeenCalledWith('https://example.com/receipt.jpg');
  });

  it('skips setting existing receipt when url is missing', async () => {
    mockGetExpenseReceiptUrl.mockResolvedValue({ url: null });
    render(
      <ReceiptUploadSection
        {...baseProps}
        isEditing
        initialExpenseId={5}
        existingReceiptBucket="receipts"
        existingReceiptObjectKey="r.jpg"
      />
    );

    await waitFor(() => {
      expect(mockGetExpenseReceiptUrl).toHaveBeenCalled();
    });
    expect(screen.queryByText('expense_form_currentReceipt')).not.toBeInTheDocument();
  });

  it('handles error fetching existing receipt gracefully', async () => {
    mockGetExpenseReceiptUrl.mockRejectedValue(new Error('fail'));
    render(
      <ReceiptUploadSection
        {...baseProps}
        isEditing
        initialExpenseId={5}
        existingReceiptBucket="receipts"
        existingReceiptObjectKey="r.jpg"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('expense_form_clickToUploadReceipt')).toBeInTheDocument();
    });
  });

  it('removes existing receipt and switches to upload area', async () => {
    const user = userEvent.setup();
    mockGetExpenseReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });
    render(
      <ReceiptUploadSection
        {...baseProps}
        isEditing
        initialExpenseId={5}
        existingReceiptBucket="receipts"
        existingReceiptObjectKey="r.jpg"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('expense_form_currentReceipt')).toBeInTheDocument();
    });

    const removeBtn = screen.getByLabelText('expense_form_removeExistingReceipt');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(baseProps.onKeepExistingChange).toHaveBeenLastCalledWith(false);
    });
    expect(screen.getByText('expense_form_uploadNewReceipt')).toBeInTheDocument();
  });

  it('changes existing receipt via change button', async () => {
    const user = userEvent.setup();
    mockGetExpenseReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });
    render(
      <ReceiptUploadSection
        {...baseProps}
        isEditing
        initialExpenseId={5}
        existingReceiptBucket="receipts"
        existingReceiptObjectKey="r.jpg"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('expense_form_currentReceipt')).toBeInTheDocument();
    });

    await user.click(screen.getByText('expense_form_changeReceipt'));

    await waitFor(() => {
      expect(baseProps.onKeepExistingChange).toHaveBeenLastCalledWith(false);
    });
  });

  it('processes and previews uploaded image', async () => {
    const processedFile = createFile('receipt.jpg', 'image/jpeg');
    mockImageProcessor.processFile.mockResolvedValue(processedFile);
    render(<ReceiptUploadSection {...baseProps} />);
    const input = screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT);

    const file = createFile('original.jpg', 'image/jpeg');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockImageProcessor.processFile).toHaveBeenCalledWith(file);
    });
  });

  it('ignores an image when processing does not produce a file', async () => {
    mockImageProcessor.processFile.mockResolvedValue(null);
    render(<ReceiptUploadSection {...baseProps} />);
    const input = screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT);
    fireEvent.change(input, { target: { files: [createFile('original.jpg', 'image/jpeg')] } });

    await waitFor(() => expect(mockImageProcessor.processFile).toHaveBeenCalled());
    expect(baseProps.onReceiptChange).not.toHaveBeenCalledWith(expect.any(File));
  });

  it('ignores file changes without a selected file', () => {
    render(<ReceiptUploadSection {...baseProps} />);
    fireEvent.change(screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT), {
      target: { files: [] },
    });

    expect(mockImageProcessor.processFile).not.toHaveBeenCalled();
    expect(baseProps.onReceiptChange).toHaveBeenCalledWith(null);
  });

  it('accepts PDF upload', async () => {
    render(<ReceiptUploadSection {...baseProps} />);
    const input = screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT);

    const file = createFile('receipt.pdf', 'application/pdf');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(baseProps.onReceiptChange).toHaveBeenCalledWith(file);
    });
  });

  it('rejects invalid file type', async () => {
    render(<ReceiptUploadSection {...baseProps} />);
    const input = screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT);

    const file = createFile('receipt.txt', 'text/plain');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('expense_form_invalidFileType');
    });
  });

  it('rejects oversized PDF', async () => {
    render(<ReceiptUploadSection {...baseProps} />);
    const input = screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT);

    const file = createFile('big.pdf', 'application/pdf', 11 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('payment_modal_fileTooLarge');
    });
  });

  it('shows processing state', () => {
    mockImageProcessor.isProcessing = true;
    mockImageProcessor.progress = 25;
    render(<ReceiptUploadSection {...baseProps} />);

    expect(screen.getByText('expense_form_processingImage')).toBeInTheDocument();
    expect(screen.getByText('expense_form_converting')).toBeInTheDocument();
  });

  it('shows compressing text when progress is high', () => {
    mockImageProcessor.isProcessing = true;
    mockImageProcessor.progress = 50;
    render(<ReceiptUploadSection {...baseProps} />);

    expect(screen.getByText('expense_form_compressing')).toBeInTheDocument();
  });

  it('disables upload while processing', () => {
    mockImageProcessor.isProcessing = true;
    render(<ReceiptUploadSection {...baseProps} />);

    expect(screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT)).toBeDisabled();
  });

  it('removes uploaded file and resets input', async () => {
    const user = userEvent.setup();
    render(<ReceiptUploadSection {...baseProps} />);
    const input = screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT);

    const file = createFile('receipt.pdf', 'application/pdf');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(baseProps.onReceiptChange).toHaveBeenCalledWith(file);
    });

    const removeBtn = screen.getByLabelText('expense_form_removeUploadedFile');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(baseProps.onReceiptChange).toHaveBeenLastCalledWith(null);
    });
  });

  it('shows optimized badge when image was compressed', () => {
    mockImageProcessor.result = {
      processedFile: createFile('receipt.jpg', 'image/jpeg'),
      wasConverted: false,
      wasCompressed: true,
      originalSize: 1024,
      finalSize: 512,
    };
    render(<ReceiptUploadSection {...baseProps} />);
    const input = screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT);

    const file = createFile('receipt.pdf', 'application/pdf');
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('expense_form_optimized')).toBeInTheDocument();
  });

  it('shows both optimization icons when an image was converted and compressed', async () => {
    const processedFile = createFile('receipt.jpg', 'image/jpeg');
    mockImageProcessor.processFile.mockResolvedValue(processedFile);
    mockImageProcessor.result = {
      processedFile,
      wasConverted: true,
      wasCompressed: true,
      originalSize: 1024,
      finalSize: 512,
    };
    render(<ReceiptUploadSection {...baseProps} />);
    fireEvent.change(screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT), {
      target: { files: [createFile('original.jpg', 'image/jpeg')] },
    });

    await waitFor(() => expect(screen.getByText('expense_form_optimized')).toBeInTheDocument());
  });

  it('shows PDF selected message for uploaded PDF', async () => {
    render(<ReceiptUploadSection {...baseProps} />);
    const input = screen.getByTestId(EXPENSE_FORM.RECEIPT_UPLOAD_INPUT);

    const file = createFile('receipt.pdf', 'application/pdf');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('expense_form_pdfSelected')).toBeInTheDocument();
    });
  });

  it('syncs processing state to parent', () => {
    mockImageProcessor.isProcessing = true;
    render(<ReceiptUploadSection {...baseProps} />);

    expect(baseProps.onProcessingChange).toHaveBeenCalledWith(true);
  });

  it('opens existing receipt in new tab when clicked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    mockGetExpenseReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });
    render(
      <ReceiptUploadSection
        {...baseProps}
        isEditing
        initialExpenseId={5}
        existingReceiptBucket="receipts"
        existingReceiptObjectKey="r.jpg"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('expense_form_currentReceipt')).toBeInTheDocument();
    });

    const viewBtn = screen.getByLabelText('expense_form_clickToViewFullSize');
    fireEvent.click(viewBtn);

    expect(openSpy).toHaveBeenCalledWith('https://example.com/receipt.jpg', '_blank');
    openSpy.mockRestore();
  });
});
