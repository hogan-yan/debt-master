/**
 * Delete Expense Workflow Tests
 *
 * These tests verify the core business logic of deleting expenses.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import { DeleteExpenseInput, deleteExpenseWorkflow } from './delete-expense-workflow';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('deleteExpenseWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;

  // Keep references to individual mock functions for assertions
  let paymentFindMany: ReturnType<typeof vi.fn>;
  let paymentDeleteMany: ReturnType<typeof vi.fn>;
  let expenseItemDeleteMany: ReturnType<typeof vi.fn>;
  let expenseParticipantDeleteMany: ReturnType<typeof vi.fn>;
  let expenseDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    paymentFindMany = vi.fn();
    paymentDeleteMany = vi.fn();
    expenseItemDeleteMany = vi.fn();
    expenseParticipantDeleteMany = vi.fn();
    expenseDelete = vi.fn();

    mockTx = createMockTx({
      payment: {
        findMany: paymentFindMany,
        deleteMany: paymentDeleteMany,
      },
      expenseItem: {
        deleteMany: expenseItemDeleteMany,
      },
      expenseParticipant: {
        deleteMany: expenseParticipantDeleteMany,
      },
      expense: {
        delete: expenseDelete,
      },
    });
  });

  const baseInput: DeleteExpenseInput = {
    id: 1,
    deleteRelatedPayments: false,
  };

  // =============================================================================
  // BASIC DELETE TESTS
  // =============================================================================

  it('should delete expense without related payments', async () => {
    expenseItemDeleteMany.mockResolvedValue({ count: 2 });
    expenseParticipantDeleteMany.mockResolvedValue({ count: 3 });
    expenseDelete.mockResolvedValue({
      id: 1,
      date: new Date(),
      restaurantId: 1,
      amount: new Prisma.Decimal('100'),
      splitType: 'EQUAL',
      notes: null,
      receiptBucket: null,
      receiptObjectKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await deleteExpenseWorkflow(mockTx, baseInput);

    expect(paymentFindMany).not.toHaveBeenCalled();
    expect(paymentDeleteMany).not.toHaveBeenCalled();
    expect(expenseItemDeleteMany).toHaveBeenCalledWith({ where: { expenseId: 1 } });
    expect(expenseParticipantDeleteMany).toHaveBeenCalledWith({ where: { expenseId: 1 } });
    expect(expenseDelete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result.deletedExpenseId).toBe(1);
    expect(result.deletedPayments).toEqual([]);
  });

  it('should delete expense with related payments and return proof metadata', async () => {
    paymentFindMany.mockResolvedValue([
      {
        id: 10,
        paymentProofBucket: 'bucket1',
        paymentProofObjectKey: 'proofs/1.pdf',
      },
      {
        id: 11,
        paymentProofBucket: null,
        paymentProofObjectKey: null,
      },
      {
        id: 12,
        paymentProofBucket: 'bucket2',
        paymentProofObjectKey: 'proofs/2.pdf',
      },
    ]);
    paymentDeleteMany.mockResolvedValue({ count: 3 });
    expenseItemDeleteMany.mockResolvedValue({ count: 2 });
    expenseParticipantDeleteMany.mockResolvedValue({ count: 3 });
    expenseDelete.mockResolvedValue({
      id: 1,
      date: new Date(),
      restaurantId: 1,
      amount: new Prisma.Decimal('100'),
      splitType: 'EQUAL',
      notes: null,
      receiptBucket: null,
      receiptObjectKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await deleteExpenseWorkflow(mockTx, {
      ...baseInput,
      deleteRelatedPayments: true,
    });

    expect(paymentFindMany).toHaveBeenCalledWith({
      where: { expenseId: 1 },
      include: { applications: true },
    });
    expect(paymentDeleteMany).toHaveBeenCalledWith({ where: { expenseId: 1 } });
    expect(expenseItemDeleteMany).toHaveBeenCalledWith({ where: { expenseId: 1 } });
    expect(expenseParticipantDeleteMany).toHaveBeenCalledWith({ where: { expenseId: 1 } });
    expect(expenseDelete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result.deletedExpenseId).toBe(1);
    expect(result.deletedPayments).toEqual([
      { id: 10, paymentProofBucket: 'bucket1', paymentProofObjectKey: 'proofs/1.pdf' },
      { id: 11, paymentProofBucket: null, paymentProofObjectKey: null },
      { id: 12, paymentProofBucket: 'bucket2', paymentProofObjectKey: 'proofs/2.pdf' },
    ]);
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  it('should propagate database errors during deletion', async () => {
    expenseDelete.mockRejectedValue(new Error('Database delete failed'));

    await expect(deleteExpenseWorkflow(mockTx, baseInput)).rejects.toThrow(
      'Database delete failed'
    );
  });
});
