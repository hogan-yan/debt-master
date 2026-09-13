import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFormData } from '@/test/helpers/form-data';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';
import { AppError, ErrorCode } from '@/utils/errors';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

// Mock dependencies
vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    expense: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    payment: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
  requireAuthFromCookie: vi.fn(),
  requireAdminFromCookie: vi.fn(),
}));

vi.mock('@/server/infrastructure/storage', () => ({
  uploadFileToStorage: vi.fn(),
  deleteFromStorage: vi.fn(),
}));

vi.mock('@/server/utils/file-validation', () => ({
  validateUploadedFileObject: vi.fn(),
}));

vi.mock('./serialization', () => ({
  serializeExpense: vi.fn((expense) => ({ ...expense, amount: Number(expense.amount) })),
}));

vi.mock('./workflows/create-expense-workflow', () => ({
  createExpenseWorkflow: vi.fn(),
}));

vi.mock('./workflows/delete-expense-workflow', () => ({
  deleteExpenseWorkflow: vi.fn(),
}));

vi.mock('./workflows/create-claim-workflow', () => ({
  createClaimWorkflow: vi.fn(),
}));

vi.mock('./workflows/approve-claim-workflow', () => ({
  approveClaimWorkflow: vi.fn(),
}));

vi.mock('./workflows/undo-claim-workflow', () => ({
  undoClaimWorkflow: vi.fn(),
}));

vi.mock('./workflows/update-expense-workflow', () => ({
  updateExpenseWorkflow: vi.fn(),
}));

vi.mock('./workflows/auto-apply-prepayments-for-expense-workflow', () => ({
  autoApplyPrepaymentsForExpenseWorkflow: vi.fn(),
}));

import {
  getAuthFromCookie,
  requireAdminFromCookie,
  requireAuthFromCookie,
} from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { deleteFromStorage, uploadFileToStorage } from '@/server/infrastructure/storage';
// Import handlers AFTER mocks
import {
  approvePaymentClaim,
  claimPayment,
  createExpense,
  deleteExpense,
  duplicateExpense,
  getExpenseRelatedPayments,
  undoClaim,
  updateExpense,
} from './mutations';
import { approveClaimWorkflow } from './workflows/approve-claim-workflow';
import { autoApplyPrepaymentsForExpenseWorkflow } from './workflows/auto-apply-prepayments-for-expense-workflow';
import { createClaimWorkflow } from './workflows/create-claim-workflow';
import { createExpenseWorkflow } from './workflows/create-expense-workflow';
import { deleteExpenseWorkflow } from './workflows/delete-expense-workflow';
import { undoClaimWorkflow } from './workflows/undo-claim-workflow';
import { updateExpenseWorkflow } from './workflows/update-expense-workflow';

// biome-ignore lint/suspicious/noExplicitAny: test helper to call mocked server functions with loose typing
type ServerFn = (ctx: { data: any }) => Promise<any>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(
    async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)
  );
});

describe('createExpense', () => {
  const baseFormData = {
    token: 'valid-token',
    date: '2024-06-15',
    restaurantId: '1',
    amount: '100',
    splitType: 'EQUAL',
    participantIds: JSON.stringify([1, 2]),
    items: null,
    notes: null,
    receiptFile: null,
  };

  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('creates expense successfully without receipt', async () => {
    vi.mocked(createExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('100'), participants: [] },
    } as never);
    vi.mocked(autoApplyPrepaymentsForExpenseWorkflow).mockResolvedValue(null as never);

    const form = createFormData(baseFormData);
    const result = await (createExpense as ServerFn)({ data: form });

    expect(requireAdminFromCookie).toHaveBeenCalled();
    expect(createExpenseWorkflow).toHaveBeenCalledWith(prisma, {
      date: '2024-06-15',
      restaurantId: 1,
      amount: 100,
      splitType: 'EQUAL',
      notes: null,
      participantIds: [1, 2],
      items: undefined,
      receiptBucket: null,
      receiptObjectKey: null,
    });
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('creates expense with receipt upload', async () => {
    vi.mocked(uploadFileToStorage).mockResolvedValue({
      bucket: 'receipts',
      objectKey: 'receipt-1.jpg',
    } as never);
    vi.mocked(createExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('100'), participants: [] },
    } as never);
    vi.mocked(autoApplyPrepaymentsForExpenseWorkflow).mockResolvedValue(null as never);

    const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
    const form = createFormData({ ...baseFormData, receiptFile: file });
    const result = await (createExpense as ServerFn)({ data: form });

    expect(uploadFileToStorage).toHaveBeenCalledWith(file);
    expect(createExpenseWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ receiptBucket: 'receipts', receiptObjectKey: 'receipt-1.jpg' })
    );
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    const form = createFormData(baseFormData);
    await expect((createExpense as ServerFn)({ data: form })).rejects.toThrow(
      'Failed to create expense'
    );
  });

  it('rejects invalid file upload', async () => {
    vi.mocked(uploadFileToStorage).mockRejectedValue(new Error('Invalid file type'));

    const file = new File(['test'], 'bad.exe', { type: 'application/x-msdownload' });
    const form = createFormData({ ...baseFormData, receiptFile: file });
    await expect((createExpense as ServerFn)({ data: form })).rejects.toThrow(
      'Failed to create expense'
    );
  });

  it('returns auto-apply results when auto-applications exist', async () => {
    vi.mocked(createExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('100'), participants: [] },
    } as never);
    vi.mocked(autoApplyPrepaymentsForExpenseWorkflow).mockResolvedValue({
      autoApplications: [{ id: 1 }],
      totalAutoApplied: 50,
    } as never);

    const form = createFormData(baseFormData);
    const result = await (createExpense as ServerFn)({ data: form });

    expect(result).toEqual(
      expect.objectContaining({ autoApplications: [{ id: 1 }], totalAutoApplied: 50 })
    );
  });
});

