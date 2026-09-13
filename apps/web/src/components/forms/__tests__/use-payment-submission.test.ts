import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PaymentFormState } from '../use-payment-form';
import type { UsePaymentSubmissionParams } from '../use-payment-submission';
import { usePaymentSubmission } from '../use-payment-submission';

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key) => () => String(key),
    }
  ),
}));

vi.mock('@/utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
}));

vi.mock('@/hooks', () => ({
  useFormSubmission: () => ({
    isSubmitting: false,
    handleSubmit: vi.fn(async (fn, _msg) => {
      await fn();
    }),
  }),
}));

import { toast } from 'sonner';

const baseFormState = {
  currentColleagueId: '1',
  editableAmount: '100',
  date: '2026-01-15',
  paymentType: 'PAYME' as const,
  paymentMode: 'PREPAYMENT' as const,
  paymentProofFile: null as File | null,
  existingPaymentProofUrl: null as string | null,
  showExistingProof: false,
  keepExistingProof: false,
  hadExistingProof: false,
} satisfies PaymentFormState;

function makeParams(overrides: Record<string, unknown> = {}): UsePaymentSubmissionParams {
  const formStateOverrides: Record<string, unknown> = {};
  const otherOverrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (key in baseFormState) {
      formStateOverrides[key] = value;
    } else {
      otherOverrides[key] = value;
    }
  }
  return {
    formState: { ...baseFormState, ...formStateOverrides } as PaymentFormState,
    selectedExpenseIds: [],
    expenseAmounts: {},
    totalAmount: 0,
    paymentId: undefined,
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onSuccess: vi.fn(),
    ...otherOverrides,
  } as UsePaymentSubmissionParams;
}

describe('usePaymentSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns isSubmitting as false initially', () => {
    const { result } = renderHook(() => usePaymentSubmission(makeParams()));
    expect(result.current.isSubmitting).toBe(false);
  });

  it('shows error when colleagueId is missing', async () => {
    const params = makeParams({ currentColleagueId: '' });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(toast.error).toHaveBeenCalledWith('payment_form_missingFields');
    expect(params.onSubmit).not.toHaveBeenCalled();
  });

  it('shows error when amount is missing', async () => {
    const params = makeParams({ editableAmount: '' });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(toast.error).toHaveBeenCalledWith('payment_form_missingFields');
  });

  it('shows error when date is missing', async () => {
    const params = makeParams({ date: '' });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(toast.error).toHaveBeenCalledWith('payment_form_missingFields');
  });

  it('shows error when paymentType is missing', async () => {
    const params = makeParams({ paymentType: '' });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(toast.error).toHaveBeenCalledWith('payment_form_missingFields');
  });

  it('shows error for EXPENSE_PAYMENT with no selected expenses', async () => {
    const params = makeParams({
      paymentMode: 'EXPENSE_PAYMENT',
      selectedExpenseIds: [],
    });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(toast.error).toHaveBeenCalledWith('payment_form_selectExpense');
  });

  it('shows error when amount is NaN', async () => {
    const params = makeParams({ editableAmount: 'abc' });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(toast.error).toHaveBeenCalledWith('payment_form_validAmount');
  });

  it('shows error when amount is zero', async () => {
    const params = makeParams({ editableAmount: '0' });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(toast.error).toHaveBeenCalledWith('payment_form_validAmount');
  });

  it('shows error when amount is negative', async () => {
    const params = makeParams({ editableAmount: '-50' });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(toast.error).toHaveBeenCalledWith('payment_form_validAmount');
  });

  it('shows error when EXPENSE_PAYMENT amount less than total applied', async () => {
    const params = makeParams({
      paymentMode: 'EXPENSE_PAYMENT',
      selectedExpenseIds: [1],
      totalAmount: 200,
    });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(toast.error).toHaveBeenCalledWith('payment_form_amountLessThanApplied');
  });

  it('shows error when colleagueId is NaN', async () => {
    const params = makeParams({ currentColleagueId: 'abc' });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(toast.error).toHaveBeenCalledWith('payment_form_validColleague');
  });

  it('calls onSubmit with correct data for PREPAYMENT mode', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const params = makeParams({ onSubmit });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        colleagueId: '1',
        amount: '100',
        date: '2026-01-15',
        paymentType: 'PAYME',
      })
    );
  });

  it('calls onSubmit with keepExistingProof in edit mode', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const params = makeParams({
      onSubmit,
      paymentId: 5,
      keepExistingProof: true,
      hadExistingProof: true,
    });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentProofFile: undefined,
        keepExistingProof: true,
        removeExistingProof: false,
      })
    );
  });

  it('calls onSubmit with removeExistingProof when existing proof removed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const params = makeParams({
      onSubmit,
      paymentId: 5,
      keepExistingProof: false,
      hadExistingProof: true,
    });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        keepExistingProof: false,
        removeExistingProof: true,
      })
    );
  });

  it('calls onSubmit with proof file in edit mode', async () => {
    const file = new File(['proof'], 'proof.pdf', { type: 'application/pdf' });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const params = makeParams({
      onSubmit,
      paymentId: 5,
      paymentProofFile: file,
    });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentProofFile: file,
        keepExistingProof: false,
        removeExistingProof: false,
      })
    );
  });

  it('calls onSubmit with expense selection in edit mode', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const params = makeParams({
      onSubmit,
      paymentId: 5,
      paymentMode: 'EXPENSE_PAYMENT',
      selectedExpenseIds: [1, 2],
      expenseAmounts: { 1: '50', 2: '50' },
      totalAmount: 100,
    });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedExpenseIds: [1, 2],
        expenseAmounts: { 1: '50', 2: '50' },
      })
    );
  });

  it('submits valid EXPENSE_PAYMENT without errors', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const params = makeParams({
      onSubmit,
      paymentMode: 'EXPENSE_PAYMENT',
      selectedExpenseIds: [1],
      totalAmount: 100,
    });
    const { result } = renderHook(() => usePaymentSubmission(params));

    await act(async () => {
      await result.current.validateAndSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
