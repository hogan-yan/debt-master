import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseHeader } from '../expense-header';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_, key) => () => String(key) }),
}));

vi.mock('@/paraglide/runtime', () => ({
  getLocale: () => 'en',
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

import { toast } from 'sonner';

describe('ExpenseHeader', () => {
  const defaultProps = {
    restaurantName: 'Pizza Place',
    amount: 50,
    participantCount: 3,
    date: '2024-06-15T00:00:00Z',
  };

  let user: ReturnType<typeof userEvent.setup>;
  let writeTextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // userEvent.setup() attaches its own Clipboard stub to navigator.clipboard.
    // We must call it before spying on writeText so the spy wraps the stub.
    user = userEvent.setup();
    writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    // Remove navigator.share/canShare so they don't leak between tests
    delete (navigator as unknown as Record<string, unknown>).share;
    delete (navigator as unknown as Record<string, unknown>).canShare;
  });

  it('renders back link to expenses', () => {
    render(<ExpenseHeader {...defaultProps} />);
    const backLink = screen.getByRole('link', { name: /expense_detail_backToExpenses/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/expenses/');
  });

  it('renders share button', () => {
    render(<ExpenseHeader {...defaultProps} />);
    expect(screen.getByText('expense_detail_share')).toBeInTheDocument();
  });

  it('renders copy link button', () => {
    render(<ExpenseHeader {...defaultProps} />);
    expect(screen.getByText('expense_detail_copyLink')).toBeInTheDocument();
  });

  it('copies URL on copy link click', async () => {
    render(<ExpenseHeader {...defaultProps} />);

    await user.click(screen.getByText('expense_detail_copyLink'));

    expect(writeTextSpy).toHaveBeenCalledWith(window.location.href);
  });

  it('shows success toast on copy', async () => {
    render(<ExpenseHeader {...defaultProps} />);

    await user.click(screen.getByText('expense_detail_copyLink'));

    expect(toast.success).toHaveBeenCalledWith('expense_detail_linkCopied');
  });

  it('shows error toast on copy failure', async () => {
    writeTextSpy.mockRejectedValueOnce(new Error('fail'));
    render(<ExpenseHeader {...defaultProps} />);

    await user.click(screen.getByText('expense_detail_copyLink'));

    expect(toast.error).toHaveBeenCalledWith('expense_detail_copyLinkFailed');
  });

  it('uses Web Share API when available', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });

    render(<ExpenseHeader {...defaultProps} />);

    await user.click(screen.getByText('expense_detail_share'));

    expect(mockShare).toHaveBeenCalled();
  });

  it('falls back to copy when share cancelled', async () => {
    const mockShare = vi.fn().mockRejectedValue(new Error('cancelled'));
    Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });

    render(<ExpenseHeader {...defaultProps} />);

    await user.click(screen.getByText('expense_detail_share'));

    expect(mockShare).toHaveBeenCalled();
    expect(writeTextSpy).toHaveBeenCalled();
  });

  it('falls back to copy when Web Share not available', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });

    render(<ExpenseHeader {...defaultProps} />);

    await user.click(screen.getByText('expense_detail_share'));

    expect(writeTextSpy).toHaveBeenCalled();
  });

  it('formats share text with date and amount', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });

    render(<ExpenseHeader {...defaultProps} />);

    await user.click(screen.getByText('expense_detail_share'));

    const shareCall = mockShare.mock.calls[0]![0];
    // m proxy returns key name as string; verify the share text includes the shareTotal message
    expect(shareCall.text).toContain('expense_detail_shareTotal');
    expect(shareCall.text).toContain(window.location.href);
  });

  it('shares when restaurantName not provided', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });

    render(<ExpenseHeader {...defaultProps} restaurantName={undefined} />);

    await user.click(screen.getByText('expense_detail_share'));

    expect(mockShare).toHaveBeenCalled();
  });

  it('handles Date object input for date', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });

    render(<ExpenseHeader {...defaultProps} date={new Date('2024-06-15')} />);

    await user.click(screen.getByText('expense_detail_share'));

    const shareCall = mockShare.mock.calls[0]![0];
    expect(shareCall.text).toContain('expense_detail_shareTotal');
  });

  it('handles missing date in share text', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });

    render(<ExpenseHeader {...defaultProps} date={undefined} />);

    await user.click(screen.getByText('expense_detail_share'));

    const shareCall = mockShare.mock.calls[0]![0];
    expect(shareCall.text).toContain('expense_detail_shareTotal');
  });
});