describe('getExpenseRelatedPayments', () => {
  it('returns payment count when authenticated', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.count).mockResolvedValue(3);

    const result = await (getExpenseRelatedPayments as ServerFn)({ data: { id: 1 } });

    expect(result).toEqual({ hasRelatedPayments: true, paymentCount: 3 });
    expect(prisma.payment.count).toHaveBeenCalledWith({ where: { expenseId: 1 } });
  });

  it('throws when unauthenticated', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue(null);

    await expect((getExpenseRelatedPayments as ServerFn)({ data: { id: 1 } })).rejects.toThrow(
      'Authentication required'
    );
  });
});

describe('deleteExpense', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('deletes expense successfully and cleans up receipt', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      receiptBucket: 'receipts',
      receiptObjectKey: 'receipt-1.jpg',
    } as never);
    vi.mocked(deleteExpenseWorkflow).mockResolvedValue({
      deletedPayments: [
        { id: 1, paymentProofBucket: 'proofs', paymentProofObjectKey: 'proof-1.jpg', expenseId: 1 },
      ],
    } as never);

    const result = await (deleteExpense as ServerFn)({
      data: { id: 1, deleteRelatedPayments: false, token: 'token' },
    });

    expect(deleteExpenseWorkflow).toHaveBeenCalledWith(prisma, {
      id: 1,
      deleteRelatedPayments: false,
    });
    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'proof-1.jpg');
    expect(deleteFromStorage).toHaveBeenCalledWith('receipts', 'receipt-1.jpg');
    expect(result).toEqual({ success: true });
  });

  it('deletes expense without receipt cleanup when no receipt exists', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      receiptBucket: null,
      receiptObjectKey: null,
    } as never);
    vi.mocked(deleteExpenseWorkflow).mockResolvedValue({ deletedPayments: [] } as never);

    const result = await (deleteExpense as ServerFn)({ data: { id: 1, token: 'token' } });

    expect(deleteFromStorage).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('throws when expense not found', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(null);

    await expect(
      (deleteExpense as ServerFn)({ data: { id: 999, token: 'token' } })
    ).rejects.toThrow('Expense not found');
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    await expect((deleteExpense as ServerFn)({ data: { id: 1, token: 'token' } })).rejects.toThrow(
      'Admin access required'
    );
  });
});

describe('claimPayment', () => {
  it('claims payment successfully without proof', async () => {
    vi.mocked(createClaimWorkflow).mockResolvedValue({
      participantId: 1,
      expenseId: 1,
      colleagueId: 1,
      participantAmount: new Prisma.Decimal('50'),
      payment: { id: 1, amount: new Prisma.Decimal('50'), colleague: null },
    } as never);

    const form = createFormData({
      participantId: '1',
      paymentMethod: 'PAYME',
      paymentProofFile: null,
    });
    const result = await (claimPayment as ServerFn)({ data: form });

    expect(createClaimWorkflow).toHaveBeenCalledWith(prisma, {
      participantId: 1,
      paymentType: 'PAYME',
      paymentProofBucket: null,
      paymentProofObjectKey: null,
    });
    expect(result).toEqual(
      expect.objectContaining({ success: true, participant: expect.objectContaining({ id: 1 }) })
    );
  });

  it('claims payment with colleague data', async () => {
    vi.mocked(createClaimWorkflow).mockResolvedValue({
      participantId: 1,
      expenseId: 1,
      colleagueId: 1,
      participantAmount: new Prisma.Decimal('50'),
      payment: { id: 1, amount: new Prisma.Decimal('50'), colleague: { id: 1, name: 'Alice' } },
    } as never);

    const form = createFormData({
      participantId: '1',
      paymentMethod: 'PAYME',
      paymentProofFile: null,
    });
    const result = await (claimPayment as ServerFn)({ data: form });

    expect(result.payment.colleague).toEqual({ id: 1, name: 'Alice' });
  });

  it('claims payment with proof upload', async () => {
    vi.mocked(uploadFileToStorage).mockResolvedValue({
      bucket: 'proofs',
      objectKey: 'proof-1.jpg',
    } as never);
    vi.mocked(createClaimWorkflow).mockResolvedValue({
      participantId: 1,
      expenseId: 1,
      colleagueId: 1,
      participantAmount: new Prisma.Decimal('50'),
      payment: { id: 1, amount: new Prisma.Decimal('50'), colleague: null },
    } as never);

    const file = new File(['test'], 'proof.jpg', { type: 'image/jpeg' });
    const form = createFormData({
      participantId: '1',
      paymentMethod: 'PAYME',
      paymentProofFile: file,
    });
    await (claimPayment as ServerFn)({ data: form });

    expect(uploadFileToStorage).toHaveBeenCalled();
    expect(createClaimWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        paymentProofBucket: 'proofs',
        paymentProofObjectKey: 'proof-1.jpg',
      })
    );
  });

  it('rejects invalid file upload', async () => {
    vi.mocked(uploadFileToStorage).mockRejectedValue(new Error('Bad file'));

    const file = new File(['test'], 'bad.exe', { type: 'application/x-msdownload' });
    const form = createFormData({
      participantId: '1',
      paymentMethod: 'PAYME',
      paymentProofFile: file,
    });
    await expect((claimPayment as ServerFn)({ data: form })).rejects.toThrow(
      'Failed to claim payment'
    );
  });

  it('rejects unauthenticated callers before touching the workflow', async () => {
    // SECURITY: claimPayment must require an authenticated identity so anonymous
    // RPC cannot file pending claims. Uses Once so the rejection does not leak
    // into sibling tests (beforeEach only clearAllMocks, not resetAllMocks).
    vi.mocked(requireAuthFromCookie).mockRejectedValueOnce(
      new AppError(ErrorCode.AUTH_REQUIRED, 'Authentication required')
    );

    const form = createFormData({
      participantId: '1',
      paymentMethod: 'PAYME',
      paymentProofFile: null,
    });
    await expect((claimPayment as ServerFn)({ data: form })).rejects.toThrow(
      'Authentication required'
    );
    expect(createClaimWorkflow).not.toHaveBeenCalled();
  });
});

