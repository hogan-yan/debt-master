import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFormData } from '@/test/helpers/form-data';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    payment: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  requireAdminFromCookie: vi.fn(),
}));

vi.mock('@/server/infrastructure/storage', () => ({
  uploadFileToStorage: vi.fn(),
  deleteFromStorage: vi.fn(),
}));

vi.mock('@/server/utils/file-validation', () => ({
  validateUploadedFileObject: vi.fn(),
}));

vi.mock('@/server/infrastructure/logger', () => ({
  createServerLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./types', () => ({
  serializePayment: vi.fn((payment) => ({
    ...payment,
    amount: payment.amount instanceof Prisma.Decimal ? Number(payment.amount) : payment.amount,
  })),
}));

vi.mock('./workflows/create-payment-workflow', () => ({
  createPaymentWorkflow: vi.fn(),
}));

vi.mock('./workflows/update-payment-workflow', () => ({
  updatePaymentWorkflow: vi.fn(),
}));

vi.mock('./workflows/delete-payment-workflow', () => ({
  deletePaymentWorkflow: vi.fn(),
}));

vi.mock('./workflows/apply-unused-funds-workflow', () => ({
  applyUnusedFundsWorkflow: vi.fn(),
}));

vi.mock('./workflows/bulk-claim-for-colleague-workflow', () => ({
  bulkClaimForColleagueWorkflow: vi.fn(),
}));

vi.mock('./workflows/cancel-redundant-pending-claims-workflow', () => ({
  cancelRedundantPendingClaimsWorkflow: vi.fn(),
}));

import { requireAdminFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { deleteFromStorage, uploadFileToStorage } from '@/server/infrastructure/storage';
import { AppError, ErrorCode } from '@/utils/errors';
import {
  applyUnusedFundsToExpense,
  bulkClaimForColleague,
  createPayment,
  deletePayment,
  updatePayment,
} from './mutations';
import { applyUnusedFundsWorkflow } from './workflows/apply-unused-funds-workflow';
import { bulkClaimForColleagueWorkflow } from './workflows/bulk-claim-for-colleague-workflow';
import { cancelRedundantPendingClaimsWorkflow } from './workflows/cancel-redundant-pending-claims-workflow';
import { createPaymentWorkflow } from './workflows/create-payment-workflow';
import { deletePaymentWorkflow } from './workflows/delete-payment-workflow';
import { updatePaymentWorkflow } from './workflows/update-payment-workflow';

// biome-ignore lint/suspicious/noExplicitAny: test helper to call mocked server functions with loose typing
type ServerFn = (ctx: { data: any }) => Promise<any>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(
    async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)
  );
});

