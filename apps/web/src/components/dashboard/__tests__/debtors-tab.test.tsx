import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DebtorsTab, runBulkClaimForDebtor } from '../debtors-tab';

// Helper to fire keyboard events on expense cards
// Using fireEvent.keyDown because userEvent doesn't support keyDown on non-interactive elements well
async function fireKeyOnCard(card: HTMLElement, key: string) {
  await fireEvent.keyDown(card, { key, code: key, bubbles: true });
}

const mockNavigate = vi.fn();
const mockInvalidate = vi.fn();
let mockIsAdmin = false;

// handleSubmit invoked by handleBulkClaim must actually run the async fn passed
// to it (the real hook does); a bare vi.fn() would swallow it and leave the
// bulk-claim body uncovered.
const mockHandleSubmit = vi.fn(async (fn: () => Promise<unknown>) => {
  await fn();
});

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, invalidate: mockInvalidate }),
}));

vi.mock('@/components/admin/bulk-claim-modal', () => ({
  BulkClaimModal: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: (paymentType: string) => void;
    onOpenChange: (v: boolean) => void;
  }) =>
    open ? (
      <div data-testid="bulk-claim-modal">
        Bulk Claim Modal
        <button type="button" data-testid="bulk-claim-confirm" onClick={() => onConfirm('PAYME')}>
          Confirm
        </button>
      </div>
    ) : null,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode }) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/hooks', () => ({
  useFormSubmission: () => ({ handleSubmit: mockHandleSubmit, isSubmitting: false }),
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    dashboard_whoNeedsToPay: () => 'Who Needs to Pay',
    dashboard_allPaidUp: () => 'All Paid Up',
    dashboard_noOutstandingDebts: () => 'No outstanding debts',
    dashboard_owes: ({ amount }: { amount: string }) => `Owes ${amount}`,
    dashboard_daysSincePayment: ({ count }: { count: number }) => `${count} days`,
    dashboard_unpaidCount: ({ count }: { count: number }) => `${count} unpaid`,
    dashboard_unpaidExpensesCount: ({ count }: { count: number }) => `${count} unpaid expenses`,
    dashboard_viewAllExpenses: () => 'View All',
    dashboard_unpaidExpensesTitle: ({ count }: { count: number }) => `Unpaid Expenses (${count})`,
    dashboard_totalLabel: ({ amount }: { amount: string }) => `Total: ${amount}`,
    dashboard_ofAmount: ({ amount }: { amount: string }) => `of ${amount}`,
    dashboard_paidLabel: ({ amount }: { amount: string }) => `Paid: ${amount}`,
    dashboard_claimAll: ({ amount }: { amount: string }) => `Claim ${amount}`,
    dashboard_paymentCreatedSuccess: () => 'Payment created',
    dashboard_claimedSuccess: ({ amount, name }: { amount: string; name: string }) =>
      `Claimed ${amount} from ${name}`,
    expense_detail_receiptImageAlt: () => 'Receipt',
    expense_detail_openInNewTab: () => 'Open',
    common_unknown: () => 'Unknown',
    common_cancel: () => 'Cancel',
    payment_modal_title: () => 'Payment',
    payment_modal_payme: () => 'PayMe',
    payment_modal_fps: () => 'FPS',
    payment_modal_cash: () => 'Cash',
    payment_modal_other: () => 'Other',
    expense_modal_amountLabel: () => 'Amount:',
    expense_modal_forLabel: () => 'For:',
    payment_modal_paymentMethod: () => 'Method',
    expense_modal_paymentProofOptional: () => 'Proof',
    expense_modal_uploadProofDescription: () => 'Upload proof',
    payment_modal_submitting: () => 'Submitting...',
    payment_modal_markAsPaid: () => 'Mark as Paid',
  },
}));

vi.mock('@/paraglide/runtime', () => ({
  getLocale: () => 'en-US',
}));

vi.mock('@/server/payments/mutations', () => ({
  bulkClaimForColleague: vi.fn(),
}));

vi.mock('@/utils/auth-client', () => ({
  getAuthToken: () => 'token123',
}));

vi.mock('@/utils/auth-context', () => ({
  useAuth: () => ({ isAdmin: mockIsAdmin }),
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (n: number) => `$${n.toFixed(2)}`,
}));

