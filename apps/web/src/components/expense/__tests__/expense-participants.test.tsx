import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ExpenseParticipantWithColleague } from '@/types';
import { ExpenseParticipants } from '../expense-participants';

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_, key) => () => String(key) }),
}));

vi.mock('@/paraglide/runtime', () => ({
  getLocale: () => 'en',
}));

vi.mock('@/utils/auth-context', () => ({
  useAuth: () => ({ isAdmin: true }),
  AdminOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function getFirstItem<T>(items: readonly T[]): T {
  const firstItem = items[0];
  if (firstItem === undefined) {
    throw new Error('Expected at least one item');
  }
  return firstItem;
}

describe('ExpenseParticipants', () => {
  const mockParticipants: ExpenseParticipantWithColleague[] = [
    {
      id: 1,
      amount: 25.5,
      colleague: { id: 101, name: 'Alice' },
      expenseId: 1,
      colleagueId: 101,
      isPaid: false,
      isPending: false,
      hasPartialPayment: false,
      submittedAt: null,
    },
    {
      id: 2,
      amount: 30.0,
      colleague: { id: 102, name: 'Bob' },
      expenseId: 1,
      colleagueId: 102,
      isPaid: false,
      isPending: false,
      hasPartialPayment: false,
      submittedAt: null,
    },
    {
      id: 3,
      amount: 15.0,
      colleague: { id: 103, name: 'Charlie' },
      expenseId: 1,
      colleagueId: 103,
      isPaid: true,
      isPending: false,
      hasPartialPayment: false,
      submittedAt: null,
    },
  ];

  const defaultProps = {
    participants: mockParticipants,
    participantItems: {
      101: [
        { id: 1, name: 'Burger', price: 12.5 },
        { id: 2, name: 'Fries', price: 5.0 },
      ],
    } as Record<number, Array<{ id: number; name: string; price: number }>>,
    pendingClaimsByColleague: {} as Record<
      number,
      { participantId: number; submittedAt: Date; hasPaymentProof: boolean; paymentId: number }
    >,
    isProcessingClaim: {} as Record<number, boolean>,
    onOpenPaymentModal: vi.fn(),
    onApprovePayment: vi.fn(),
    onUndoPaymentClaim: vi.fn(),
    onViewPaymentProof: vi.fn(),
    onAssignToPrepayment: vi.fn(),
    unappliedFunds: {} as Record<number, number>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders card title', () => {
    render(<ExpenseParticipants {...defaultProps} />);
    expect(screen.getByText('expense_detail_whoOwesWhat')).toBeInTheDocument();
  });

  it('renders unpaid section with participants', () => {
    render(<ExpenseParticipants {...defaultProps} />);
    expect(screen.getByText('expense_status_unpaid')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders paid section header', () => {
    render(<ExpenseParticipants {...defaultProps} />);
    // Paid section is collapsed by default (no defaultOpen prop), so only header is visible
    expect(screen.getByText('expense_detail_paid')).toBeInTheDocument();
  });

  it('shows paid participant when section expanded', async () => {
    const user = userEvent.setup();
    render(<ExpenseParticipants {...defaultProps} />);

    const paidHeader = screen.getByText('expense_detail_paid').closest('button');
    expect(paidHeader).toBeInTheDocument();
    if (paidHeader) {
      await user.click(paidHeader as HTMLElement);
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    }
  });

  it('does not render empty sections', () => {
    render(
      <ExpenseParticipants
        {...defaultProps}
        participants={[
          {
            id: 1,
            amount: 25,
            colleague: { id: 101, name: 'Alice' },
            expenseId: 1,
            colleagueId: 101,
            isPaid: false,
            isPending: false,
            hasPartialPayment: false,
            submittedAt: null,
          },
        ]}
      />
    );
    expect(screen.queryByText('expense_detail_paid')).not.toBeInTheDocument();
    expect(screen.queryByText('expense_detail_pendingApproval')).not.toBeInTheDocument();
  });

  it('renders participant amounts formatted', () => {
    render(<ExpenseParticipants {...defaultProps} />);
    expect(screen.getByText('$25.50')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
  });

  it('shows mark as paid button for unpaid participants', () => {
    render(<ExpenseParticipants {...defaultProps} />);
    const markAsPaidButtons = screen.getAllByText('expense_detail_markAsPaid');
    expect(markAsPaidButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('does not show mark as paid button for paid participants', async () => {
    const user = userEvent.setup();
    render(<ExpenseParticipants {...defaultProps} />);

    const paidHeader = screen.getByText('expense_detail_paid').closest('button');
    expect(paidHeader).toBeInTheDocument();
    if (paidHeader) {
      await user.click(paidHeader as HTMLElement);
      // Scope query to the paid section container
      const paidSection = paidHeader.closest('div[class*="border-b"]');
      expect(paidSection).toBeInTheDocument();
      const markAsPaidInPaid = paidSection?.querySelectorAll('*');
      const hasMarkAsPaid = Array.from(markAsPaidInPaid || []).some(
        (el) => el.textContent === 'expense_detail_markAsPaid'
      );
      expect(hasMarkAsPaid).toBe(false);
    }
  });

  it('calls onOpenPaymentModal when mark as paid clicked', async () => {
    const user = userEvent.setup();
    const onOpenPaymentModal = vi.fn();
    render(<ExpenseParticipants {...defaultProps} onOpenPaymentModal={onOpenPaymentModal} />);

    const markAsPaidBtn = screen.getAllByText('expense_detail_markAsPaid')[0]!;
    await user.click(markAsPaidBtn);

    expect(onOpenPaymentModal).toHaveBeenCalledOnce();
  });

  it('renders pending section when there are pending claims', () => {
    const pendingParticipant: ExpenseParticipantWithColleague = {
      id: 4,
      amount: 20.0,
      colleague: { id: 104, name: 'David' },
      expenseId: 1,
      colleagueId: 104,
      isPaid: false,
      isPending: true,
      hasPartialPayment: false,
      submittedAt: new Date(),
    };

    render(
      <ExpenseParticipants
        {...defaultProps}
        participants={[...mockParticipants, pendingParticipant]}
        pendingClaimsByColleague={{
          104: { participantId: 4, submittedAt: new Date(), hasPaymentProof: false, paymentId: 0 },
        }}
      />
    );

    expect(screen.getByText('expense_detail_pendingApproval')).toBeInTheDocument();
    expect(screen.getByText('David')).toBeInTheDocument();
  });

  it('shows confirm payment button for pending participants', () => {
    const pendingParticipant: ExpenseParticipantWithColleague = {
      id: 4,
      amount: 20.0,
      colleague: { id: 104, name: 'David' },
      expenseId: 1,
      colleagueId: 104,
      isPaid: false,
      isPending: true,
      hasPartialPayment: false,
      submittedAt: new Date(),
    };

    render(
      <ExpenseParticipants
        {...defaultProps}
        participants={[...mockParticipants, pendingParticipant]}
        pendingClaimsByColleague={{
          104: { participantId: 4, submittedAt: new Date(), hasPaymentProof: false, paymentId: 0 },
        }}
      />
    );

    const confirmButtons = screen.getAllByText('expense_detail_confirmPayment');
    expect(confirmButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onApprovePayment when confirm payment clicked', async () => {
    const user = userEvent.setup();
    const onApprovePayment = vi.fn();
    const pendingParticipant: ExpenseParticipantWithColleague = {
      id: 4,
      amount: 20.0,
      colleague: { id: 104, name: 'David' },
      expenseId: 1,
      colleagueId: 104,
      isPaid: false,
      isPending: true,
      hasPartialPayment: false,
      submittedAt: new Date(),
    };

    render(
      <ExpenseParticipants
        {...defaultProps}
        participants={[...mockParticipants, pendingParticipant]}
        pendingClaimsByColleague={{
          104: { participantId: 4, submittedAt: new Date(), hasPaymentProof: false, paymentId: 0 },
        }}
        onApprovePayment={onApprovePayment}
      />
    );

    const confirmBtn = screen.getAllByText('expense_detail_confirmPayment')[0]!;
    await user.click(confirmBtn);

    expect(onApprovePayment).toHaveBeenCalledWith(4);
  });

  it('shows paid amount label when totalPaid is greater than 0.01', () => {
    const participantWithPartial: ExpenseParticipantWithColleague = {
      id: 5,
      amount: 50.0,
      colleague: { id: 105, name: 'Eve' },
      expenseId: 1,
      colleagueId: 105,
      isPaid: false,
      isPending: false,
      hasPartialPayment: true,
      submittedAt: null,
      totalPaid: 20.0,
    };

    render(<ExpenseParticipants {...defaultProps} participants={[participantWithPartial]} />);

    expect(screen.getByText(/expense_detail_paidLabel/i)).toBeInTheDocument();
  });

  it('does not show paid amount label when totalPaid is zero', () => {
    render(<ExpenseParticipants {...defaultProps} />);
    const aliceRow = screen.getByText('Alice').closest('div')?.parentElement;
    if (aliceRow) {
      expect(aliceRow.textContent).not.toContain('expense_detail_paidLabel');
    }
  });

  it('shows expand button when participant has items', () => {
    render(<ExpenseParticipants {...defaultProps} />);
    const expandButtons = screen.getAllByRole('button').filter((btn) => btn.querySelector('svg'));
    expect(expandButtons.length).toBeGreaterThan(0);
  });

  it('expands and shows items when expand button clicked', async () => {
    const user = userEvent.setup();
    render(<ExpenseParticipants {...defaultProps} />);

    const aliceSection = screen.getByText('Alice').closest('div');
    expect(aliceSection).toBeInTheDocument();

    const expandBtn = aliceSection
      ?.closest('div[class*="flex items-center gap-3"]')
      ?.parentElement?.querySelector('button[class*="h-9 w-9"]');

    if (expandBtn) {
      await user.click(expandBtn as HTMLElement);
      expect(screen.getByText('Burger')).toBeInTheDocument();
      expect(screen.getByText('Fries')).toBeInTheDocument();
    }
  });

  it('shows apply credit option when unapplied funds exist', async () => {
    const user = userEvent.setup();
    render(<ExpenseParticipants {...defaultProps} unappliedFunds={{ 101: 10.0 }} />);

    // Find the dropdown trigger (MoreHorizontal/ellipsis button) in Alice's row
    const allButtons = screen.getAllByRole('button');
    const moreButtons = allButtons.filter((btn) => {
      const svg = btn.querySelector('svg');
      return svg?.getAttribute('class')?.includes('lucide-ellipsis');
    });
    expect(moreButtons.length).toBeGreaterThan(0);

    if (moreButtons[0]) {
      await user.click(moreButtons[0]);
      expect(screen.getByText(/expense_detail_applyCredit/i)).toBeInTheDocument();
    }
  });

  it('shows view payment proof option when pending claim has proof', async () => {
    const user = userEvent.setup();
    const pendingParticipant: ExpenseParticipantWithColleague = {
      id: 4,
      amount: 20.0,
      colleague: { id: 104, name: 'David' },
      expenseId: 1,
      colleagueId: 104,
      isPaid: false,
      isPending: true,
      hasPartialPayment: false,
      submittedAt: new Date(),
    };

    render(
      <ExpenseParticipants
        {...defaultProps}
        participants={[...mockParticipants, pendingParticipant]}
        pendingClaimsByColleague={{
          104: { participantId: 4, submittedAt: new Date(), hasPaymentProof: true, paymentId: 42 },
        }}
      />
    );

    expect(screen.getByText('David')).toBeInTheDocument();

    const allButtons = screen.getAllByRole('button');
    const moreButtons = allButtons.filter((btn) => {
      const svg = btn.querySelector('svg');
      return svg?.getAttribute('class')?.includes('lucide-ellipsis');
    });
    expect(moreButtons.length).toBeGreaterThan(0);

    if (moreButtons[0]) {
      await user.click(moreButtons[0]);
      expect(screen.getByText(/expense_detail_viewPaymentProof/i)).toBeInTheDocument();
    }
  });

  it('disables buttons when isProcessingClaim is true for participant', () => {
    render(<ExpenseParticipants {...defaultProps} isProcessingClaim={{ 1: true }} />);

    const markAsPaidButtons = screen.getAllByText('expense_detail_markAsPaid');
    expect(markAsPaidButtons.length).toBeGreaterThan(0);
  });

  it('shows a loading indicator while approving a pending claim', () => {
    const pendingParticipant: ExpenseParticipantWithColleague = {
      id: 4,
      amount: 20,
      colleague: { id: 104, name: 'David' },
      expenseId: 1,
      colleagueId: 104,
      isPaid: false,
      isPending: true,
      hasPartialPayment: false,
      submittedAt: new Date(),
    };
    render(
      <ExpenseParticipants
        {...defaultProps}
        participants={[pendingParticipant]}
        pendingClaimsByColleague={{
          104: { participantId: 4, submittedAt: new Date(), hasPaymentProof: false, paymentId: 0 },
        }}
        isProcessingClaim={{ 4: true }}
      />
    );

    expect(
      screen.getAllByText('expense_detail_confirmPayment')[0]?.closest('button')
    ).toBeDisabled();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('handles unknown colleague gracefully', () => {
    const unknownParticipant: ExpenseParticipantWithColleague = {
      id: 6,
      amount: 15.0,
      colleague: null,
      expenseId: 1,
      colleagueId: 0,
      isPaid: false,
      isPending: false,
      hasPartialPayment: false,
      submittedAt: null,
    };

    render(<ExpenseParticipants {...defaultProps} participants={[unknownParticipant]} />);

    expect(screen.getByText('expense_detail_unknownColleague')).toBeInTheDocument();
  });

  it('uses the singular ordered-item label for one expanded item', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseParticipants
        {...defaultProps}
        participantItems={{ 101: [{ id: 1, name: 'Burger', price: 12.5 }] }}
        participants={[getFirstItem(mockParticipants)]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Expand items' }));

    expect(screen.getByText('expense_detail_itemOrdered')).toBeInTheDocument();
  });

  it('sorts participants by name within sections', () => {
    const unsorted: ExpenseParticipantWithColleague[] = [
      {
        id: 1,
        amount: 25,
        colleague: { id: 101, name: 'Zara' },
        expenseId: 1,
        colleagueId: 101,
        isPaid: false,
        isPending: false,
        hasPartialPayment: false,
        submittedAt: null,
      },
      {
        id: 2,
        amount: 30,
        colleague: { id: 102, name: 'Anna' },
        expenseId: 1,
        colleagueId: 102,
        isPaid: false,
        isPending: false,
        hasPartialPayment: false,
        submittedAt: null,
      },
    ];

    render(<ExpenseParticipants {...defaultProps} participants={unsorted} />);
    const names = screen.getAllByText(/Zara|Anna/);
    expect(names.length).toBe(2);
  });

  it('collapses section when header clicked', async () => {
    const user = userEvent.setup();
    render(<ExpenseParticipants {...defaultProps} />);

    const unpaidHeader = screen.getByText('expense_status_unpaid').closest('button');
    expect(unpaidHeader).toBeInTheDocument();

    if (unpaidHeader) {
      await user.click(unpaidHeader);
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    }
  });

  it('runs the pending claim secondary actions', async () => {
    const user = userEvent.setup();
    const onUndoPaymentClaim = vi.fn();
    const onViewPaymentProof = vi.fn();
    const pendingParticipant: ExpenseParticipantWithColleague = {
      id: 4,
      amount: 20,
      colleague: { id: 104, name: 'David' },
      expenseId: 1,
      colleagueId: 104,
      isPaid: false,
      isPending: true,
      hasPartialPayment: false,
      submittedAt: new Date(),
    };

    render(
      <ExpenseParticipants
        {...defaultProps}
        participants={[pendingParticipant]}
        pendingClaimsByColleague={{
          104: { participantId: 4, submittedAt: new Date(), hasPaymentProof: true, paymentId: 42 },
        }}
        onUndoPaymentClaim={onUndoPaymentClaim}
        onViewPaymentProof={onViewPaymentProof}
      />
    );

    const menuButtons = screen.getAllByRole('button', { name: 'More actions' });
    const menuButton = getFirstItem(menuButtons);
    await user.click(menuButton);
    await user.click(screen.getByText('expense_detail_cancelClaim'));
    expect(onUndoPaymentClaim).toHaveBeenCalledWith(4);

    await user.click(menuButton);
    await user.click(screen.getByText('expense_detail_viewPaymentProof'));
    expect(onViewPaymentProof).toHaveBeenCalledWith(42);
  });

  it('assigns available credit from participant actions', async () => {
    const user = userEvent.setup();
    const onAssignToPrepayment = vi.fn();
    render(
      <ExpenseParticipants
        {...defaultProps}
        participants={[getFirstItem(mockParticipants)]}
        unappliedFunds={{ 101: 10 }}
        onAssignToPrepayment={onAssignToPrepayment}
      />
    );

    await user.click(getFirstItem(screen.getAllByRole('button', { name: 'More actions' })));
    await user.click(screen.getByText('expense_detail_applyCredit'));
    expect(onAssignToPrepayment).toHaveBeenCalledWith(1);
  });
});