describe('duplicateExpense', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('duplicates expense successfully', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      restaurantId: 1,
      amount: new Prisma.Decimal('100'),
      splitType: 'EQUAL',
      notes: null,
      participants: [{ colleagueId: 1 }],
      items: [],
    } as never);
    vi.mocked(createExpenseWorkflow).mockResolvedValue({
      expense: { id: 2, amount: new Prisma.Decimal('100'), participants: [] },
    } as never);
    vi.mocked(autoApplyPrepaymentsForExpenseWorkflow).mockResolvedValue(null as never);

    const result = await (duplicateExpense as ServerFn)({ data: { id: 1, token: 'token' } });

    expect(createExpenseWorkflow).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ id: 2 }));
  });

  it('throws when original expense not found', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(null);

    await expect(
      (duplicateExpense as ServerFn)({ data: { id: 999, token: 'token' } })
    ).rejects.toThrow('Expense not found');
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    await expect(
      (duplicateExpense as ServerFn)({ data: { id: 1, token: 'token' } })
    ).rejects.toThrow('Admin access required');
  });
});

describe('updateExpense', () => {
  const baseUpdateForm = {
    token: 'valid-token',
    id: '1',
    date: '2024-06-15',
    restaurantId: '1',
    amount: '120',
    splitType: 'EQUAL',
    participantIds: JSON.stringify([1, 2]),
    items: null,
    notes: null,
    receiptFile: null,
    removeExistingReceipt: null,
  };

  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('updates expense without receipt change', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      receiptBucket: null,
      receiptObjectKey: null,
      participants: [],
      items: [],
    } as never);
    vi.mocked(updateExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('120') },
    } as never);

    const form = createFormData(baseUpdateForm);
    const result = await (updateExpense as ServerFn)({ data: form });

    expect(updateExpenseWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ id: 1, amount: 120 })
    );
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('removes existing receipt and deletes from MinIO', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      receiptBucket: 'receipts',
      receiptObjectKey: 'old.jpg',
      participants: [],
      items: [],
    } as never);
    vi.mocked(updateExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('120') },
    } as never);

    const form = createFormData({ ...baseUpdateForm, removeExistingReceipt: 'true' });
    await (updateExpense as ServerFn)({ data: form });

    expect(deleteFromStorage).toHaveBeenCalledWith('receipts', 'old.jpg');
    expect(updateExpenseWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ receiptBucket: null, receiptObjectKey: null })
    );
  });

  it('replaces receipt: uploads new and deletes old', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      receiptBucket: 'receipts',
      receiptObjectKey: 'old.jpg',
      participants: [],
      items: [],
    } as never);
    vi.mocked(uploadFileToStorage).mockResolvedValue({
      bucket: 'receipts',
      objectKey: 'new.jpg',
    } as never);
    vi.mocked(updateExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('120') },
    } as never);

    const file = new File(['test'], 'new.jpg', { type: 'image/jpeg' });
    const form = createFormData({ ...baseUpdateForm, receiptFile: file });
    await (updateExpense as ServerFn)({ data: form });

    expect(uploadFileToStorage).toHaveBeenCalled();
    expect(deleteFromStorage).toHaveBeenCalledWith('receipts', 'old.jpg');
  });

  it('throws when expense not found', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(null);

    const form = createFormData(baseUpdateForm);
    await expect((updateExpense as ServerFn)({ data: form })).rejects.toThrow('Expense not found');
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    const form = createFormData(baseUpdateForm);
    await expect((updateExpense as ServerFn)({ data: form })).rejects.toThrow(
      'Admin access required'
    );
  });
});

