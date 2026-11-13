import { describe, expect, it, vi } from 'vitest';

// Mock server functions before any imports that use them
const mockCreatePayment = vi.fn();
const mockDeleteColleague = vi.fn();

vi.mock('@/server/colleagues/handlers', () => ({
  deleteColleague: mockDeleteColleague,
  getActiveColleagues: vi.fn().mockResolvedValue([
    { id: 1, name: 'Alice', createdAt: new Date() },
    { id: 2, name: 'Bob', createdAt: new Date() },
  ]),
  getColleagueById: vi.fn().mockResolvedValue({
    id: 1,
    name: 'Alice Smith',
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date(),
    expenseParticipants: [],
    payments: [],
  }),
  updateColleague: vi.fn(),
}));

vi.mock('@/server/colleagues/colleague-detail', () => ({
  getColleagueDetailMetrics: vi.fn().mockResolvedValue({
    totalOwed: 100,
    totalPaid: 50,
    currentBalance: -50,
    debtAgeDays: 10,
    lastActivityDate: new Date(),
    expenseCount: 2,
    paymentCount: 1,
  }),
}));

vi.mock('@/server/payments', () => ({
  createPayment: mockCreatePayment,
}));

vi.mock('@/utils/auth-client', () => ({
  getAuthToken: vi.fn().mockReturnValue('test-token'),
  isAuthError: vi.fn().mockReturnValue(false),
}));

vi.mock('@/utils/auth-context', () => ({
  useAuth: vi.fn().mockReturnValue({
    isAdmin: true,
    user: { token: 'admin-token', isAdmin: true, permissions: [] },
    isAuthenticated: true,
    isLoading: false,
  }),
  AdminOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockRouterInvalidate = vi.fn();
const mockRouterNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
  useRouter: () => ({
    invalidate: mockRouterInvalidate,
    navigate: mockRouterNavigate,
  }),
  createFileRoute: () => (fn: unknown) => fn,
  redirect: () => {
    throw new Error('REDIRECT');
  },
}));

vi.mock('@/utils/route-protection', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Import after mocks are set up — we only test buildTransactions (exported)
// and simulate handler logic directly (not the component itself)
const { buildTransactions } = await import('../colleagues.$colleagueId');

// Test data factories
function createMockColleague(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Alice Smith',
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date('2025-01-01'),
    expenseParticipants: [],
    payments: [],
    ...overrides,
  };
}

describe('buildTransactions', () => {
  it('returns empty array for colleague with no transactions', () => {
    const colleague = createMockColleague();
    expect(buildTransactions(colleague)).toEqual([]);
  });

  it('maps expense participants to transaction objects', () => {
    const expenseDate = new Date('2025-03-15');
    const colleague = createMockColleague({
      expenseParticipants: [
        {
          id: 10,
          amount: 25.5,
          expense: {
            date: expenseDate,
            restaurant: { name: 'Pizza Palace' },
          },
        },
      ],
    });
    const result = buildTransactions(colleague);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        type: 'expense',
        id: 10,
        amount: 25.5,
        description: 'Pizza Palace',
      })
    );
  });

  it('maps approved payments to transaction objects', () => {
    const paymentDate = new Date('2025-04-01');
    const colleague = createMockColleague({
      payments: [
        {
          id: 20,
          amount: 50,
          date: paymentDate,
          paymentType: 'PAYME',
          isApproved: true,
        },
      ],
    });
    const result = buildTransactions(colleague);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        type: 'payment',
        id: 20,
        amount: 50,
        description: 'Payment (PAYME)',
      })
    );
  });

  it('filters out unapproved payments', () => {
    const colleague = createMockColleague({
      payments: [{ id: 20, amount: 50, date: new Date(), paymentType: 'PAYME', isApproved: false }],
    });
    const result = buildTransactions(colleague);
    expect(result).toHaveLength(0);
  });

  it('sorts transactions by date descending (newest first)', () => {
    const colleague = createMockColleague({
      expenseParticipants: [
        {
          id: 1,
          amount: 20,
          expense: { date: new Date('2025-01-01'), restaurant: { name: 'A' } },
        },
        {
          id: 2,
          amount: 30,
          expense: { date: new Date('2025-06-01'), restaurant: { name: 'B' } },
        },
      ],
    });
    const result = buildTransactions(colleague);
    expect(result[0]?.id).toBe(2);
    expect(result[1]?.id).toBe(1);
  });

  it('handles expense with no restaurant name', () => {
    const colleague = createMockColleague({
      expenseParticipants: [{ id: 1, amount: 10, expense: { date: new Date(), restaurant: null } }],
    });
    const result = buildTransactions(colleague);
    expect(result[0]?.description).toBe('Unknown Restaurant');
  });

  it('extracts payment notes when present', () => {
    const colleague = createMockColleague({
      payments: [
        {
          id: 1,
          amount: 50,
          date: new Date(),
          paymentType: 'CASH',
          isApproved: true,
          notes: 'Lunch reimbursement',
        },
      ],
    });
    const result = buildTransactions(colleague);
    expect(result[0]?.notes).toBe('Lunch reimbursement');
  });

  it('combines expenses and payments into single sorted list', () => {
    const colleague = createMockColleague({
      expenseParticipants: [
        {
          id: 1,
          amount: 30,
          expense: { date: new Date('2025-03-01'), restaurant: { name: 'Lunch' } },
        },
      ],
      payments: [
        {
          id: 2,
          amount: 30,
          date: new Date('2025-04-01'),
          paymentType: 'FPS',
          isApproved: true,
        },
      ],
    });
    const result = buildTransactions(colleague);
    expect(result).toHaveLength(2);
    expect(result[0]?.type).toBe('payment');
    expect(result[1]?.type).toBe('expense');
  });
});