const mockDebtors = [
  {
    id: 1,
    name: 'Alice',
    currentBalance: -100,
    daysSinceLastPayment: 5,
    unpaidExpenses: [
      {
        id: 101,
        date: '2024-01-15',
        restaurantName: 'Sushi Bar',
        restaurantId: 1,
        totalAmount: 200,
        colleagueAmount: 50,
        participantId: 1,
        notes: 'Team lunch',
        participantCount: 4,
        splitType: 'EQUAL',
        remainingOwed: 100,
        totalApprovedPaid: 50,
      },
    ],
  },
  {
    id: 2,
    name: 'Bob',
    currentBalance: 50,
    daysSinceLastPayment: 0,
    unpaidExpenses: [],
  },
];

describe('DebtorsTab', () => {
  beforeEach(() => {
    mockIsAdmin = false;
    vi.clearAllMocks();
  });

  it('renders empty state when no debtors', () => {
    render(<DebtorsTab validDebtors={[]} />);
    expect(screen.getByText('All Paid Up')).toBeInTheDocument();
    expect(screen.getByText('No outstanding debts')).toBeInTheDocument();
  });

  it('renders debtor list when debtors provided', () => {
    render(<DebtorsTab validDebtors={mockDebtors} />);
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(1);
  });

  it('shows owes amount for debtors', () => {
    render(<DebtorsTab validDebtors={mockDebtors} />);
    expect(screen.getAllByText('Owes $100.00').length).toBeGreaterThanOrEqual(1);
  });

  it('shows days since payment', () => {
    render(<DebtorsTab validDebtors={mockDebtors} />);
    expect(screen.getAllByText('5 days').length).toBeGreaterThanOrEqual(1);
  });

  it('toggles expansion to show unpaid expenses', async () => {
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    expect(screen.getByText('Unpaid Expenses (1)')).toBeInTheDocument();
    expect(screen.getAllByText('Sushi Bar').length).toBeGreaterThanOrEqual(1);
  });

  it('shows paid label when totalApprovedPaid > 0', async () => {
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    expect(screen.getAllByText(/Paid:/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows notes on desktop when expense has notes', async () => {
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    expect(screen.getByText('Team lunch')).toBeInTheDocument();
  });

  it('shows bulk claim button for admin with negative balance', async () => {
    mockIsAdmin = true;
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    expect(screen.getByText('Claim $100.00')).toBeInTheDocument();
  });

  it('hides bulk claim button when not admin', async () => {
    mockIsAdmin = false;
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    expect(screen.queryByText('Claim $100.00')).not.toBeInTheDocument();
  });

  it('hides bulk claim button when balance is not negative', async () => {
    mockIsAdmin = true;
    const debtors = [{ ...mockDebtors[1]!, unpaidExpenses: [] }];
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={debtors as never} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-2');
    await user.click(toggle);
    expect(screen.queryByText(/Claim \$/)).not.toBeInTheDocument();
  });

  it('opens bulk claim modal when claim button clicked', async () => {
    mockIsAdmin = true;
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    const claimBtn = screen.getByText('Claim $100.00');
    await user.click(claimBtn);
    expect(screen.getByTestId('bulk-claim-modal')).toBeInTheDocument();
  });

  it('submits bulk claim for the selected debtor and refreshes on confirm', async () => {
    // Covers handleBulkClaim body (lines 114-128): early-return guard passes,
    // bulkClaimForColleague fires with the selected debtor, modal closes, and
    // the router is invalidated.
    mockIsAdmin = true;
    const { bulkClaimForColleague } = await import('@/server/payments/mutations');
    vi.mocked(bulkClaimForColleague).mockResolvedValue({} as never);
    mockInvalidate.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    await user.click(screen.getByTestId('debtor-expand-toggle-1'));
    await user.click(screen.getByText('Claim $100.00'));

    await user.click(screen.getByTestId('bulk-claim-confirm'));

    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(bulkClaimForColleague).toHaveBeenCalledWith({
        data: { colleagueId: 1, paymentType: 'PAYME' },
      });
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it('navigates to expenses on view all button click', async () => {
    mockIsAdmin = false;
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const viewAllBtn = screen.getAllByText('View All')[0]!;
    await user.click(viewAllBtn);
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/expenses/' });
  });

  it('toggles expansion closed on second click', async () => {
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    expect(screen.getByText('Unpaid Expenses (1)')).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByText('Unpaid Expenses (1)')).not.toBeInTheDocument();
  });

  it('opens expense in new tab when clicked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);

    const expenseCards = screen.getAllByText('Sushi Bar');
    await user.click(expenseCards[0]!);

    expect(openSpy).toHaveBeenCalledWith('/expense/101', '_blank');
    openSpy.mockRestore();
  });

  it('opens expense in new tab when the desktop card is clicked', async () => {
    // Covers the desktop onClick handler (lines 414-415); the existing click
    // test hits the mobile card, and keyboard tests cover onKeyDown only.
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    await user.click(screen.getByTestId('debtor-expand-toggle-1'));

    await user.click(screen.getByTestId('unpaid-expense-desktop-1-101'));

    expect(openSpy).toHaveBeenCalledWith('/expense/101', '_blank');
    openSpy.mockRestore();
  });

  it('toggles expansion via keyboard enter', async () => {
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    // Using fireEvent.keyDown because userEvent doesn't support keyDown on non-interactive elements well
    fireEvent.keyDown(toggle, { key: 'Enter', code: 'Enter' });
    expect(screen.getByText('Unpaid Expenses (1)')).toBeInTheDocument();
  });

  it('toggles expansion via keyboard space', () => {
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');

    fireEvent.keyDown(toggle, { key: ' ', code: 'Space' });

    expect(screen.getByText('Unpaid Expenses (1)')).toBeInTheDocument();
  });

  it('does not show paid label when totalApprovedPaid is 0', async () => {
    const user = userEvent.setup();
    const debtors = [
      {
        ...mockDebtors[0]!,
        unpaidExpenses: [{ ...mockDebtors[0]!.unpaidExpenses[0]!, totalApprovedPaid: 0 }],
      },
    ];
    render(<DebtorsTab validDebtors={debtors as never} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    expect(screen.queryByText(/Paid:/)).not.toBeInTheDocument();
  });

  it('does not show notes when expense has no notes', async () => {
    const user = userEvent.setup();
    const debtors = [
      {
        ...mockDebtors[0]!,
        unpaidExpenses: [{ ...mockDebtors[0]!.unpaidExpenses[0]!, notes: null }],
      },
    ];
    render(<DebtorsTab validDebtors={debtors as never} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    expect(screen.queryByText('Team lunch')).not.toBeInTheDocument();
  });

  it('formats Date object input correctly', async () => {
    const user = userEvent.setup();
    const debtors = [
      {
        ...mockDebtors[0]!,
        unpaidExpenses: [{ ...mockDebtors[0]!.unpaidExpenses[0]!, date: new Date('2024-06-20') }],
      },
    ];
    render(<DebtorsTab validDebtors={debtors as never} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    // jsdom locale formatting can vary; check for year and month
    expect(screen.getAllByText(/Jun/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/2024/).length).toBeGreaterThanOrEqual(1);
  });

  it('opens expense on mobile card Enter key', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    const card = screen.getByTestId('unpaid-expense-1-101');
    await fireKeyOnCard(card, 'Enter');
    expect(openSpy).toHaveBeenCalledWith('/expense/101', '_blank');
    openSpy.mockRestore();
  });

  it('opens expense on mobile card Space key', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    const card = screen.getByTestId('unpaid-expense-1-101');
    await fireKeyOnCard(card, ' ');
    expect(openSpy).toHaveBeenCalledWith('/expense/101', '_blank');
    openSpy.mockRestore();
  });

  it('does not open expense on unrelated mobile card key', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    const card = screen.getByTestId('unpaid-expense-1-101');
    await fireKeyOnCard(card, 'a');
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('opens expense on desktop card Enter key', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    const card = screen.getByTestId('unpaid-expense-desktop-1-101');
    await fireKeyOnCard(card, 'Enter');
    expect(openSpy).toHaveBeenCalledWith('/expense/101', '_blank');
    openSpy.mockRestore();
  });

  it('opens expense on desktop card Space key', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    const card = screen.getByTestId('unpaid-expense-desktop-1-101');
    await fireKeyOnCard(card, ' ');
    expect(openSpy).toHaveBeenCalledWith('/expense/101', '_blank');
    openSpy.mockRestore();
  });

  it('does not open expense on unrelated desktop card key', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    await user.click(toggle);
    const card = screen.getByTestId('unpaid-expense-desktop-1-101');
    await fireKeyOnCard(card, 'a');
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('ignores unrelated keys on debtor expand toggle', () => {
    render(<DebtorsTab validDebtors={mockDebtors} />);
    const toggle = screen.getByTestId('debtor-expand-toggle-1');
    fireEvent.keyDown(toggle, { key: 'a', code: 'KeyA' });
    expect(screen.queryByText('Unpaid Expenses (1)')).not.toBeInTheDocument();
  });
});

describe('runBulkClaimForDebtor', () => {
  it('skips when no debtor is selected', async () => {
    const run = vi.fn();
    await runBulkClaimForDebtor(null, run);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs with the selected debtor', async () => {
    const run = vi.fn();
    const debtor = { id: 1 };
    await runBulkClaimForDebtor(debtor, run);
    expect(run).toHaveBeenCalledWith(debtor);
  });
});