describe('createPayment', () => {
  const baseFormData = {
    token: 'valid-token',
    colleagueId: '1',
    amount: '100',
    date: '2024-06-15',
    paymentType: 'CASH',
    restaurantId: null,
    paymentProofFile: null,
    selectedExpenseIds: null,
    expenseAmounts: null,
  };

  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('creates payment successfully without proof', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 0,
      remainingAmount: 100,
      autoPayments: [],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 0,
      proofsToCleanUp: [],
    } as never);

    const form = createFormData(baseFormData);
    const result = await (createPayment as ServerFn)({ data: form });

    expect(requireAdminFromCookie).toHaveBeenCalled();
    expect(createPaymentWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        colleagueId: 1,
        amount: 100,
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        selectedExpenseIds: [],
      })
    );
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('creates payment with proof upload', async () => {
    vi.mocked(uploadFileToStorage).mockResolvedValue({
      bucket: 'proofs',
      objectKey: 'proof-1.jpg',
    } as never);
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 0,
      remainingAmount: 100,
      autoPayments: [],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 0,
      proofsToCleanUp: [],
    } as never);

    const file = new File(['test'], 'proof.jpg', { type: 'image/jpeg' });
    const form = createFormData({ ...baseFormData, paymentProofFile: file });
    const result = await (createPayment as ServerFn)({ data: form });

    expect(uploadFileToStorage).toHaveBeenCalled();
    expect(createPaymentWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        paymentProofBucket: 'proofs',
        paymentProofObjectKey: 'proof-1.jpg',
      })
    );
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('creates payment with expense selection', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 50,
      remainingAmount: 50,
      autoPayments: [],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 0,
      proofsToCleanUp: [],
    } as never);

    const form = createFormData({
      ...baseFormData,
      selectedExpenseIds: JSON.stringify([1, 2]),
      expenseAmounts: JSON.stringify({ '1': '30', '2': '20' }),
    });
    const result = await (createPayment as ServerFn)({ data: form });

    expect(createPaymentWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ selectedExpenseIds: [1, 2] })
    );
    expect(result).toEqual(expect.objectContaining({ totalApplied: 50, remainingBalance: 50 }));
  });

  it('creates payment with restaurant id', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 0,
      remainingAmount: 100,
      autoPayments: [],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 0,
      proofsToCleanUp: [],
    } as never);

    const form = createFormData({ ...baseFormData, restaurantId: '5' });
    await (createPayment as ServerFn)({ data: form });

    expect(createPaymentWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ restaurantId: 5 })
    );
  });

  it('cleans up canceled claim proofs after transaction', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 0,
      remainingAmount: 100,
      autoPayments: [],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 1,
      proofsToCleanUp: [
        {
          paymentId: 1,
          expenseId: 1,
          paymentProofBucket: 'proofs',
          paymentProofObjectKey: 'old-proof.jpg',
        },
      ],
    } as never);

    const form = createFormData(baseFormData);
    await (createPayment as ServerFn)({ data: form });

    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'old-proof.jpg');
  });

  it('skips proof upload when file is empty', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 0,
      remainingAmount: 100,
      autoPayments: [],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 0,
      proofsToCleanUp: [],
    } as never);

    const file = new File([], 'empty.jpg', { type: 'image/jpeg' });
    const form = createFormData({ ...baseFormData, paymentProofFile: file });
    await (createPayment as ServerFn)({ data: form });

    expect(uploadFileToStorage).not.toHaveBeenCalled();
    expect(createPaymentWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ paymentProofBucket: null, paymentProofObjectKey: null })
    );
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    const form = createFormData(baseFormData);
    await expect((createPayment as ServerFn)({ data: form })).rejects.toThrow(
      'Admin access required'
    );
  });

  it('rejects invalid file upload', async () => {
    vi.mocked(uploadFileToStorage).mockRejectedValue(new Error('Invalid file type'));

    const file = new File(['test'], 'bad.exe', { type: 'application/x-msdownload' });
    const form = createFormData({ ...baseFormData, paymentProofFile: file });
    await expect((createPayment as ServerFn)({ data: form })).rejects.toThrow(
      'Failed to create payment with payment proof'
    );
  });

  it('rethrows AppError from workflow without wrapping', async () => {
    vi.mocked(createPaymentWorkflow).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'payment not found')
    );
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 0,
      proofsToCleanUp: [],
    } as never);

    const form = createFormData(baseFormData);
    await expect((createPayment as ServerFn)({ data: form })).rejects.toThrow('payment not found');
  });

  it('serializes application amounts that are numbers or strings', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [
          { id: 1, amount: 25 },
          { id: 2, amount: '25.5' },
        ],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 50.5,
      remainingAmount: 49.5,
      autoPayments: [],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 0,
      proofsToCleanUp: [],
    } as never);

    const form = createFormData(baseFormData);
    const result = await (createPayment as ServerFn)({ data: form });

    expect(result.applications).toEqual([
      { id: 1, amount: 25 },
      { id: 2, amount: 25.5 },
    ]);
  });

  it('serializes application amounts that are Prisma.Decimal', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [{ id: 1, amount: new Prisma.Decimal('25.5') }],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 25.5,
      remainingAmount: 74.5,
      autoPayments: [],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 0,
      proofsToCleanUp: [],
    } as never);

    const form = createFormData(baseFormData);
    const result = await (createPayment as ServerFn)({ data: form });

    expect(result.applications).toEqual([{ id: 1, amount: 25.5 }]);
  });

  it('serializes autoPayments with Prisma.Decimal, number, string amounts and with/without expense', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 100,
      remainingAmount: 0,
      autoPayments: [
        {
          id: 1,
          amount: new Prisma.Decimal('30'),
          expense: { id: 1, amount: new Prisma.Decimal('50') },
        },
        { id: 2, amount: 25, expense: null },
        { id: 3, amount: '15.5', expense: { id: 2, amount: new Prisma.Decimal('40') } },
      ],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 0,
      proofsToCleanUp: [],
    } as never);

    const form = createFormData(baseFormData);
    const result = await (createPayment as ServerFn)({ data: form });

    expect(result.autoPayments).toEqual([
      { id: 1, amount: 30, expense: { id: 1, amount: 50 } },
      { id: 2, amount: 25, expense: null },
      { id: 3, amount: 15.5, expense: { id: 2, amount: 40 } },
    ]);
  });

  it('handles deleteFromStorage error during canceled claim cleanup', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 0,
      remainingAmount: 100,
      autoPayments: [],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 1,
      proofsToCleanUp: [
        {
          paymentId: 1,
          expenseId: 1,
          paymentProofBucket: 'proofs',
          paymentProofObjectKey: 'old.jpg',
        },
      ],
    } as never);
    vi.mocked(deleteFromStorage).mockRejectedValue(new Error('MinIO error'));

    const form = createFormData(baseFormData);
    const result = await (createPayment as ServerFn)({ data: form });

    expect(result).toEqual(expect.objectContaining({ id: 1 }));
    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'old.jpg');
  });

  it('wraps generic error from cancelRedundantPendingClaimsWorkflow', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 0,
      remainingAmount: 100,
      autoPayments: [],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockRejectedValue(new Error('workflow error'));

    const form = createFormData(baseFormData);
    await expect((createPayment as ServerFn)({ data: form })).rejects.toThrow(
      'Failed to create payment with payment proof'
    );
  });

  it('rejects invalid JSON in selectedExpenseIds', async () => {
    const form = createFormData({ ...baseFormData, selectedExpenseIds: 'not-json' });
    await expect((createPayment as ServerFn)({ data: form })).rejects.toThrow();
  });

  it('rejects invalid JSON in expenseAmounts', async () => {
    const form = createFormData({ ...baseFormData, expenseAmounts: 'not-json' });
    await expect((createPayment as ServerFn)({ data: form })).rejects.toThrow();
  });

  it('handles undefined applications from workflow', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: undefined,
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 0,
      remainingAmount: 100,
      autoPayments: [],
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 0,
      proofsToCleanUp: [],
    } as never);

    const form = createFormData(baseFormData);
    const result = await (createPayment as ServerFn)({ data: form });

    expect(result.applications).toEqual([]);
  });

  it('handles undefined autoPayments from workflow', async () => {
    vi.mocked(createPaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('100'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
      totalAppliedAmount: 0,
      remainingAmount: 100,
      autoPayments: undefined,
    } as never);
    vi.mocked(cancelRedundantPendingClaimsWorkflow).mockResolvedValue({
      canceledCount: 0,
      proofsToCleanUp: [],
    } as never);

    const form = createFormData(baseFormData);
    const result = await (createPayment as ServerFn)({ data: form });

    expect(result.autoPayments).toEqual([]);
  });
});