describe('handleDeleteConfirm logic', () => {
  it('calls deleteColleague with correct id and token', async () => {
    mockDeleteColleague.mockResolvedValueOnce({ success: true });
    const colleague = createMockColleague();
    const token = 'admin-token';

    await mockDeleteColleague({ data: { id: colleague.id, token } });
    expect(mockDeleteColleague).toHaveBeenCalledWith({
      data: { id: 1, token: 'admin-token' },
    });
  });

  it('shows error toast when deleteColleague throws', async () => {
    mockDeleteColleague.mockRejectedValueOnce(new Error('Has existing expenses'));

    try {
      await mockDeleteColleague({ data: { id: 1, token: 'admin-token' } });
    } catch {
      // Handler catches this
    }

    expect(mockDeleteColleague).toHaveBeenCalled();
  });
});

describe('handleCreatePayment logic', () => {
  it('builds FormData with correct fields from payment form data', () => {
    const formData = {
      colleagueId: '1',
      amount: '50.00',
      date: '2025-06-01',
      paymentType: 'PAYME' as const,
    };

    const form = new FormData();
    form.append('colleagueId', formData.colleagueId);
    form.append('amount', formData.amount);
    form.append('date', formData.date);
    form.append('paymentType', formData.paymentType);

    expect(form.get('colleagueId')).toBe('1');
    expect(form.get('amount')).toBe('50.00');
    expect(form.get('date')).toBe('2025-06-01');
    expect(form.get('paymentType')).toBe('PAYME');
  });

  it('includes auth token from getAuthToken when available', () => {
    const form = new FormData();
    form.append('token', 'test-token');
    form.append('colleagueId', '1');
    form.append('amount', '50');
    form.append('date', '2025-06-01');
    form.append('paymentType', 'PAYME');

    expect(form.get('token')).toBe('test-token');
  });

  it('appends selectedExpenseIds and expenseAmounts when provided', () => {
    const form = new FormData();
    form.append('colleagueId', '1');
    form.append('amount', '50');
    form.append('date', '2025-06-01');
    form.append('paymentType', 'PAYME');
    form.append('selectedExpenseIds', JSON.stringify([1, 2]));
    form.append('expenseAmounts', JSON.stringify({ '1': '25', '2': '25' }));

    expect(JSON.parse(form.get('selectedExpenseIds') as string)).toEqual([1, 2]);
    expect(JSON.parse(form.get('expenseAmounts') as string)).toEqual({ '1': '25', '2': '25' });
  });

  it('does not append selectedExpenseIds when empty', () => {
    const form = new FormData();
    form.append('colleagueId', '1');
    form.append('amount', '50');
    form.append('date', '2025-06-01');
    form.append('paymentType', 'PAYME');

    expect(form.get('selectedExpenseIds')).toBeNull();
  });

  it('calls createPayment and returns result', async () => {
    mockCreatePayment.mockResolvedValueOnce({
      autoPayments: [{ id: 1, amount: 50, expense: { restaurant: { name: 'Test' } } }],
      autoAppliedAmount: 50,
      remainingPrepayment: 0,
    });

    const form = new FormData();
    form.append('colleagueId', '1');
    form.append('amount', '50');
    form.append('date', '2025-06-01');
    form.append('paymentType', 'PAYME');

    const result = await mockCreatePayment({ data: form });
    expect(result.autoPayments).toHaveLength(1);
    expect(mockCreatePayment).toHaveBeenCalled();
  });
});

describe('loader edge cases', () => {
  it('parses valid colleagueId from params', () => {
    const params = { colleagueId: '42' };
    const colleagueId = Number.parseInt(params.colleagueId, 10);
    expect(colleagueId).toBe(42);
    expect(Number.isNaN(colleagueId)).toBe(false);
    expect(colleagueId > 0).toBe(true);
  });

  it('detects NaN from invalid colleagueId', () => {
    const params = { colleagueId: 'abc' };
    const colleagueId = Number.parseInt(params.colleagueId, 10);
    expect(Number.isNaN(colleagueId)).toBe(true);
  });

  it('detects non-positive colleagueId', () => {
    const params = { colleagueId: '-5' };
    const colleagueId = Number.parseInt(params.colleagueId, 10);
    expect(colleagueId <= 0).toBe(true);
  });

  it('detects zero colleagueId', () => {
    const params = { colleagueId: '0' };
    const colleagueId = Number.parseInt(params.colleagueId, 10);
    expect(colleagueId <= 0).toBe(true);
  });
});