describe('approvePaymentClaim', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('approves claim successfully', async () => {
    vi.mocked(approveClaimWorkflow).mockResolvedValue({
      participantId: 1,
      expenseId: 1,
      colleagueId: 1,
      approvedPayments: [{ id: 1, amount: new Prisma.Decimal('50') }],
    } as never);

    const result = await (approvePaymentClaim as ServerFn)({
      data: { participantId: 1, token: 'token' },
    });

    expect(approveClaimWorkflow).toHaveBeenCalledWith(prisma, { participantId: 1 });
    expect(result).toEqual(
      expect.objectContaining({ success: true, participant: expect.objectContaining({ id: 1 }) })
    );
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    await expect(
      (approvePaymentClaim as ServerFn)({ data: { participantId: 1, token: 'token' } })
    ).rejects.toThrow('Admin access required');
  });
});

describe('undoClaim', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('undoes pending claim and cleans up MinIO proofs', async () => {
    vi.mocked(undoClaimWorkflow).mockResolvedValue({
      participantId: 1,
      expenseId: 1,
      colleagueId: 1,
      totalReversedAmount: 50,
      deletedPayments: [
        { id: 1, expenseId: 1, paymentProofBucket: 'proofs', paymentProofObjectKey: 'proof-1.jpg' },
      ],
    } as never);

    const result = await (undoClaim as ServerFn)({
      data: { participantId: 1, type: 'PENDING', token: 'token' },
    });

    expect(undoClaimWorkflow).toHaveBeenCalledWith(prisma, {
      participantId: 1,
      undoType: 'PENDING',
    });
    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'proof-1.jpg');
    expect(result).toEqual(expect.objectContaining({ success: true, totalReversedAmount: 50 }));
  });

  it('undoes approved claim without MinIO cleanup', async () => {
    vi.mocked(undoClaimWorkflow).mockResolvedValue({
      participantId: 1,
      expenseId: 1,
      colleagueId: 1,
      totalReversedAmount: 50,
      deletedPayments: [],
    } as never);

    const result = await (undoClaim as ServerFn)({
      data: { participantId: 1, type: 'APPROVED', token: 'token' },
    });

    expect(deleteFromStorage).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it('handles deleted payment without proof files when undoing pending', async () => {
    vi.mocked(undoClaimWorkflow).mockResolvedValue({
      participantId: 1,
      expenseId: 1,
      colleagueId: 1,
      totalReversedAmount: 50,
      deletedPayments: [
        { id: 1, expenseId: 1, paymentProofBucket: null, paymentProofObjectKey: null },
      ],
    } as never);

    const result = await (undoClaim as ServerFn)({
      data: { participantId: 1, type: 'PENDING', token: 'token' },
    });

    expect(deleteFromStorage).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ success: true, totalReversedAmount: 50 }));
  });

  it('rethrows AppError from workflow', async () => {
    vi.mocked(undoClaimWorkflow).mockRejectedValue(
      new AppError(ErrorCode.BUSINESS_NO_PENDING_CLAIM, 'No pending claim')
    );

    await expect(
      (undoClaim as ServerFn)({ data: { participantId: 1, type: 'PENDING', token: 'token' } })
    ).rejects.toThrow('No pending claim');
  });

  it('wraps non-AppError from workflow in infrastructure error', async () => {
    vi.mocked(undoClaimWorkflow).mockRejectedValue(new Error('Database timeout'));

    await expect(
      (undoClaim as ServerFn)({ data: { participantId: 1, type: 'APPROVED', token: 'token' } })
    ).rejects.toThrow('Failed to undo claim');
  });
});

// =============================================================================
// BRANCH COVERAGE: AppError rethrow and generic catch branches
// =============================================================================

describe('createExpense - error branches', () => {
  const baseFormData = {
    token: 'valid-token',
    date: '2024-06-15',
    restaurantId: '1',
    amount: '100',
    splitType: 'EQUAL',
    participantIds: JSON.stringify([1, 2]),
    items: null,
    notes: null,
    receiptFile: null,
  };

  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('rethrows AppError from workflow', async () => {
    vi.mocked(createExpenseWorkflow).mockRejectedValue(
      new AppError(ErrorCode.BUSINESS_ALREADY_PAID, 'Already paid')
    );

    const form = createFormData(baseFormData);
    await expect((createExpense as ServerFn)({ data: form })).rejects.toThrow('Already paid');
  });

  it('wraps non-AppError from workflow in infrastructure error', async () => {
    vi.mocked(createExpenseWorkflow).mockRejectedValue(new Error('DB connection lost'));

    const form = createFormData(baseFormData);
    await expect((createExpense as ServerFn)({ data: form })).rejects.toThrow(
      'Failed to create expense'
    );
  });

  it('rethrows AppError from auto-apply prepayments', async () => {
    vi.mocked(createExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('100'), participants: [] },
    } as never);
    vi.mocked(autoApplyPrepaymentsForExpenseWorkflow).mockRejectedValue(
      new AppError(ErrorCode.BUSINESS_NO_UNAPPLIED_FUNDS, 'No unapplied funds')
    );

    const form = createFormData(baseFormData);
    await expect((createExpense as ServerFn)({ data: form })).rejects.toThrow('No unapplied funds');
  });
});