describe('applyUnusedFundsToExpense', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('applies unused funds successfully', async () => {
    vi.mocked(applyUnusedFundsWorkflow).mockResolvedValue({
      success: true,
      appliedAmount: 50,
      colleagueName: 'Alice',
      applications: [],
      remainingOwed: 50,
      totalUnapplied: 0,
    } as never);

    const result = await (applyUnusedFundsToExpense as ServerFn)({
      data: { participantId: 1, token: 'token' },
    });

    expect(applyUnusedFundsWorkflow).toHaveBeenCalledWith(prisma, { participantId: 1 });
    expect(result).toEqual({ success: true, appliedAmount: 50, colleagueName: 'Alice' });
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    await expect(
      (applyUnusedFundsToExpense as ServerFn)({ data: { participantId: 1, token: 'token' } })
    ).rejects.toThrow('Admin access required');
  });

  it('propagates generic errors from workflow', async () => {
    vi.mocked(applyUnusedFundsWorkflow).mockRejectedValue(new Error('workflow error'));

    await expect(
      (applyUnusedFundsToExpense as ServerFn)({ data: { participantId: 1, token: 'token' } })
    ).rejects.toThrow('workflow error');
  });
});

describe('updatePayment', () => {
  const baseUpdateForm = {
    token: 'valid-token',
    id: '1',
    colleagueId: '1',
    amount: '150',
    date: '2024-06-20',
    paymentType: 'CASH',
    paymentProofFile: null,
    removeExistingProof: null,
    selectedExpenseIds: null,
    expenseAmounts: null,
  };

  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('updates payment without proof change', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 1,
      paymentProofBucket: null,
      paymentProofObjectKey: null,
    } as never);
    vi.mocked(updatePaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('150'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
    } as never);

    const form = createFormData(baseUpdateForm);
    const result = await (updatePayment as ServerFn)({ data: form });

    expect(updatePaymentWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ id: 1, amount: 150 })
    );
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('replaces proof: uploads new and deletes old', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 1,
      paymentProofBucket: 'proofs',
      paymentProofObjectKey: 'old.jpg',
    } as never);
    vi.mocked(uploadFileToStorage).mockResolvedValue({
      bucket: 'proofs',
      objectKey: 'new.jpg',
    } as never);
    vi.mocked(updatePaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('150'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
    } as never);

    const file = new File(['test'], 'new.jpg', { type: 'image/jpeg' });
    const form = createFormData({ ...baseUpdateForm, paymentProofFile: file });
    await (updatePayment as ServerFn)({ data: form });

    expect(uploadFileToStorage).toHaveBeenCalled();
    expect(updatePaymentWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ paymentProofBucket: 'proofs', paymentProofObjectKey: 'new.jpg' })
    );
    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'old.jpg');
  });

  it('removes existing proof and deletes from MinIO', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 1,
      paymentProofBucket: 'proofs',
      paymentProofObjectKey: 'old.jpg',
    } as never);
    vi.mocked(updatePaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('150'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
    } as never);

    const form = createFormData({ ...baseUpdateForm, removeExistingProof: 'true' });
    await (updatePayment as ServerFn)({ data: form });

    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'old.jpg');
    expect(updatePaymentWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ paymentProofBucket: null, paymentProofObjectKey: null })
    );
  });

  it('updates payment with expense selection', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 1,
      paymentProofBucket: null,
      paymentProofObjectKey: null,
    } as never);
    vi.mocked(updatePaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('150'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
    } as never);

    const form = createFormData({
      ...baseUpdateForm,
      selectedExpenseIds: JSON.stringify([3, 4]),
      expenseAmounts: JSON.stringify({ '3': '20', '4': '30' }),
    });
    await (updatePayment as ServerFn)({ data: form });

    expect(updatePaymentWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ selectedExpenseIds: [3, 4] })
    );
  });

  it('throws validation error for invalid id', async () => {
    const form = createFormData({ ...baseUpdateForm, id: 'not-a-number' });
    await expect((updatePayment as ServerFn)({ data: form })).rejects.toThrow('Invalid id');
  });

  it('throws validation error for invalid colleagueId', async () => {
    const form = createFormData({ ...baseUpdateForm, colleagueId: 'not-a-number' });
    await expect((updatePayment as ServerFn)({ data: form })).rejects.toThrow(
      'Invalid colleagueId'
    );
  });

  it('throws validation error for invalid amount', async () => {
    const form = createFormData({ ...baseUpdateForm, amount: 'not-a-number' });
    await expect((updatePayment as ServerFn)({ data: form })).rejects.toThrow('Invalid amount');
  });

  it('throws when payment not found', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);

    const form = createFormData(baseUpdateForm);
    await expect((updatePayment as ServerFn)({ data: form })).rejects.toThrow('Payment not found');
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    const form = createFormData(baseUpdateForm);
    await expect((updatePayment as ServerFn)({ data: form })).rejects.toThrow(
      'Admin access required'
    );
  });

  it('ignores paymentProofFile with size 0', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 1,
      paymentProofBucket: null,
      paymentProofObjectKey: null,
    } as never);
    vi.mocked(updatePaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('150'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
    } as never);

    const file = new File([], 'empty.jpg', { type: 'image/jpeg' });
    const form = createFormData({ ...baseUpdateForm, paymentProofFile: file });
    const result = await (updatePayment as ServerFn)({ data: form });

    expect(uploadFileToStorage).not.toHaveBeenCalled();
    expect(updatePaymentWorkflow).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ paymentProofBucket: null, paymentProofObjectKey: null })
    );
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('does not delete old proof when original lacks bucket', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 1,
      paymentProofBucket: null,
      paymentProofObjectKey: 'old.jpg',
    } as never);
    vi.mocked(uploadFileToStorage).mockResolvedValue({
      bucket: 'proofs',
      objectKey: 'new.jpg',
    } as never);
    vi.mocked(updatePaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('150'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
    } as never);

    const file = new File(['test'], 'new.jpg', { type: 'image/jpeg' });
    const form = createFormData({ ...baseUpdateForm, paymentProofFile: file });
    await (updatePayment as ServerFn)({ data: form });

    expect(uploadFileToStorage).toHaveBeenCalled();
    expect(deleteFromStorage).not.toHaveBeenCalled();
  });

  it('does not delete old proof when original lacks objectKey', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 1,
      paymentProofBucket: 'proofs',
      paymentProofObjectKey: null,
    } as never);
    vi.mocked(uploadFileToStorage).mockResolvedValue({
      bucket: 'proofs',
      objectKey: 'new.jpg',
    } as never);
    vi.mocked(updatePaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('150'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
    } as never);

    const file = new File(['test'], 'new.jpg', { type: 'image/jpeg' });
    const form = createFormData({ ...baseUpdateForm, paymentProofFile: file });
    await (updatePayment as ServerFn)({ data: form });

    expect(uploadFileToStorage).toHaveBeenCalled();
    expect(deleteFromStorage).not.toHaveBeenCalled();
  });

  it('handles deleteFromStorage error during old proof cleanup', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 1,
      paymentProofBucket: 'proofs',
      paymentProofObjectKey: 'old.jpg',
    } as never);
    vi.mocked(uploadFileToStorage).mockResolvedValue({
      bucket: 'proofs',
      objectKey: 'new.jpg',
    } as never);
    vi.mocked(updatePaymentWorkflow).mockResolvedValue({
      payment: {
        id: 1,
        amount: new Prisma.Decimal('150'),
        applications: [],
        colleague: null,
        restaurant: null,
      },
    } as never);
    vi.mocked(deleteFromStorage).mockRejectedValue(new Error('MinIO error'));

    const file = new File(['test'], 'new.jpg', { type: 'image/jpeg' });
    const form = createFormData({ ...baseUpdateForm, paymentProofFile: file });
    const result = await (updatePayment as ServerFn)({ data: form });

    expect(result).toEqual(expect.objectContaining({ id: 1 }));
    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'old.jpg');
  });

  it('rejects invalid JSON in selectedExpenseIds', async () => {
    const form = createFormData({ ...baseUpdateForm, selectedExpenseIds: 'not-json' });
    await expect((updatePayment as ServerFn)({ data: form })).rejects.toThrow();
  });

  it('rejects invalid JSON in expenseAmounts', async () => {
    const form = createFormData({ ...baseUpdateForm, expenseAmounts: 'not-json' });
    await expect((updatePayment as ServerFn)({ data: form })).rejects.toThrow();
  });

  it('rejects invalid selectedExpenseIds with negative numbers', async () => {
    const form = createFormData({
      ...baseUpdateForm,
      selectedExpenseIds: JSON.stringify([1, -2]),
    });
    await expect((updatePayment as ServerFn)({ data: form })).rejects.toThrow();
  });
});

