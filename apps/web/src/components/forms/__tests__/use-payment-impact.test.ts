import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ParticipantWithPayments, usePaymentImpact } from '../use-payment-impact';

vi.mock('@/paraglide/messages', () => ({
  m: {
    common_unknown: () => 'Unknown',
  },
}));

function makeParticipant(
  overrides: Partial<ParticipantWithPayments> = {}
): ParticipantWithPayments {
  return {
    id: 1,
    amount: 100,
    colleague: { id: 1, name: 'Alice' },
    paymentApplications: [],
    ...overrides,
  };
}

describe('usePaymentImpact', () => {
  it('returns no payments when not editing', () => {
    const { result } = renderHook(() =>
      usePaymentImpact({
        isEditing: false,
        participants: [],
      })
    );

    expect(result.current.hasExistingPayments).toBe(false);
    expect(result.current.paymentImpacts).toBeNull();
    expect(result.current.showPaymentWarning).toBe(false);
  });

  it('returns no payments when no participants', () => {
    const { result } = renderHook(() =>
      usePaymentImpact({
        isEditing: true,
        participants: undefined,
      })
    );

    expect(result.current.hasExistingPayments).toBe(false);
    expect(result.current.paymentImpacts).toBeNull();
  });

  it('detects existing approved payments when editing', () => {
    const participants = [
      makeParticipant({
        paymentApplications: [
          {
            amount: 50,
            payment: {
              id: 1,
              amount: 50,
              date: '2026-01-01',
              paymentType: 'PAYME',
              isApproved: true,
            },
          },
        ],
      }),
    ];

    const { result } = renderHook(() =>
      usePaymentImpact({
        isEditing: true,
        participants,
      })
    );

    expect(result.current.hasExistingPayments).toBe(true);
  });

  it('shows warning when existing payments detected', () => {
    const participants = [
      makeParticipant({
        paymentApplications: [
          {
            amount: 50,
            payment: {
              id: 1,
              amount: 50,
              date: '2026-01-01',
              paymentType: 'PAYME',
              isApproved: true,
            },
          },
        ],
      }),
    ];

    const { result } = renderHook(() =>
      usePaymentImpact({
        isEditing: true,
        participants,
      })
    );

    expect(result.current.showPaymentWarning).toBe(true);
  });

  it('computes payment impacts for participants with approved payments', () => {
    const participants = [
      makeParticipant({
        amount: 100,
        colleague: { id: 1, name: 'Alice' },
        paymentApplications: [
          {
            amount: 60,
            payment: {
              id: 1,
              amount: 60,
              date: '2026-01-01',
              paymentType: 'PAYME',
              isApproved: true,
            },
          },
        ],
      }),
      makeParticipant({
        id: 2,
        amount: 80,
        colleague: { id: 2, name: 'Bob' },
        paymentApplications: [
          {
            amount: 20,
            payment: {
              id: 2,
              amount: 20,
              date: '2026-01-02',
              paymentType: 'FPS',
              isApproved: true,
            },
          },
        ],
      }),
    ];

    const { result } = renderHook(() =>
      usePaymentImpact({
        isEditing: true,
        participants,
      })
    );

    expect(result.current.paymentImpacts).toHaveLength(2);
    const alice = result.current.paymentImpacts?.[0];
    expect(alice?.name).toBe('Alice');
    expect(alice?.paidAmount).toBe(60);
    expect(alice?.currentOwed).toBe(40);

    const bob = result.current.paymentImpacts?.[1];
    expect(bob?.name).toBe('Bob');
    expect(bob?.paidAmount).toBe(20);
    expect(bob?.currentOwed).toBe(60);
  });

  it('treats a participant without payment applications as unpaid', () => {
    const participants = [
      makeParticipant({
        paymentApplications: [
          {
            amount: 50,
            payment: {
              id: 1,
              amount: 50,
              date: '2026-01-01',
              paymentType: 'PAYME',
              isApproved: true,
            },
          },
        ],
      }),
      makeParticipant({ id: 2, paymentApplications: undefined }),
    ];

    const { result } = renderHook(() => usePaymentImpact({ isEditing: true, participants }));

    expect(result.current.paymentImpacts).toHaveLength(1);
  });

  it('filters out participants with zero paid amount', () => {
    const participants = [
      makeParticipant({
        amount: 100,
        paymentApplications: [
          {
            amount: 50,
            payment: {
              id: 1,
              amount: 50,
              date: '2026-01-01',
              paymentType: 'PAYME',
              isApproved: false,
            },
          },
        ],
      }),
    ];

    const { result } = renderHook(() =>
      usePaymentImpact({
        isEditing: true,
        participants,
      })
    );

    // No approved payments means paidAmount = 0, filtered out
    expect(result.current.hasExistingPayments).toBe(false);
    expect(result.current.paymentImpacts).toBeNull();
  });

  it('uses "Unknown" fallback for missing colleague name', () => {
    const participants = [
      makeParticipant({
        amount: 100,
        colleague: undefined,
        paymentApplications: [
          {
            amount: 30,
            payment: {
              id: 1,
              amount: 30,
              date: '2026-01-01',
              paymentType: 'PAYME',
              isApproved: true,
            },
          },
        ],
      }),
    ];

    const { result } = renderHook(() =>
      usePaymentImpact({
        isEditing: true,
        participants,
      })
    );

    expect(result.current.paymentImpacts?.[0]?.name).toBe('Unknown');
  });

  it('clamps currentOwed to zero when paidAmount exceeds currentAmount', () => {
    const participants = [
      makeParticipant({
        amount: 50,
        paymentApplications: [
          {
            amount: 80,
            payment: {
              id: 1,
              amount: 80,
              date: '2026-01-01',
              paymentType: 'PAYME',
              isApproved: true,
            },
          },
        ],
      }),
    ];

    const { result } = renderHook(() =>
      usePaymentImpact({
        isEditing: true,
        participants,
      })
    );

    expect(result.current.paymentImpacts?.[0]?.currentOwed).toBe(0);
  });

  it('setConfirmEdit updates state', () => {
    const { result } = renderHook(() =>
      usePaymentImpact({
        isEditing: false,
        participants: [],
      })
    );

    expect(result.current.confirmEdit).toBe(false);

    act(() => {
      result.current.setConfirmEdit(true);
    });

    expect(result.current.confirmEdit).toBe(true);
  });
});