describe('deleteExpense - error branches', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('rethrows AppError from workflow', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      receiptBucket: null,
      receiptObjectKey: null,
    } as never);
    vi.mocked(deleteExpenseWorkflow).mockRejectedValue(
      new AppError(ErrorCode.BUSINESS_HAS_RELATED_EXPENSES, 'Has related expenses')
    );

    await expect((deleteExpense as ServerFn)({ data: { id: 1, token: 'token' } })).rejects.toThrow(
      'Has related expenses'
    );
  });

  it('wraps non-AppError from workflow in infrastructure error', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      receiptBucket: null,
      receiptObjectKey: null,
    } as never);
    vi.mocked(deleteExpenseWorkflow).mockRejectedValue(new Error('DB timeout'));

    await expect((deleteExpense as ServerFn)({ data: { id: 1, token: 'token' } })).rejects.toThrow(
      'Failed to delete expense'
    );
  });

  it('handles deleted payment without proof files', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      receiptBucket: null,
      receiptObjectKey: null,
    } as never);
    vi.mocked(deleteExpenseWorkflow).mockResolvedValue({
      deletedPayments: [
        { id: 1, paymentProofBucket: null, paymentProofObjectKey: null, expenseId: 1 },
      ],
    } as never);

    const result = await (deleteExpense as ServerFn)({ data: { id: 1, token: 'token' } });

    expect(deleteFromStorage).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
  it('deletes expense with deleteRelatedPayments true', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      receiptBucket: null,
      receiptObjectKey: null,
    } as never);
    vi.mocked(deleteExpenseWorkflow).mockResolvedValue({
      deletedPayments: [],
    } as never);

    const result = await (deleteExpense as ServerFn)({
      data: { id: 1, deleteRelatedPayments: true, token: 'token' },
    });

    expect(deleteExpenseWorkflow).toHaveBeenCalledWith(prisma, {
      id: 1,
      deleteRelatedPayments: true,
    });
    expect(result).toEqual({ success: true });
  });
});

describe('claimPayment - error branches', () => {
  it('rethrows AppError from workflow', async () => {
    vi.mocked(createClaimWorkflow).mockRejectedValue(
      new AppError(ErrorCode.BUSINESS_CLAIM_PENDING, 'Claim already pending')
    );

    const form = createFormData({
      participantId: '1',
      paymentMethod: 'PAYME',
      paymentProofFile: null,
    });
    await expect((claimPayment as ServerFn)({ data: form })).rejects.toThrow(
      'Claim already pending'
    );
  });

  it('wraps non-AppError from workflow in infrastructure error', async () => {
    vi.mocked(createClaimWorkflow).mockRejectedValue(new Error('DB deadlock'));

    const form = createFormData({
      participantId: '1',
      paymentMethod: 'PAYME',
      paymentProofFile: null,
    });
    await expect((claimPayment as ServerFn)({ data: form })).rejects.toThrow(
      'Failed to claim payment'
    );
  });
});

describe('duplicateExpense - error branches', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('rethrows AppError from workflow', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      restaurantId: 1,
      amount: new Prisma.Decimal('100'),
      splitType: 'EQUAL',
      notes: null,
      participants: [{ colleagueId: 1 }],
      items: [],
    } as never);
    vi.mocked(createExpenseWorkflow).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_RESTAURANT, 'Restaurant not found')
    );

    await expect(
      (duplicateExpense as ServerFn)({ data: { id: 1, token: 'token' } })
    ).rejects.toThrow('Restaurant not found');
  });

  it('wraps non-AppError from workflow in infrastructure error', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      restaurantId: 1,
      amount: new Prisma.Decimal('100'),
      splitType: 'EQUAL',
      notes: null,
      participants: [{ colleagueId: 1 }],
      items: [],
    } as never);
    vi.mocked(createExpenseWorkflow).mockRejectedValue(new Error('DB failure'));

    await expect(
      (duplicateExpense as ServerFn)({ data: { id: 1, token: 'token' } })
    ).rejects.toThrow('Failed to duplicate expense');
  });

  it('duplicates with newDate provided', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      restaurantId: 1,
      amount: new Prisma.Decimal('100'),
      splitType: 'EQUAL',
      notes: null,
      participants: [{ colleagueId: 1 }],
      items: [],
    } as never);
    vi.mocked(createExpenseWorkflow).mockResolvedValue({
      expense: { id: 2, amount: new Prisma.Decimal('100'), participants: [] },
    } as never);
    vi.mocked(autoApplyPrepaymentsForExpenseWorkflow).mockResolvedValue(null as never);

    const result = await (duplicateExpense as ServerFn)({
      data: { id: 1, newDate: '2024-12-25', token: 'token' },
    });

    expect(createExpenseWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ date: '2024-12-25' })
    );
    expect(result).toEqual(expect.objectContaining({ id: 2 }));
  });

  it('duplicates ITEMIZED expense with items', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      restaurantId: 1,
      amount: new Prisma.Decimal('100'),
      splitType: 'ITEMIZED',
      notes: 'Team lunch',
      participants: [{ colleagueId: 1 }, { colleagueId: 2 }],
      items: [
        { name: 'Burger', price: new Prisma.Decimal('50'), colleagueId: 1 },
        { name: 'Fries', price: new Prisma.Decimal('30'), colleagueId: 2 },
      ],
    } as never);
    vi.mocked(createExpenseWorkflow).mockResolvedValue({
      expense: { id: 2, amount: new Prisma.Decimal('100'), participants: [] },
    } as never);
    vi.mocked(autoApplyPrepaymentsForExpenseWorkflow).mockResolvedValue(null as never);

    const result = await (duplicateExpense as ServerFn)({
      data: { id: 1, token: 'token' },
    });

    expect(createExpenseWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        splitType: 'ITEMIZED',
        items: [
          { name: 'Burger', price: 50, colleagueId: 1 },
          { name: 'Fries', price: 30, colleagueId: 2 },
        ],
      })
    );
    expect(result).toEqual(expect.objectContaining({ id: 2 }));
  });

  it('duplicates expense with auto-apply results', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      restaurantId: 1,
      amount: new Prisma.Decimal('100'),
      splitType: 'EQUAL',
      notes: null,
      participants: [{ colleagueId: 1 }],
      items: [],
    } as never);
    vi.mocked(createExpenseWorkflow).mockResolvedValue({
      expense: { id: 2, amount: new Prisma.Decimal('100'), participants: [] },
    } as never);
    vi.mocked(autoApplyPrepaymentsForExpenseWorkflow).mockResolvedValue({
      autoApplications: [{ id: 1 }],
      totalAutoApplied: 50,
    } as never);

    const result = await (duplicateExpense as ServerFn)({
      data: { id: 1, token: 'token' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 2,
        autoApplications: [{ id: 1 }],
        totalAutoApplied: 50,
      })
    );
  });
});