describe('deletePayment', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('deletes payment and cleans up MinIO proofs', async () => {
    vi.mocked(deletePaymentWorkflow).mockResolvedValue({
      deletedPaymentId: 1,
      proofsToCleanUp: [
        {
          paymentId: 1,
          expenseId: 1,
          paymentProofBucket: 'proofs',
          paymentProofObjectKey: 'proof-1.jpg',
        },
      ],
    } as never);

    const result = await (deletePayment as ServerFn)({ data: { id: 1, token: 'token' } });

    expect(deletePaymentWorkflow).toHaveBeenCalledWith(prisma, { paymentId: 1 });
    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'proof-1.jpg');
    expect(result).toEqual({ success: true, deletedPaymentId: 1 });
  });

  it('deletes payment without MinIO cleanup when no proofs', async () => {
    vi.mocked(deletePaymentWorkflow).mockResolvedValue({
      deletedPaymentId: 1,
      proofsToCleanUp: [],
    } as never);

    const result = await (deletePayment as ServerFn)({ data: { id: 1, token: 'token' } });

    expect(deleteFromStorage).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, deletedPaymentId: 1 });
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    await expect((deletePayment as ServerFn)({ data: { id: 1, token: 'token' } })).rejects.toThrow(
      'Admin access required'
    );
  });

  it('handles deleteFromStorage error during proof cleanup', async () => {
    vi.mocked(deletePaymentWorkflow).mockResolvedValue({
      deletedPaymentId: 1,
      proofsToCleanUp: [
        {
          paymentId: 1,
          expenseId: 1,
          paymentProofBucket: 'proofs',
          paymentProofObjectKey: 'proof.jpg',
        },
      ],
    } as never);
    vi.mocked(deleteFromStorage).mockRejectedValue(new Error('MinIO error'));

    const result = await (deletePayment as ServerFn)({ data: { id: 1, token: 'token' } });

    expect(result).toEqual({ success: true, deletedPaymentId: 1 });
    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'proof.jpg');
  });
});

