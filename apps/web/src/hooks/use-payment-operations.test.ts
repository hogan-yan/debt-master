import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, ErrorCode } from '@/utils/errors';
import { usePaymentOperations } from './use-payment-operations';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockInvalidate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate: mockInvalidate,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    payment_modal_claimCancelled: () => 'Claim cancelled',
    payment_modal_cancelFailed: () => 'Cancel failed',
    payment_operation_expenseModified: () => 'Expense modified',
    payment_modal_undo: () => 'Undo',
    pendingClaim_confirmSuccess: () => 'Claim approved',
    pendingClaim_confirmSuccessDesc: () => 'Description',
    pendingClaim_undoSuccess: () => 'Undo success',
    pendingClaim_undoFailed: () => 'Undo failed',
    payment_operation_approveFailed: () => 'Approve failed',
    payment_toast_proofNotFound: () => 'Proof not found',
    payment_toast_proofLoadFailed: () => 'Proof load failed',
    payment_modal_claimSubmitted: () => 'Claim submitted',
    payment_modal_claimPendingApproval: () => 'Pending approval',
    payment_modal_submitFailed: () => 'Submit failed',
  },
}));

const mockApprovePaymentClaim = vi.fn();
const mockGetPaymentProofUrlByPaymentId = vi.fn();
const mockGetPendingPaymentClaims = vi.fn();
const mockUndoClaim = vi.fn();
const mockClaimPayment = vi.fn();

vi.mock('@/server/expenses', async () => {
  const actual = await vi.importActual<typeof import('@/server/expenses')>('@/server/expenses');
  return {
    ...actual,
    approvePaymentClaim: (ctx: { data: unknown }) => mockApprovePaymentClaim(ctx),
    claimPayment: (ctx: { data: FormData }) => mockClaimPayment(ctx),
    getPendingPaymentClaims: () => mockGetPendingPaymentClaims(),
    undoClaim: (ctx: { data: unknown }) => mockUndoClaim(ctx),
  };
});

vi.mock('@/server/payments', async () => {
  const actual = await vi.importActual<typeof import('@/server/payments')>('@/server/payments');
  return {
    ...actual,
    getPaymentProofUrlByPaymentId: (ctx: { data: unknown }) =>
      mockGetPaymentProofUrlByPaymentId(ctx),
  };
});

const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