describe('updateExpense - error branches', () => {
  const baseUpdateForm = {
    token: 'valid-token',
    id: '1',
    date: '2024-06-15',
    restaurantId: '1',
    amount: '120',
    splitType: 'EQUAL',
    participantIds: JSON.stringify([1, 2]),
    items: null,
    notes: null,
    receiptFile: null,
    removeExistingReceipt: null,
  };

  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('rethrows AppError from workflow', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      receiptBucket: null,
      receiptObjectKey: null,
      participants: [],
      items: [],
    } as never);
    vi.mocked(updateExpenseWorkflow).mockRejectedValue(
      new AppError(ErrorCode.BUSINESS_ALREADY_PAID, 'Already paid')
    );

    const form = createFormData(baseUpdateForm);
    await expect((updateExpense as ServerFn)({ data: form })).rejects.toThrow('Already paid');
  });

  it('wraps non-AppError from workflow in infrastructure error', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      receiptBucket: null,
      receiptObjectKey: null,
      participants: [],
      items: [],
    } as never);
    vi.mocked(updateExpenseWorkflow).mockRejectedValue(new Error('DB timeout'));

    const form = createFormData(baseUpdateForm);
    await expect((updateExpense as ServerFn)({ data: form })).rejects.toThrow(
      'Failed to update expense'
    );
  });

  it('handles receipt removal when no receipt exists', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      receiptBucket: null,
      receiptObjectKey: null,
      participants: [],
      items: [],
    } as never);
    vi.mocked(updateExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('120') },
    } as never);

    const form = createFormData({ ...baseUpdateForm, removeExistingReceipt: 'true' });
    await (updateExpense as ServerFn)({ data: form });

    expect(deleteFromStorage).not.toHaveBeenCalled();
    expect(updateExpenseWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ receiptBucket: null, receiptObjectKey: null })
    );
  });

  it('handles receipt upload when no existing receipt exists', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      receiptBucket: null,
      receiptObjectKey: null,
      participants: [],
      items: [],
    } as never);
    vi.mocked(uploadFileToStorage).mockResolvedValue({
      bucket: 'receipts',
      objectKey: 'new.jpg',
    } as never);
    vi.mocked(updateExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('120') },
    } as never);

    const file = new File(['test'], 'new.jpg', { type: 'image/jpeg' });
    const form = createFormData({ ...baseUpdateForm, receiptFile: file });
    await (updateExpense as ServerFn)({ data: form });

    expect(uploadFileToStorage).toHaveBeenCalled();
    expect(deleteFromStorage).not.toHaveBeenCalled();
    expect(updateExpenseWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ receiptBucket: 'receipts', receiptObjectKey: 'new.jpg' })
    );
  });
});

describe('approvePaymentClaim - error branches', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('rethrows AppError from workflow', async () => {
    vi.mocked(approveClaimWorkflow).mockRejectedValue(
      new AppError(ErrorCode.BUSINESS_NO_PENDING_CLAIM, 'No pending claim')
    );

    await expect(
      (approvePaymentClaim as ServerFn)({ data: { participantId: 1, token: 'token' } })
    ).rejects.toThrow('No pending claim');
  });

  it('wraps non-AppError from workflow in infrastructure error', async () => {
    vi.mocked(approveClaimWorkflow).mockRejectedValue(new Error('DB failure'));

    await expect(
      (approvePaymentClaim as ServerFn)({ data: { participantId: 1, token: 'token' } })
    ).rejects.toThrow('Failed to approve payment claim');
  });
});

