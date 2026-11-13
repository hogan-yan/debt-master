/**
 * Tests for BulkClaimModal component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BULK_CLAIM, COMMON } from '@/test/test-ids';
import { BulkClaimModal } from '../bulk-claim-modal';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function createExpense(
  overrides?: Partial<{
    id: number;
    date: string | Date;
    restaurantName: string;
    totalAmount: number;
    colleagueAmount: number;
    remainingOwed: number;
  }>
): {
  id: number;
  date: string | Date;
  restaurantName: string;
  totalAmount: number;
  colleagueAmount: number;
  remainingOwed: number;
} {
  return {
    id: 1,
    date: '2024-06-15',
    restaurantName: 'Test Restaurant',
    totalAmount: 100,
    colleagueAmount: 50,
    remainingOwed: 50,
    ...overrides,
  };
}

function createDebtor(
  overrides?: Partial<{
    id: number;
    name: string;
    currentBalance: number;
    unpaidExpenses: ReturnType<typeof createExpense>[];
  }>
): {
  id: number;
  name: string;
  currentBalance: number;
  unpaidExpenses: ReturnType<typeof createExpense>[];
} {
  return {
    id: 1,
    name: 'John Doe',
    currentBalance: -150,
    unpaidExpenses: [
      createExpense({ id: 1, restaurantName: 'Place A', remainingOwed: 50 }),
      createExpense({ id: 2, restaurantName: 'Place B', remainingOwed: 50 }),
      createExpense({ id: 3, restaurantName: 'Place C', remainingOwed: 50 }),
    ],
    ...overrides,
  };
}

describe('BulkClaimModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with debtor information', () => {
    const debtor = createDebtor();
    render(
      <BulkClaimModal
        open={true}
        onOpenChange={() => {}}
        debtor={debtor}
        onConfirm={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.getByTestId(BULK_CLAIM.DIALOG)).toBeInTheDocument();
    expect(screen.getByTestId(BULK_CLAIM.DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByTestId(BULK_CLAIM.PAYMENT_TYPE_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(BULK_CLAIM.EXPENSES_LIST)).toBeInTheDocument();

    const description = screen.getByTestId(BULK_CLAIM.DESCRIPTION);
    expect(description).toHaveTextContent('John Doe');
    expect(description).toHaveTextContent('$150.00');
  });

  it('renders empty when debtor is null', () => {
    const { container } = render(
      <BulkClaimModal
        open={true}
        onOpenChange={() => {}}
        debtor={null}
        onConfirm={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('calls onConfirm with selected payment type when confirm clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const debtor = createDebtor();

    render(
      <BulkClaimModal
        open={true}
        onOpenChange={() => {}}
        debtor={debtor}
        onConfirm={onConfirm}
        isSubmitting={false}
      />
    );

    const paymentSelect = screen.getByTestId(BULK_CLAIM.PAYMENT_TYPE_INPUT);
    await user.selectOptions(paymentSelect, 'FPS');

    const confirmButton = screen.getByTestId(BULK_CLAIM.CONFIRM_BTN);
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith('FPS');
  });

  it('calls onOpenChange with false when cancel clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const debtor = createDebtor();

    render(
      <BulkClaimModal
        open={true}
        onOpenChange={onOpenChange}
        debtor={debtor}
        onConfirm={vi.fn()}
        isSubmitting={false}
      />
    );

    const cancelButton = screen.getByTestId(COMMON.CANCEL_BTN);
    await user.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows loading state when isSubmitting is true', () => {
    const debtor = createDebtor();
    render(
      <BulkClaimModal
        open={true}
        onOpenChange={() => {}}
        debtor={debtor}
        onConfirm={vi.fn()}
        isSubmitting={true}
      />
    );

    const confirmButton = screen.getByTestId(BULK_CLAIM.CONFIRM_BTN);
    expect(confirmButton).toBeDisabled();
  });

  it('renders "more expenses" message when expenses exceed 5', () => {
    const debtor = createDebtor({
      unpaidExpenses: [
        createExpense({ id: 1, restaurantName: 'Place A', remainingOwed: 10 }),
        createExpense({ id: 2, restaurantName: 'Place B', remainingOwed: 10 }),
        createExpense({ id: 3, restaurantName: 'Place C', remainingOwed: 10 }),
        createExpense({ id: 4, restaurantName: 'Place D', remainingOwed: 10 }),
        createExpense({ id: 5, restaurantName: 'Place E', remainingOwed: 10 }),
        createExpense({ id: 6, restaurantName: 'Place F', remainingOwed: 10 }),
        createExpense({ id: 7, restaurantName: 'Place G', remainingOwed: 10 }),
      ],
    });

    render(
      <BulkClaimModal
        open={true}
        onOpenChange={() => {}}
        debtor={debtor}
        onConfirm={vi.fn()}
        isSubmitting={false}
      />
    );

    // Should show exactly 5 expense rows
    expect(screen.getByTestId('bulk-claim-expense-1')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-claim-expense-2')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-claim-expense-3')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-claim-expense-4')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-claim-expense-5')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-claim-expense-6')).not.toBeInTheDocument();

    // Should show "more" message with count 2
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it('uses singular copy when exactly one expense is hidden', () => {
    const debtor = createDebtor({
      unpaidExpenses: Array.from({ length: 6 }, (_, index) =>
        createExpense({ id: index + 1, restaurantName: `Place ${index + 1}` })
      ),
    });

    render(
      <BulkClaimModal
        open={true}
        onOpenChange={() => {}}
        debtor={debtor}
        onConfirm={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.getByText(/1 more expense$/i)).toBeInTheDocument();
  });

  it('renders singular description when only 1 expense', () => {
    const debtor = createDebtor({
      currentBalance: -50,
      unpaidExpenses: [createExpense({ id: 1, restaurantName: 'Solo Place', remainingOwed: 50 })],
    });

    render(
      <BulkClaimModal
        open={true}
        onOpenChange={() => {}}
        debtor={debtor}
        onConfirm={vi.fn()}
        isSubmitting={false}
      />
    );

    const description = screen.getByTestId(BULK_CLAIM.DESCRIPTION);
    expect(description).toHaveTextContent('1');
    expect(description).toHaveTextContent('John Doe');
    expect(description).toHaveTextContent('$50.00');
  });
});