describe('bulkClaimForColleague', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('creates bulk claim successfully', async () => {
    vi.mocked(bulkClaimForColleagueWorkflow).mockResolvedValue({
      paymentId: 1,
      amount: new Prisma.Decimal('200'),
      expenseCount: 3,
      proofsToCleanUp: [],
    } as never);

    const result = await (bulkClaimForColleague as ServerFn)({
      data: { colleagueId: 1, paymentType: 'CASH', date: '2024-06-15', token: 'token' },
    });

    expect(bulkClaimForColleagueWorkflow).toHaveBeenCalledWith(prisma, {
      colleagueId: 1,
      paymentType: 'CASH',
      date: '2024-06-15',
    });
    expect(result).toEqual({
      success: true,
      paymentId: 1,
      amount: expect.any(Object),
      expenseCount: 3,
    });
  });

  it('cleans up MinIO proofs from canceled claims', async () => {
    vi.mocked(bulkClaimForColleagueWorkflow).mockResolvedValue({
      paymentId: 1,
      amount: new Prisma.Decimal('200'),
      expenseCount: 3,
      proofsToCleanUp: [
        {
          paymentId: 2,
          expenseId: 1,
          paymentProofBucket: 'proofs',
          paymentProofObjectKey: 'old-proof.jpg',
        },
      ],
    } as never);

    await (bulkClaimForColleague as ServerFn)({
      data: { colleagueId: 1, paymentType: 'CASH', token: 'token' },
    });

    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'old-proof.jpg');
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    await expect(
      (bulkClaimForColleague as ServerFn)({
        data: { colleagueId: 1, paymentType: 'CASH', token: 'token' },
      })
    ).rejects.toThrow('Admin access required');
  });

  it('handles deleteFromStorage error during proof cleanup', async () => {
    vi.mocked(bulkClaimForColleagueWorkflow).mockResolvedValue({
      paymentId: 1,
      amount: new Prisma.Decimal('200'),
      expenseCount: 3,
      proofsToCleanUp: [
        {
          paymentId: 2,
          expenseId: 1,
          paymentProofBucket: 'proofs',
          paymentProofObjectKey: 'old.jpg',
        },
      ],
    } as never);
    vi.mocked(deleteFromStorage).mockRejectedValue(new Error('MinIO error'));

    const result = await (bulkClaimForColleague as ServerFn)({
      data: { colleagueId: 1, paymentType: 'CASH', token: 'token' },
    });

    expect(result).toEqual(expect.objectContaining({ success: true, paymentId: 1 }));
    expect(deleteFromStorage).toHaveBeenCalledWith('proofs', 'old.jpg');
  });
});