// =============================================================================
// VALIDATION / SCHEMA FAILURE BRANCHES
// =============================================================================

describe('createExpense - validation branches', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('rejects invalid splitType enum value', async () => {
    const form = createFormData({
      token: 'valid-token',
      date: '2024-06-15',
      restaurantId: '1',
      amount: '100',
      splitType: 'INVALID',
      participantIds: JSON.stringify([1, 2]),
      items: null,
      notes: null,
      receiptFile: null,
    });

    await expect((createExpense as ServerFn)({ data: form })).rejects.toThrow();
  });

  it('rejects when there is no valid session cookie', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(
      new AppError(ErrorCode.AUTH_REQUIRED, 'Authentication required')
    );

    const form = createFormData({
      token: '',
      date: '2024-06-15',
      restaurantId: '1',
      amount: '100',
      splitType: 'EQUAL',
      participantIds: JSON.stringify([1, 2]),
      items: null,
      notes: null,
      receiptFile: null,
    });

    await expect((createExpense as ServerFn)({ data: form })).rejects.toThrow(
      'Authentication required'
    );
  });

  it('parses ITEMIZED splitType with items', async () => {
    vi.mocked(createExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('100'), participants: [] },
    } as never);
    vi.mocked(autoApplyPrepaymentsForExpenseWorkflow).mockResolvedValue(null as never);

    const form = createFormData({
      token: 'valid-token',
      date: '2024-06-15',
      restaurantId: '1',
      amount: '100',
      splitType: 'ITEMIZED',
      participantIds: JSON.stringify([1, 2]),
      items: JSON.stringify([{ price: 50, colleagueId: 1, name: 'Burger' }]),
      notes: null,
      receiptFile: null,
    });

    const result = await (createExpense as ServerFn)({ data: form });
    expect(createExpenseWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        splitType: 'ITEMIZED',
        items: [{ price: 50, colleagueId: 1, name: 'Burger' }],
      })
    );
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('parses items without optional name field', async () => {
    vi.mocked(createExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('100'), participants: [] },
    } as never);
    vi.mocked(autoApplyPrepaymentsForExpenseWorkflow).mockResolvedValue(null as never);

    const form = createFormData({
      token: 'valid-token',
      date: '2024-06-15',
      restaurantId: '1',
      amount: '100',
      splitType: 'ITEMIZED',
      participantIds: JSON.stringify([1, 2]),
      items: JSON.stringify([{ price: 50, colleagueId: 1 }]),
      notes: null,
      receiptFile: null,
    });

    await (createExpense as ServerFn)({ data: form });
    expect(createExpenseWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        items: [{ price: 50, colleagueId: 1 }],
      })
    );
  });
});

describe('claimPayment - validation branches', () => {
  it('rejects invalid paymentMethod enum value', async () => {
    const form = createFormData({
      participantId: '1',
      paymentMethod: 'INVALID',
      paymentProofFile: null,
    });

    await expect((claimPayment as ServerFn)({ data: form })).rejects.toThrow();
  });

  it('throws when paymentMethod is null (not in form data)', async () => {
    const form = createFormData({
      participantId: '1',
      paymentProofFile: null,
    });

    await expect((claimPayment as ServerFn)({ data: form })).rejects.toThrow();
  });
});

describe('undoClaim - validation branches', () => {
  it('rejects invalid type enum value', async () => {
    const form = createFormData({
      participantId: '1',
      type: 'INVALID',
      token: 'token',
    });

    await expect((undoClaim as ServerFn)({ data: form })).rejects.toThrow();
  });
});

describe('updateExpense - validation branches', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('rejects invalid splitType enum value', async () => {
    const form = createFormData({
      token: 'valid-token',
      id: '1',
      date: '2024-06-15',
      restaurantId: '1',
      amount: '120',
      splitType: 'INVALID',
      participantIds: JSON.stringify([1, 2]),
      items: null,
      notes: null,
      receiptFile: null,
      removeExistingReceipt: null,
    });

    await expect((updateExpense as ServerFn)({ data: form })).rejects.toThrow();
  });

  it('rejects invalid items JSON in updateExpense', async () => {
    const form = createFormData({
      token: 'valid-token',
      id: '1',
      date: '2024-06-15',
      restaurantId: '1',
      amount: '120',
      splitType: 'EQUAL',
      participantIds: JSON.stringify([1, 2]),
      items: 'not-valid-json',
      notes: null,
      receiptFile: null,
      removeExistingReceipt: null,
    });

    await expect((updateExpense as ServerFn)({ data: form })).rejects.toThrow();
  });

  it('rejects when there is no valid session cookie', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(
      new AppError(ErrorCode.AUTH_REQUIRED, 'Authentication required')
    );

    const form = createFormData({
      token: '',
      id: '1',
      date: '2024-06-15',
      restaurantId: '1',
      amount: '120',
      splitType: 'EQUAL',
      participantIds: JSON.stringify([1, 2]),
      items: null,
      notes: null,
      receiptFile: null,
      removeExistingReceipt: null,
    });

    await expect((updateExpense as ServerFn)({ data: form })).rejects.toThrow(
      'Authentication required'
    );
  });
});

