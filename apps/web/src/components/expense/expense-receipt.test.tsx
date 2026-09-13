import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseReceipt } from './expense-receipt';

vi.mock('@/server/expenses', () => ({
  getExpenseReceiptUrl: vi.fn(),
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    expense_detail_receipt: () => 'Receipt',
    expense_detail_receiptImageAlt: () => 'Receipt image',
    expense_detail_viewFullSize: () => 'View Full Size',
    expense_detail_openInNewTab: () => 'Open in New Tab',
    expense_toast_noReceipt: () => 'No receipt found',
    expense_detail_receiptUploadHint: () => 'Upload a receipt',
    expense_detail_receiptModalTitle: ({ restaurant }: { restaurant: string }) =>
      `Receipt - ${restaurant}`,
    expense_detail_unknownRestaurant: () => 'Unknown Restaurant',
  },
}));

vi.mock('@/utils/auth-context', () => ({
  AdminOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { getExpenseReceiptUrl } from '@/server/expenses';

const mockGetReceiptUrl = vi.mocked(getExpenseReceiptUrl);

describe('ExpenseReceipt', () => {
  it('shows loading state initially', () => {
    mockGetReceiptUrl.mockReturnValue(new Promise(() => {}));
    render(<ExpenseReceipt expenseId={1} />);
    expect(screen.getByText('Receipt')).toBeInTheDocument();
  });

  it('shows receipt when URL is returned', async () => {
    mockGetReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });
    render(<ExpenseReceipt expenseId={1} restaurantName="Test Restaurant" />);

    await waitFor(() => {
      expect(screen.getByAltText('Receipt image')).toBeInTheDocument();
    });

    expect(screen.getByText('View Full Size')).toBeInTheDocument();
    expect(screen.getByText('Open in New Tab')).toBeInTheDocument();
  });

  it('shows no receipt message when URL is null', async () => {
    mockGetReceiptUrl.mockResolvedValue({ url: null });
    render(<ExpenseReceipt expenseId={1} />);

    await waitFor(() => {
      expect(screen.getByText('No receipt found')).toBeInTheDocument();
    });

    expect(screen.getByText('Upload a receipt')).toBeInTheDocument();
  });

  it('shows no receipt message on fetch error', async () => {
    mockGetReceiptUrl.mockRejectedValue(new Error('Network error'));
    render(<ExpenseReceipt expenseId={1} />);

    await waitFor(() => {
      expect(screen.getByText('No receipt found')).toBeInTheDocument();
    });
  });

  it('opens modal when clicking view full size', async () => {
    const user = userEvent.setup();
    mockGetReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });
    render(<ExpenseReceipt expenseId={1} restaurantName="Test Restaurant" />);

    await waitFor(() => {
      expect(screen.getByText('View Full Size')).toBeInTheDocument();
    });

    await user.click(screen.getByText('View Full Size'));
    expect(screen.getByText('Receipt - Test Restaurant')).toBeInTheDocument();
  });

  it('opens modal when clicking the receipt image', async () => {
    const user = userEvent.setup();
    mockGetReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });
    render(<ExpenseReceipt expenseId={1} restaurantName="Test Restaurant" />);

    const image = await screen.findByAltText('Receipt image');
    // Image sits inside the trigger button (line 80 onClick)
    await user.click(image);
    expect(screen.getByText('Receipt - Test Restaurant')).toBeInTheDocument();
  });

  it('opens receipt URL in new tab when clicking open in new tab', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    mockGetReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });
    render(<ExpenseReceipt expenseId={1} restaurantName="Test Restaurant" />);

    await waitFor(() => {
      expect(screen.getByText('Open in New Tab')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Open in New Tab'));
    expect(openSpy).toHaveBeenCalledWith('https://example.com/receipt.jpg', '_blank');

    openSpy.mockRestore();
  });

  it('fetches receipt on expenseId change', async () => {
    mockGetReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt.jpg' });
    const { rerender } = render(<ExpenseReceipt expenseId={1} />);

    await waitFor(() => {
      expect(screen.getByAltText('Receipt image')).toBeInTheDocument();
    });

    mockGetReceiptUrl.mockResolvedValue({ url: 'https://example.com/receipt2.jpg' });
    rerender(<ExpenseReceipt expenseId={2} />);

    expect(mockGetReceiptUrl).toHaveBeenCalledWith({ data: { expenseId: 2 } });
  });
});