function isAsyncToastAction(value: unknown): value is { onClick: () => Promise<void> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'onClick') === 'function'
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePaymentOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial State ──────────────────────────────────────────────────────────

  it('should have correct initial state', () => {
    const { result } = renderHook(() => usePaymentOperations());

    expect(result.current.isProcessingClaim).toEqual({});
    expect(result.current.isToastActionActive).toBe(false);
    expect(result.current.pendingClaimsByColleague).toEqual({});
  });

  // ── fetchPendingClaims ─────────────────────────────────────────────────────

  it('should fetch pending claims for all restaurants', async () => {
    mockGetPendingPaymentClaims.mockResolvedValue([
      {
        id: 1,
        colleague: { id: 1, name: 'Alice' },
        participantId: 10,
        submittedAt: new Date('2024-01-01'),
        paymentProofBucket: 'bucket',
        paymentProofObjectKey: 'key',
        restaurantId: 1,
      },
    ]);

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.fetchPendingClaims();
    });

    expect(result.current.pendingClaimsByColleague[1]).toEqual({
      participantId: 10,
      submittedAt: expect.any(Date),
      hasPaymentProof: true,
      paymentId: 1,
    });
  });

  it('should filter pending claims by restaurantId', async () => {
    mockGetPendingPaymentClaims.mockResolvedValue([
      {
        id: 1,
        colleague: { id: 1, name: 'Alice' },
        participantId: 10,
        submittedAt: new Date('2024-01-01'),
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        restaurantId: 1,
      },
      {
        id: 2,
        colleague: { id: 2, name: 'Bob' },
        participantId: 20,
        submittedAt: new Date('2024-01-02'),
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        restaurantId: 2,
      },
    ]);

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.fetchPendingClaims(1);
    });

    expect(result.current.pendingClaimsByColleague[1]).toBeDefined();
    expect(result.current.pendingClaimsByColleague[2]).toBeUndefined();
  });

  it('should use the current date when a pending claim has no submission date', async () => {
    mockGetPendingPaymentClaims.mockResolvedValue([
      {
        id: 1,
        colleague: { id: 1, name: 'Alice' },
        participantId: 10,
        submittedAt: null,
        restaurantId: 1,
      },
    ]);

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.fetchPendingClaims();
    });

    expect(result.current.pendingClaimsByColleague[1]?.submittedAt).toBeInstanceOf(Date);
  });

  it('should skip claims without colleague', async () => {
    mockGetPendingPaymentClaims.mockResolvedValue([
      {
        id: 1,
        colleague: null,
        participantId: 10,
        submittedAt: new Date('2024-01-01'),
        restaurantId: 1,
      },
    ]);

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.fetchPendingClaims();
    });

    expect(Object.keys(result.current.pendingClaimsByColleague)).toHaveLength(0);
  });

  it('should skip claims without participantId', async () => {
    mockGetPendingPaymentClaims.mockResolvedValue([
      {
        id: 1,
        colleague: { id: 1, name: 'Alice' },
        participantId: null,
        submittedAt: new Date('2024-01-01'),
        restaurantId: 1,
      },
    ]);

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.fetchPendingClaims();
    });

    expect(Object.keys(result.current.pendingClaimsByColleague)).toHaveLength(0);
  });

  it('should handle fetch pending claims error silently', async () => {
    mockGetPendingPaymentClaims.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.fetchPendingClaims();
    });

    expect(result.current.pendingClaimsByColleague).toEqual({});
  });

  // ── refreshExpenseData ─────────────────────────────────────────────────────

  it('should invalidate router and refetch claims', async () => {
    mockGetPendingPaymentClaims.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.refreshExpenseData(1);
    });

    expect(mockInvalidate).toHaveBeenCalled();
    expect(mockGetPendingPaymentClaims).toHaveBeenCalled();
  });

  it('should invalidate router without restaurantId', async () => {
    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.refreshExpenseData();
    });

    expect(mockInvalidate).toHaveBeenCalled();
    expect(mockGetPendingPaymentClaims).not.toHaveBeenCalled();
  });

  it('should handle refresh errors silently', async () => {
    mockInvalidate.mockRejectedValue(new Error('Invalidate failed'));

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.refreshExpenseData();
    });

    // Should not throw
  });

  // ── handleUndoPaymentClaim ─────────────────────────────────────────────────

  it('should undo payment claim successfully', async () => {
    const { toast } = await import('sonner');
    mockUndoClaim.mockResolvedValue(undefined);
    mockInvalidate.mockResolvedValue(undefined);
    mockGetPendingPaymentClaims.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleUndoPaymentClaim(1);
    });

    expect(mockUndoClaim).toHaveBeenCalledWith({
      data: { participantId: 1, type: 'PENDING' },
    });
    expect(toast.success).toHaveBeenCalledWith('Claim cancelled');
    expect(result.current.isProcessingClaim[1]).toBe(false);
  });

  it('should handle undo with participant not found error', async () => {
    const { toast } = await import('sonner');
    vi.useFakeTimers();

    mockUndoClaim.mockRejectedValue(new Error('Participant not found'));

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleUndoPaymentClaim(1);
    });

    expect(toast.error).toHaveBeenCalledWith('Expense modified', { duration: 3000 });

    vi.advanceTimersByTime(1500);
    expect(mockReload).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should handle undo with a structured stale-data error', async () => {
    const { toast } = await import('sonner');
    vi.useFakeTimers();
    mockUndoClaim.mockRejectedValue(
      new AppError(ErrorCode.BUSINESS_NO_PENDING_CLAIM, 'No pending claim')
    );

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleUndoPaymentClaim(1);
    });

    expect(toast.error).toHaveBeenCalledWith('Expense modified', { duration: 3000 });

    vi.advanceTimersByTime(1500);
    expect(mockReload).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should handle undo with refresh error message', async () => {
    const { toast } = await import('sonner');
    vi.useFakeTimers();

    mockUndoClaim.mockRejectedValue(new Error('Please refresh the page'));

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleUndoPaymentClaim(1);
    });

    expect(toast.error).toHaveBeenCalledWith('Expense modified', { duration: 3000 });

    vi.advanceTimersByTime(1500);
    expect(mockReload).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should handle undo with generic error', async () => {
    const { toast } = await import('sonner');
    mockUndoClaim.mockRejectedValue(new Error('Something went wrong'));

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleUndoPaymentClaim(1);
    });

    expect(toast.error).toHaveBeenCalledWith('Something went wrong');
  });

  it('should handle undo with non-Error', async () => {
    const { toast } = await import('sonner');
    mockUndoClaim.mockRejectedValue('string error');

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleUndoPaymentClaim(1);
    });

    expect(toast.error).toHaveBeenCalledWith('Cancel failed');
  });

  it('should set processing state during undo', async () => {
    mockUndoClaim.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    const { result } = renderHook(() => usePaymentOperations());

    act(() => {
      result.current.handleUndoPaymentClaim(1);
    });

    expect(result.current.isProcessingClaim[1]).toBe(true);
  });

  // ── handleApprovePaymentClaim ──────────────────────────────────────────────

  it('should approve payment claim successfully', async () => {
    const { toast } = await import('sonner');
    mockApprovePaymentClaim.mockResolvedValue(undefined);
    mockInvalidate.mockResolvedValue(undefined);
    mockGetPendingPaymentClaims.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleApprovePaymentClaim(1);
    });

    expect(mockApprovePaymentClaim).toHaveBeenCalledWith({
      data: { participantId: 1 },
    });
    expect(toast.success).toHaveBeenCalledWith('Claim approved', {
      description: 'Description',
      action: expect.objectContaining({
        label: 'Undo',
        onClick: expect.any(Function),
      }),
      duration: 10000,
    });
  });

  it('should execute undo action from approve toast', async () => {
    mockApprovePaymentClaim.mockResolvedValue(undefined);
    mockInvalidate.mockResolvedValue(undefined);
    mockGetPendingPaymentClaims.mockResolvedValue([]);
    mockUndoClaim.mockResolvedValue(undefined);

    const { toast } = await import('sonner');

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleApprovePaymentClaim(1);
    });

    const successCall = vi
      .mocked(toast.success)
      .mock.calls.find((call) => call[0] === 'Claim approved');
    expect(successCall).toBeDefined();

    const action = successCall?.[1]?.action;
    expect(action).toBeDefined();

    await act(async () => {
      await (action as unknown as { onClick: () => Promise<void> }).onClick();
    });

    expect(mockUndoClaim).toHaveBeenCalledWith({
      data: { participantId: 1, type: 'APPROVED' },
    });
    expect(result.current.isToastActionActive).toBe(false);
  });

  it('should handle undo action failure in toast', async () => {
    mockApprovePaymentClaim.mockResolvedValue(undefined);
    mockInvalidate.mockResolvedValue(undefined);
    mockGetPendingPaymentClaims.mockResolvedValue([]);
    mockUndoClaim.mockRejectedValue(new Error('Undo failed'));

    const { toast } = await import('sonner');

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleApprovePaymentClaim(1);
    });

    const successCall = vi
      .mocked(toast.success)
      .mock.calls.find((call) => call[0] === 'Claim approved');
    const action = successCall?.[1]?.action;

    await act(async () => {
      await (action as unknown as { onClick: () => Promise<void> }).onClick();
    });

    expect(toast.error).toHaveBeenCalledWith('Undo failed');
    expect(result.current.isToastActionActive).toBe(false);
  });

  it('should handle approve with participant not found error', async () => {
    const { toast } = await import('sonner');
    vi.useFakeTimers();

    mockApprovePaymentClaim.mockRejectedValue(new Error('Participant not found'));

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleApprovePaymentClaim(1);
    });

    expect(toast.error).toHaveBeenCalledWith('Expense modified', { duration: 3000 });

    vi.advanceTimersByTime(1500);
    expect(mockReload).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should handle approve with generic error', async () => {
    const { toast } = await import('sonner');
    mockApprovePaymentClaim.mockRejectedValue(new Error('Approval failed'));

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleApprovePaymentClaim(1);
    });

    expect(toast.error).toHaveBeenCalledWith('Approval failed');
  });

  it('should handle approve with non-Error', async () => {
    const { toast } = await import('sonner');
    mockApprovePaymentClaim.mockRejectedValue('string error');

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.handleApprovePaymentClaim(1);
    });

    expect(toast.error).toHaveBeenCalledWith('Approve failed');
  });

  // ── handleViewPendingPaymentProof ──────────────────────────────────────────

  it('should return proof URL when found', async () => {
    mockGetPaymentProofUrlByPaymentId.mockResolvedValue({ url: 'https://example.com/proof.jpg' });

    const { result } = renderHook(() => usePaymentOperations());

    let url: string | null = null;
    await act(async () => {
      url = await result.current.handleViewPendingPaymentProof(1);
    });

    expect(url).toBe('https://example.com/proof.jpg');
  });

  it('should return null and show error when proof not found', async () => {
    const { toast } = await import('sonner');
    mockGetPaymentProofUrlByPaymentId.mockResolvedValue({ url: null });

    const { result } = renderHook(() => usePaymentOperations());

    let url: string | null = 'initial';
    await act(async () => {
      url = await result.current.handleViewPendingPaymentProof(1);
    });

    expect(url).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Proof not found');
  });

  it('should return null and show error on fetch failure', async () => {
    const { toast } = await import('sonner');
    mockGetPaymentProofUrlByPaymentId.mockRejectedValue(new Error('Fetch failed'));

    const { result } = renderHook(() => usePaymentOperations());

    let url: string | null = 'initial';
    await act(async () => {
      url = await result.current.handleViewPendingPaymentProof(1);
    });

    expect(url).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Proof load failed');
  });

  // ── handlePaymentClaimSubmission ───────────────────────────────────────────

  it('should submit payment claim successfully', async () => {
    const { toast } = await import('sonner');
    mockClaimPayment.mockResolvedValue(undefined);
    mockInvalidate.mockResolvedValue(undefined);
    mockGetPendingPaymentClaims.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentOperations());

    const formData = new FormData();
    formData.append('participantId', '1');

    let returnValue: { success: boolean } | undefined;
    await act(async () => {
      returnValue = await result.current.handlePaymentClaimSubmission(1, formData);
    });

    expect(returnValue).toEqual({ success: true });
    expect(toast.success).toHaveBeenCalledWith('Claim submitted', {
      description: 'Pending approval',
      action: expect.objectContaining({
        label: 'Undo',
        onClick: expect.any(Function),
      }),
      duration: 10000,
    });

    const submitCall = vi
      .mocked(toast.success)
      .mock.calls.find(([message]) => message === 'Claim submitted');
    const submitAction = submitCall?.[1]?.action;
    expect(isAsyncToastAction(submitAction)).toBe(true);

    if (!isAsyncToastAction(submitAction)) {
      throw new Error('Expected payment claim toast action');
    }

    mockUndoClaim.mockResolvedValue(undefined);
    await act(async () => {
      await submitAction.onClick();
    });

    expect(mockUndoClaim).toHaveBeenCalledWith({
      data: { participantId: 1, type: 'PENDING' },
    });
  });

  it('should throw on submission error', async () => {
    const { toast } = await import('sonner');
    mockClaimPayment.mockRejectedValue(new Error('Submission failed'));

    const { result } = renderHook(() => usePaymentOperations());

    const formData = new FormData();

    await expect(
      act(async () => {
        await result.current.handlePaymentClaimSubmission(1, formData);
      })
    ).rejects.toThrow('Submission failed');

    expect(toast.error).toHaveBeenCalledWith('Submission failed');
  });

  it('should show an error when the submission toast undo fails', async () => {
    const { toast } = await import('sonner');
    mockClaimPayment.mockResolvedValue(undefined);
    mockInvalidate.mockResolvedValue(undefined);
    mockGetPendingPaymentClaims.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentOperations());
    await act(async () => {
      await result.current.handlePaymentClaimSubmission(1, new FormData());
    });

    const submitCall = vi
      .mocked(toast.success)
      .mock.calls.find(([message]) => message === 'Claim submitted');
    const submitAction = submitCall?.[1]?.action;
    if (!isAsyncToastAction(submitAction)) {
      throw new Error('Expected payment claim toast action');
    }

    mockUndoClaim.mockRejectedValue(new Error('Undo failed'));
    await act(async () => {
      await submitAction.onClick();
    });

    expect(toast.error).toHaveBeenCalledWith('Cancel failed');
  });

  it('should handle non-Error submission failure', async () => {
    const { toast } = await import('sonner');
    mockClaimPayment.mockRejectedValue('string error');

    const { result } = renderHook(() => usePaymentOperations());

    const formData = new FormData();

    await expect(
      act(async () => {
        await result.current.handlePaymentClaimSubmission(1, formData);
      })
    ).rejects.toThrow('string error');

    expect(toast.error).toHaveBeenCalledWith('Submit failed');
  });

  // ── clearPendingClaims ─────────────────────────────────────────────────────

  it('should clear pending claims', async () => {
    mockGetPendingPaymentClaims.mockResolvedValue([
      {
        id: 1,
        colleague: { id: 1, name: 'Alice' },
        participantId: 10,
        submittedAt: new Date(),
        restaurantId: 1,
      },
    ]);

    const { result } = renderHook(() => usePaymentOperations());

    await act(async () => {
      await result.current.fetchPendingClaims();
    });

    expect(Object.keys(result.current.pendingClaimsByColleague)).toHaveLength(1);

    act(() => {
      result.current.clearPendingClaims();
    });

    expect(result.current.pendingClaimsByColleague).toEqual({});
  });

  // ── Token handling ─────────────────────────────────────────────────────────
  // Auth token is no longer passed in payloads (cookie-based auth), so there
  // is nothing to assert here. Payload shapes are covered by the undo/approve
  // tests above.
});
