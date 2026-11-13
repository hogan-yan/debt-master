import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  colleagueIdOrZero,
  compareParticipantPaidStatus,
  ExpenseMobileCard,
  expenseDateToString,
} from '../expense-mobile-card';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => {
    let href = to;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        href = href.replace(`$${k}/`, `${v}/`);
      }
    }
    return <a href={href}>{children}</a>;
  },
}));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_, key) => () => String(key) }),
}));

function createExpense(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    amount: 100,
    date: '2024-06-15T00:00:00Z',
    receiptBucket: null,
    receiptObjectKey: null,
    restaurant: { id: 1, name: 'Pizza Place', address: '123 Main St' },
    participants: [
      { id: 1, amount: 50, isPaid: true, colleague: { id: 10, name: 'Alice' } },
      { id: 2, amount: 50, isPaid: false, colleague: { id: 11, name: 'Bob' } },
    ],
    items: [],
    ...overrides,
  };
}

describe('ExpenseMobileCard', () => {
  it('renders restaurant name and amount', () => {
    render(<ExpenseMobileCard expense={createExpense()} />);
    expect(screen.getByText('Pizza Place')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });

  it('shows address when present', () => {
    render(<ExpenseMobileCard expense={createExpense()} />);
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });

  it('shows Unknown Restaurant when no restaurant', () => {
    render(<ExpenseMobileCard expense={createExpense({ restaurant: null })} />);
    expect(screen.getByText('expense_detail_unknownRestaurant')).toBeInTheDocument();
  });

  it('shows 50% progress when half paid', () => {
    render(<ExpenseMobileCard expense={createExpense()} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows 100% when fully paid', () => {
    render(
      <ExpenseMobileCard
        expense={createExpense({
          participants: [
            { id: 1, amount: 100, isPaid: true, colleague: { id: 10, name: 'Alice' } },
          ],
        })}
      />
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows 0% when nothing paid', () => {
    render(
      <ExpenseMobileCard
        expense={createExpense({
          participants: [
            { id: 1, amount: 100, isPaid: false, colleague: { id: 10, name: 'Alice' } },
          ],
        })}
      />
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows warning progress for a partially paid expense above 50%', () => {
    render(
      <ExpenseMobileCard
        expense={createExpense({
          participants: [
            { id: 1, amount: 75, isPaid: true, colleague: { id: 10, name: 'Alice' } },
            { id: 2, amount: 25, isPaid: false, colleague: { id: 11, name: 'Bob' } },
          ],
        })}
      />
    );
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows zero progress for a zero-value expense', () => {
    render(<ExpenseMobileCard expense={createExpense({ amount: 0, participants: undefined })} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows View button', () => {
    render(<ExpenseMobileCard expense={createExpense()} />);
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  it('shows Receipt button when receipt exists', () => {
    render(
      <ExpenseMobileCard
        expense={createExpense({ receiptBucket: 'bucket', receiptObjectKey: 'key' })}
        onReceiptClick={() => {}}
      />
    );
    expect(screen.getByText('Receipt')).toBeInTheDocument();
  });

  it('hides Receipt button when no receipt', () => {
    render(<ExpenseMobileCard expense={createExpense()} onReceiptClick={() => {}} />);
    expect(screen.queryByText('Receipt')).not.toBeInTheDocument();
  });

  it('hides Receipt when a receipt callback or either receipt location is missing', () => {
    const { rerender } = render(
      <ExpenseMobileCard
        expense={createExpense({ receiptBucket: 'bucket', receiptObjectKey: 'key' })}
      />
    );
    expect(screen.queryByText('Receipt')).not.toBeInTheDocument();

    rerender(
      <ExpenseMobileCard
        expense={createExpense({ receiptBucket: 'bucket', receiptObjectKey: null })}
        onReceiptClick={vi.fn()}
      />
    );
    expect(screen.queryByText('Receipt')).not.toBeInTheDocument();
  });

  it('calls onReceiptClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <ExpenseMobileCard
        expense={createExpense({ receiptBucket: 'bucket', receiptObjectKey: 'key' })}
        onReceiptClick={onClick}
      />
    );
    await user.click(screen.getByText('Receipt'));
    expect(onClick).toHaveBeenCalledWith(1);
  });

  it('expands participants section', async () => {
    const user = userEvent.setup();
    const { container } = render(<ExpenseMobileCard expense={createExpense()} />);
    const collapsed = container.querySelector('[class*="max-h-0"]');
    expect(collapsed).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    const expandBtn = buttons[buttons.length - 1]!;
    await user.click(expandBtn);
    const expanded = container.querySelector('[class*="max-h-200"]');
    expect(expanded).toBeInTheDocument();
  });

  it('links to expense detail', () => {
    render(<ExpenseMobileCard expense={createExpense()} />);
    const links = screen.getAllByRole('link');
    const hasLink = links.some((l) => l.getAttribute('href')?.includes('1'));
    expect(hasLink).toBe(true);
  });

  it('renders without participants', () => {
    render(<ExpenseMobileCard expense={createExpense({ participants: [] })} />);
    expect(screen.getByText('Pizza Place')).toBeInTheDocument();
  });

  it('shows all participants after expanding a fully paid expense', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseMobileCard
        expense={createExpense({
          participants: [
            { id: 1, amount: 50, isPaid: true, colleague: { id: 10, name: 'Alice' } },
            { id: 2, amount: 50, isPaid: true, colleague: { id: 11, name: 'Bob' } },
          ],
        })}
      />
    );

    await user.click(screen.getAllByRole('button').at(-1)!);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('can show paid participants then return to unpaid-only participants', async () => {
    const user = userEvent.setup();
    render(<ExpenseMobileCard expense={createExpense()} />);

    const expandButton = screen.getAllByRole('button').find((button) => button.textContent === '');
    if (!expandButton) throw new Error('Expand participants button not found');
    await user.click(expandButton);
    await user.click(screen.getByRole('button', { name: /show all participants/i }));
    expect(
      screen.getByRole('button', { name: /show only unpaid participants/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show only unpaid participants/i }));
    expect(screen.getByRole('button', { name: /show all participants/i })).toBeInTheDocument();
  });

  it('shows pending payment status for an unpaid participant with a claim', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseMobileCard
        expense={createExpense()}
        pendingClaimsByColleague={{
          11: {
            participantId: 2,
            submittedAt: new Date(),
            hasPaymentProof: true,
            paymentId: 1,
          },
        }}
      />
    );

    await user.click(screen.getAllByRole('button').at(-1)!);
    expect(screen.getByText(/expense_participant_pending/i)).toBeInTheDocument();
  });

  it('uses the unknown-colleague fallback for participants without a colleague', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseMobileCard
        expense={createExpense({
          participants: [{ id: 1, amount: 100, isPaid: false, colleague: null }],
        })}
      />
    );

    const expandButton = screen.getAllByRole('button').find((button) => button.textContent === '');
    if (!expandButton) throw new Error('Expand participants button not found');
    await user.click(expandButton);

    expect(screen.getAllByText('common_unknown').length).toBeGreaterThan(0);
  });
});

describe('expense mobile card helpers', () => {
  it('compareParticipantPaidStatus covers equal, paid-first, and unpaid-first', () => {
    expect(compareParticipantPaidStatus(true, true)).toBe(0);
    expect(compareParticipantPaidStatus(false, false)).toBe(0);
    expect(compareParticipantPaidStatus(true, false)).toBe(1);
    expect(compareParticipantPaidStatus(false, true)).toBe(-1);
  });

  it('expenseDateToString handles string and Date', () => {
    expect(expenseDateToString('2024-01-01')).toBe('2024-01-01');
    expect(expenseDateToString(new Date('2024-06-15T00:00:00.000Z'))).toBe(
      '2024-06-15T00:00:00.000Z'
    );
  });

  it('colleagueIdOrZero falls back to 0', () => {
    expect(colleagueIdOrZero({ id: 9 })).toBe(9);
    expect(colleagueIdOrZero(null)).toBe(0);
    expect(colleagueIdOrZero(undefined)).toBe(0);
  });
});
