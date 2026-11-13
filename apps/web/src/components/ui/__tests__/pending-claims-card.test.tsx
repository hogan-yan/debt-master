import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as serverModule from '@/server/expenses';
import { getPaymentProofUrlByPaymentId } from '@/server/payments/queries';
import {
  applyPendingPaymentsUpdate,
  areSamePendingIds,
  PendingClaimsCard,
  shouldUpdateMounted,
} from '../pending-claims-card';

beforeAll(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => (args?: Record<string, unknown>) =>
        args ? `${String(key)}-${JSON.stringify(args)}` : String(key),
    }
  ),
}));

vi.mock('@/components/ui/avatar', () => ({
  EnhancedAvatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}));

vi.mock('@/server/expenses', async () => {
  const actual = await vi.importActual('@/server/expenses');
  return {
    ...actual,
    approvePaymentClaim: vi.fn().mockResolvedValue({ success: true }),
    getPendingPaymentClaims: vi.fn().mockResolvedValue([]),
    undoClaim: vi.fn().mockResolvedValue({ success: true }),
  };
});

vi.mock('@/server/payments/queries', () => ({
  getPaymentProofUrlByPaymentId: vi
    .fn()
    .mockResolvedValue({ url: 'https://example.com/proof.jpg' }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockPendingPayment = {
  id: 1,
  participantId: 101,
  amount: 50.0,
  submittedAt: new Date('2024-01-15'),
  paymentType: 'PAYME',
  paymentProofBucket: 'proofs',
  paymentProofObjectKey: 'proof-1.jpg',
  restaurantId: 1,
  colleague: { id: 1, name: 'Alice Smith' },
  restaurant: { id: 1, name: 'Pizza Place' },
  expense: { id: 10, amount: 100, date: new Date('2024-01-10') },
};

const mockPendingPaymentNoProof = {
  id: 2,
  participantId: 102,
  amount: 30.0,
  submittedAt: new Date('2024-01-14'),
  paymentType: 'CASH',
  paymentProofBucket: null,
  paymentProofObjectKey: null,
  restaurantId: 2,
  colleague: { id: 2, name: 'Bob Jones' },
  restaurant: { id: 2, name: 'Burger Joint' },
  expense: { id: 11, amount: 60, date: new Date('2024-01-12') },
};

const mockPendingPaymentNoParticipant = {
  id: 3,
  participantId: null,
  amount: 25.0,
  submittedAt: new Date('2024-01-13'),
  paymentType: 'FPS',
  paymentProofBucket: null,
  paymentProofObjectKey: null,
  restaurantId: 3,
  colleague: { id: 3, name: 'Charlie Brown' },
  restaurant: { id: 3, name: 'Sushi Bar' },
};

describe('pending claim refresh helpers', () => {
  it('compares pending payments by ordered IDs', () => {
    expect(areSamePendingIds([{ id: 1 }], [{ id: 1 }])).toBe(true);
    expect(areSamePendingIds([{ id: 1 }], [{ id: 2 }])).toBe(false);
    expect(areSamePendingIds([{ id: 1 }], [{ id: 1 }, { id: 2 }])).toBe(false);
  });

  it('only updates state while mounted', () => {
    expect(shouldUpdateMounted(true)).toBe(true);
    expect(shouldUpdateMounted(false)).toBe(false);
  });

  it('applyPendingPaymentsUpdate keeps or replaces lists', () => {
    const prev = [{ id: 1 }];
    expect(applyPendingPaymentsUpdate(prev, [{ id: 1 }])).toBe(prev);
    expect(applyPendingPaymentsUpdate(prev, [{ id: 2 }])).toEqual([{ id: 2 }]);
  });
});

describe('PendingClaimsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([]);
    vi.mocked(serverModule.approvePaymentClaim).mockResolvedValue({
      success: true,
      participant: { id: 1, expenseId: 10, colleagueId: 1 },
      approvedPayments: [],
    } as never);
    vi.mocked(serverModule.undoClaim).mockResolvedValue({
      success: true,
      participant: { id: 1, expenseId: 10, colleagueId: 1 },
      totalReversedAmount: 0,
    } as never);
    vi.mocked(getPaymentProofUrlByPaymentId).mockResolvedValue({
      url: 'https://example.com/proof.jpg',
    });
  });

  it('renders loading state when no initialData', () => {
    render(<PendingClaimsCard />);
    expect(screen.getByText('pendingClaim_loading')).toBeInTheDocument();
  });

  it('renders empty state when no pending payments', async () => {
    render(<PendingClaimsCard initialData={[]} />);
    await waitFor(() => {
      expect(screen.getByText('expense_no_pending_confirmations')).toBeInTheDocument();
    });
  });

  it('renders pending payments count in title', async () => {
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);
    await waitFor(() => {
      expect(screen.getByText('pendingClaim_title-{"count":1}')).toBeInTheDocument();
    });
  });

  it('renders colleague name and avatar after expanding', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);
    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));
    expect(screen.getAllByText('Alice Smith').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('avatar')).toHaveTextContent('Alice Smith');
  });

  it('renders restaurant name and formatted amount after expanding', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);
    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));
    expect(screen.getByText(/Pizza Place/)).toBeInTheDocument();
    expect(screen.getByText(/\$50\.00/)).toBeInTheDocument();
  });

  it('renders show button to expand card', async () => {
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);
    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
  });

  it('expands and shows payment details when show button clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));
    expect(screen.getByText('pendingClaim_hide')).toBeInTheDocument();
    expect(screen.getAllByText('Alice Smith').length).toBeGreaterThanOrEqual(1);
  });

  it('collapses when hide button clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));
    await user.click(screen.getByText('pendingClaim_hide'));
    expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
  });

  it('shows confirm button for each payment', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    expect(screen.getByText('pendingClaim_confirm')).toBeInTheDocument();
  });

  it('calls onApprove when confirm button clicked and handler provided', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue(undefined);
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} onApprove={onApprove} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    const confirmBtn = screen.getByText('pendingClaim_confirm');
    await user.click(confirmBtn);

    expect(onApprove).toHaveBeenCalledWith(101);
  });

  it('shows missing data button when participantId is null', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPaymentNoParticipant as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPaymentNoParticipant as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    expect(screen.getByText('pendingClaim_missingData')).toBeInTheDocument();
  });

  it('disables confirm button when isProcessing includes participantId', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(
      <PendingClaimsCard initialData={[mockPendingPayment as never]} isProcessing={{ 101: true }} />
    );

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    // When isProcessing is true, the button shows a spinner instead of text
    const confirmBtn = document.querySelector('button .animate-spin')?.closest('button');
    expect(confirmBtn).toBeDisabled();
  });

  it('shows proof receipt button when proof exists', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    const proofBtn = screen.getByTitle('pendingClaim_viewProof');
    expect(proofBtn).toBeInTheDocument();
  });

  it('does not show proof button when no proof exists', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPaymentNoProof as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPaymentNoProof as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    expect(screen.queryByTitle('pendingClaim_viewProof')).not.toBeInTheDocument();
  });

  it('shows expense link when expense exists', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    const link = screen.getByTitle('pendingClaim_goToExpense');
    expect(link).toBeInTheDocument();
  });

  it('shows relative date when submittedAt exists', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    expect(screen.getByText(/pendingClaim_marked/)).toBeInTheDocument();
  });

  it('shows "more payments" message when more than 5 payments', async () => {
    const user = userEvent.setup();
    const manyPayments = Array.from({ length: 7 }, (_, i) => ({
      ...mockPendingPayment,
      id: i + 1,
      participantId: 100 + i,
    })) as never[];
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue(manyPayments);
    render(<PendingClaimsCard initialData={manyPayments} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    expect(screen.getByText('pendingClaim_morePayments-{"count":2}')).toBeInTheDocument();
  });

  it('renders multiple pending payments', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
      mockPendingPaymentNoProof as never,
    ]);
    render(
      <PendingClaimsCard
        initialData={[mockPendingPayment as never, mockPendingPaymentNoProof as never]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    expect(screen.getAllByText('Alice Smith').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bob Jones').length).toBeGreaterThanOrEqual(1);
  });

  it('shows unknown colleague fallback when colleague is missing', async () => {
    const user = userEvent.setup();
    const paymentWithoutColleague = {
      ...mockPendingPayment,
      colleague: null,
    };
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      paymentWithoutColleague as never,
    ]);
    render(<PendingClaimsCard initialData={[paymentWithoutColleague as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    expect(screen.getAllByText('pendingClaim_unknownColleague').length).toBeGreaterThanOrEqual(1);
  });

  it('approves payment internally and allows undo', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    const confirmBtn = screen.getByText('pendingClaim_confirm');
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(serverModule.approvePaymentClaim).toHaveBeenCalledWith({
        data: { participantId: 101 },
      });
    });
    expect(toast.success).toHaveBeenCalledWith('pendingClaim_confirmSuccess', {
      description: 'pendingClaim_confirmSuccessDesc',
      action: expect.objectContaining({ label: 'payment_modal_undo' }),
      duration: 10000,
    });

    const actionArg = vi.mocked(toast.success).mock.calls[0]?.[1]?.action;
    expect(actionArg).toBeDefined();
    await act(async () => {
      await (actionArg as { onClick: () => Promise<void> } | undefined)?.onClick?.();
    });

    await waitFor(() => {
      expect(serverModule.undoClaim).toHaveBeenCalledWith({
        data: { participantId: 101, type: 'APPROVED' },
      });
    });
  });

  it('shows error toast when internal approve fails', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.approvePaymentClaim).mockRejectedValue(new Error('fail'));
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    await user.click(screen.getByText('pendingClaim_confirm'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('pendingClaim_confirmFailed');
    });
  });

  it('shows error toast when undo fails', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.undoClaim).mockRejectedValue(new Error('undo fail'));
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    await user.click(screen.getByText('pendingClaim_confirm'));

    await waitFor(() => {
      expect(serverModule.approvePaymentClaim).toHaveBeenCalled();
    });

    const actionArg = vi.mocked(toast.success).mock.calls[0]?.[1]?.action;
    expect(actionArg).toBeDefined();
    await act(async () => {
      await (actionArg as { onClick: () => Promise<void> } | undefined)?.onClick?.();
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('pendingClaim_undoFailed');
    });
  });

  it('opens proof modal when proof icon clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    await user.click(screen.getByTitle('pendingClaim_viewProof'));

    await waitFor(() => {
      expect(getPaymentProofUrlByPaymentId).toHaveBeenCalledWith({
        data: { paymentId: 1 },
      });
    });
  });

  it('shows error toast when proof url is missing', async () => {
    const user = userEvent.setup();
    vi.mocked(getPaymentProofUrlByPaymentId).mockResolvedValue({ url: null });
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    await user.click(screen.getByTitle('pendingClaim_viewProof'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('payment_toast_proofNotFound');
    });
  });

  it('shows error toast when proof loading fails', async () => {
    const user = userEvent.setup();
    vi.mocked(getPaymentProofUrlByPaymentId).mockRejectedValue(new Error('load fail'));
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));

    await user.click(screen.getByTitle('pendingClaim_viewProof'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('payment_toast_proofLoadFailed');
    });
  });

  it('handles fetch pending payments error', async () => {
    vi.mocked(serverModule.getPendingPaymentClaims).mockRejectedValue(new Error('fetch fail'));
    render(<PendingClaimsCard />);

    await waitFor(() => {
      expect(screen.getByText('pendingClaim_loading')).toBeInTheDocument();
    });
  });

  it('retains current pending payments when a poll returns the same IDs', async () => {
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);

    await waitFor(() => {
      expect(serverModule.getPendingPaymentClaims).toHaveBeenCalled();
      expect(screen.getByText('pendingClaim_title-{"count":1}')).toBeInTheDocument();
    });
  });

  it('shows unknown restaurant and omits optional payment details', async () => {
    const user = userEvent.setup();
    const sparsePayment = {
      ...mockPendingPayment,
      restaurant: null,
      submittedAt: null,
      expense: null,
    };
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([sparsePayment as never]);
    render(<PendingClaimsCard initialData={[sparsePayment as never]} />);
    await user.click(screen.getByText('pendingClaim_show'));

    expect(screen.getByText(/pendingClaim_unknownRestaurant/)).toBeInTheDocument();
    expect(screen.queryByTitle('pendingClaim_goToExpense')).not.toBeInTheDocument();
    expect(screen.queryByText(/pendingClaim_marked/)).not.toBeInTheDocument();
  });

  it('ignores fetch results after unmount', async () => {
    let resolvePayments: (value: (typeof mockPendingPayment)[]) => void = () => {};
    vi.mocked(serverModule.getPendingPaymentClaims).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePayments = resolve as (value: (typeof mockPendingPayment)[]) => void;
        })
    );

    const { unmount } = render(<PendingClaimsCard />);
    unmount();
    await act(async () => {
      resolvePayments([mockPendingPayment]);
    });
  });

  it('ignores fetch errors after unmount', async () => {
    let rejectPayments: (reason?: unknown) => void = () => {};
    vi.mocked(serverModule.getPendingPaymentClaims).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectPayments = reject;
        })
    );

    const { unmount } = render(<PendingClaimsCard />);
    unmount();
    await act(async () => {
      rejectPayments(new Error('network'));
    });
  });

  it('closes the payment proof modal', async () => {
    const user = userEvent.setup();
    vi.mocked(serverModule.getPendingPaymentClaims).mockResolvedValue([
      mockPendingPayment as never,
    ]);
    vi.mocked(getPaymentProofUrlByPaymentId).mockResolvedValue({
      url: 'https://example.com/proof.jpg',
    });

    render(<PendingClaimsCard initialData={[mockPendingPayment as never]} />);
    await waitFor(() => {
      expect(screen.getByText('pendingClaim_show')).toBeInTheDocument();
    });
    await user.click(screen.getByText('pendingClaim_show'));
    await user.click(screen.getByTitle('pendingClaim_viewProof'));

    await waitFor(() => {
      expect(screen.getByText('Payment Proof')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByText('Payment Proof')).not.toBeInTheDocument();
    });
  });
});