// =============================================================================
// EDGE CASES: getExpenseRelatedPayments, deleteExpense MinIO errors
// =============================================================================

describe('getExpenseRelatedPayments - edge cases', () => {
  it('returns false when no related payments exist', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.payment.count).mockResolvedValue(0);

    const result = await (getExpenseRelatedPayments as ServerFn)({ data: { id: 1 } });

    expect(result).toEqual({ hasRelatedPayments: false, paymentCount: 0 });
  });
});

describe('deleteExpense - MinIO error edge cases', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('handles MinIO deletion errors gracefully for receipt', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      receiptBucket: 'receipts',
      receiptObjectKey: 'receipt-1.jpg',
    } as never);
    vi.mocked(deleteExpenseWorkflow).mockResolvedValue({
      deletedPayments: [],
    } as never);
    vi.mocked(deleteFromStorage).mockRejectedValue(new Error('MinIO down'));

    const result = await (deleteExpense as ServerFn)({ data: { id: 1, token: 'token' } });

    expect(deleteFromStorage).toHaveBeenCalledWith('receipts', 'receipt-1.jpg');
    expect(result).toEqual({ success: true });
  });

  it('handles MinIO deletion errors gracefully for payment proofs', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      receiptBucket: null,
      receiptObjectKey: null,
    } as never);
    vi.mocked(deleteExpenseWorkflow).mockResolvedValue({
      deletedPayments: [
        { id: 1, paymentProofBucket: 'proofs', paymentProofObjectKey: 'proof-1.jpg', expenseId: 1 },
      ],
    } as never);
    vi.mocked(deleteFromStorage).mockRejectedValue(new Error('MinIO down'));

    const result = await (deleteExpense as ServerFn)({ data: { id: 1, token: 'token' } });

    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'proof-1.jpg');
    expect(result).toEqual({ success: true });
  });
});

describe('updateExpense - MinIO error edge cases', () => {
  const baseUpdateForm = {
    token: 'valid-token',
    id: '1',
    date: '2024-06-15',
    restaurantId: '1',
    amount: '120',
    splitType: 'EQUAL',
    participantIds: JSON.stringify([1, 2]),
    items: null,
    notes: null,
    receiptFile: null,
    removeExistingReceipt: null,
  };

  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('handles MinIO deletion error when removing receipt', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      receiptBucket: 'receipts',
      receiptObjectKey: 'old.jpg',
      participants: [],
      items: [],
    } as never);
    vi.mocked(deleteFromStorage).mockRejectedValue(new Error('MinIO down'));
    vi.mocked(updateExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('120') },
    } as never);

    const form = createFormData({ ...baseUpdateForm, removeExistingReceipt: 'true' });
    await (updateExpense as ServerFn)({ data: form });

    expect(deleteFromStorage).toHaveBeenCalledWith('receipts', 'old.jpg');
    expect(updateExpenseWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ receiptBucket: null, receiptObjectKey: null })
    );
  });

  it('handles MinIO deletion error when replacing receipt', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: 1,
      receiptBucket: 'receipts',
      receiptObjectKey: 'old.jpg',
      participants: [],
      items: [],
    } as never);
    vi.mocked(uploadFileToStorage).mockResolvedValue({
      bucket: 'receipts',
      objectKey: 'new.jpg',
    } as never);
    vi.mocked(deleteFromStorage).mockRejectedValue(new Error('MinIO down'));
    vi.mocked(updateExpenseWorkflow).mockResolvedValue({
      expense: { id: 1, amount: new Prisma.Decimal('120') },
    } as never);

    const file = new File(['test'], 'new.jpg', { type: 'image/jpeg' });
    const form = createFormData({ ...baseUpdateForm, receiptFile: file });
    await (updateExpense as ServerFn)({ data: form });

    expect(uploadFileToStorage).toHaveBeenCalled();
    expect(deleteFromStorage).toHaveBeenCalledWith('receipts', 'old.jpg');
    expect(updateExpenseWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ receiptBucket: 'receipts', receiptObjectKey: 'new.jpg' })
    );
  });
});

describe('undoClaim - MinIO error edge cases', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('handles MinIO deletion error when undoing pending claim', async () => {
    vi.mocked(undoClaimWorkflow).mockResolvedValue({
      participantId: 1,
      expenseId: 1,
      colleagueId: 1,
      totalReversedAmount: 50,
      deletedPayments: [
        { id: 1, expenseId: 1, paymentProofBucket: 'proofs', paymentProofObjectKey: 'proof-1.jpg' },
      ],
    } as never);
    vi.mocked(deleteFromStorage).mockRejectedValue(new Error('MinIO down'));

    const result = await (undoClaim as ServerFn)({
      data: { participantId: 1, type: 'PENDING', token: 'token' },
    });

    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'proof-1.jpg');
    expect(result).toEqual(expect.objectContaining({ success: true, totalReversedAmount: 50 }));
  });
});
