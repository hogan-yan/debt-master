/**
 * Update Expense Workflow Tests
 *
 * These tests verify the core business logic of updating expenses.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import { ExpenseWithRelations } from '../types';
import { UpdateExpenseInput, updateExpenseWorkflow } from './update-expense-workflow';

// =============================================================================
// TEST SETUP
// =============================================================================

describe('updateExpenseWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let expenseFindUnique: ReturnType<typeof vi.fn>;
  let expenseUpdate: ReturnType<typeof vi.fn>;
  let expenseParticipantDeleteMany: ReturnType<typeof vi.fn>;
  let expenseParticipantCreate: ReturnType<typeof vi.fn>;
  let expenseItemDeleteMany: ReturnType<typeof vi.fn>;
  let expenseItemCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    expenseFindUnique = vi.fn();
    expenseUpdate = vi.fn();
    expenseParticipantDeleteMany = vi.fn();
    expenseParticipantCreate = vi.fn();
    expenseItemDeleteMany = vi.fn();
    expenseItemCreate = vi.fn();

    mockTx = createMockTx({
      expense: {
        findUnique: expenseFindUnique,
        update: expenseUpdate,
      },
      expenseParticipant: {
        deleteMany: expenseParticipantDeleteMany,
        create: expenseParticipantCreate,
      },
      expenseItem: {
        deleteMany: expenseItemDeleteMany,
        create: expenseItemCreate,
      },
    });
  });

  const createMockExpense = (overrides: Partial<ExpenseWithRelations> = {}): ExpenseWithRelations =>
    ({
      id: 1,
      date: new Date('2024-06-15'),
      restaurantId: 1,
      amount: new Prisma.Decimal('100.00'),
      splitType: 'EQUAL',
      notes: null,
      receiptBucket: null,
      receiptObjectKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      restaurant: {
        id: 1,
        name: 'Test Restaurant',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      participants: [],
      items: [],
      ...overrides,
    }) as ExpenseWithRelations;

  const createMockExistingExpense = (participantIds: number[] = [1, 2]) => ({
    id: 1,
    date: new Date('2024-06-15'),
    restaurantId: 1,
    amount: new Prisma.Decimal('100.00'),
    splitType: 'EQUAL',
    notes: null,
    receiptBucket: null,
    receiptObjectKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    participants: participantIds.map((colleagueId) => ({
      id: colleagueId,
      expenseId: 1,
      colleagueId,
      amount: new Prisma.Decimal('50.00'),
    })),
    items: [],
  });

  const baseInput: UpdateExpenseInput = {
    id: 1,
  };

  // =============================================================================
  // BASIC UPDATE TESTS
  // =============================================================================

  it('should update expense core details', async () => {
    expenseFindUnique
      .mockResolvedValueOnce(createMockExistingExpense())
      .mockResolvedValueOnce(createMockExpense({ amount: new Prisma.Decimal('150.00') }));
    expenseUpdate.mockResolvedValue({});
    expenseParticipantDeleteMany.mockResolvedValue({ count: 2 });
    expenseParticipantCreate.mockResolvedValue({});

    const input: UpdateExpenseInput = {
      ...baseInput,
      amount: 150,
      date: '2024-07-01',
      restaurantId: 2,
      notes: 'Updated notes',
    };

    const result = await updateExpenseWorkflow(mockTx, input);

    expect(expenseUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        amount: 150,
        date: new Date('2024-07-01'),
        restaurantId: 2,
        notes: 'Updated notes',
      }),
    });
    expect(result.expense.amount).toEqual(new Prisma.Decimal('150.00'));
  });

  it('should delete existing participants and items before creating new ones', async () => {
    expenseFindUnique
      .mockResolvedValueOnce(createMockExistingExpense([1, 2]))
      .mockResolvedValueOnce(createMockExpense());
    expenseUpdate.mockResolvedValue({});
    expenseParticipantDeleteMany.mockResolvedValue({ count: 2 });
    expenseItemDeleteMany.mockResolvedValue({ count: 1 });
    expenseParticipantCreate.mockResolvedValue({});

    const input: UpdateExpenseInput = {
      ...baseInput,
      participantIds: [3, 4],
    };

    await updateExpenseWorkflow(mockTx, input);

    expect(expenseItemDeleteMany).toHaveBeenCalledWith({ where: { expenseId: 1 } });
    expect(expenseParticipantDeleteMany).toHaveBeenCalledWith({ where: { expenseId: 1 } });
    expect(expenseParticipantCreate).toHaveBeenCalledTimes(2);
  });

  // =============================================================================
  // EQUAL SPLIT TESTS
  // =============================================================================

  it('should recreate EQUAL split participants with new amount', async () => {
    expenseFindUnique
      .mockResolvedValueOnce(createMockExistingExpense([1, 2]))
      .mockResolvedValueOnce(createMockExpense());
    expenseUpdate.mockResolvedValue({});
    expenseParticipantDeleteMany.mockResolvedValue({ count: 2 });
    expenseParticipantCreate.mockResolvedValue({});

    const input: UpdateExpenseInput = {
      ...baseInput,
      amount: 200,
      participantIds: [1, 2],
    };

    await updateExpenseWorkflow(mockTx, input);

    expect(expenseParticipantCreate).toHaveBeenCalledTimes(2);
    expect(expenseParticipantCreate).toHaveBeenNthCalledWith(1, {
      data: { expenseId: 1, colleagueId: 1, amount: 100 },
    });
    expect(expenseParticipantCreate).toHaveBeenNthCalledWith(2, {
      data: { expenseId: 1, colleagueId: 2, amount: 100 },
    });
  });

  // =============================================================================
  // ITEMIZED SPLIT TESTS
  // =============================================================================

  it('should change from EQUAL to ITEMIZED split', async () => {
    expenseFindUnique
      .mockResolvedValueOnce(createMockExistingExpense([1, 2]))
      .mockResolvedValueOnce(
        createMockExpense({
          splitType: 'ITEMIZED',
          amount: new Prisma.Decimal('90.00'),
        })
      );
    expenseUpdate.mockResolvedValue({});
    expenseParticipantDeleteMany.mockResolvedValue({ count: 2 });
    expenseItemDeleteMany.mockResolvedValue({ count: 0 });
    expenseParticipantCreate.mockResolvedValue({});
    expenseItemCreate.mockResolvedValue({});

    const input: UpdateExpenseInput = {
      ...baseInput,
      amount: 90,
      splitType: 'ITEMIZED',
      items: [
        { name: '', price: 50, colleagueId: 1 },
        { name: 'Fries', price: 40, colleagueId: 2 },
      ],
    };

    const result = await updateExpenseWorkflow(mockTx, input);

    expect(expenseUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ splitType: 'ITEMIZED' }),
    });
    expect(expenseItemCreate).toHaveBeenCalledTimes(2);
    expect(expenseItemCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ name: 'Unnamed Item' }) })
    );
    expect(expenseParticipantCreate).toHaveBeenCalledTimes(2);
    expect(result.expense.splitType).toBe('ITEMIZED');
  });

  it('should change from ITEMIZED to EQUAL split', async () => {
    expenseFindUnique
      .mockResolvedValueOnce({
        ...createMockExistingExpense([1, 2]),
        splitType: 'ITEMIZED',
        items: [
          {
            id: 1,
            expenseId: 1,
            name: 'Burger',
            price: new Prisma.Decimal('50.00'),
            colleagueId: 1,
          },
          {
            id: 2,
            expenseId: 1,
            name: 'Fries',
            price: new Prisma.Decimal('50.00'),
            colleagueId: 2,
          },
        ],
      })
      .mockResolvedValueOnce(createMockExpense());
    expenseUpdate.mockResolvedValue({});
    expenseParticipantDeleteMany.mockResolvedValue({ count: 2 });
    expenseItemDeleteMany.mockResolvedValue({ count: 2 });
    expenseParticipantCreate.mockResolvedValue({});

    const input: UpdateExpenseInput = {
      ...baseInput,
      splitType: 'EQUAL',
      participantIds: [1, 2],
    };

    await updateExpenseWorkflow(mockTx, input);

    expect(expenseUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ splitType: 'EQUAL' }),
    });
    expect(expenseItemDeleteMany).toHaveBeenCalled();
    expect(expenseParticipantCreate).toHaveBeenCalledTimes(2);
  });

  it('should throw error when ITEMIZED items do not sum to amount', async () => {
    expenseFindUnique.mockResolvedValueOnce(createMockExistingExpense());

    const input: UpdateExpenseInput = {
      ...baseInput,
      amount: 100,
      splitType: 'ITEMIZED',
      items: [
        { name: 'Burger', price: 40, colleagueId: 1 },
        { name: 'Fries', price: 20, colleagueId: 2 },
      ],
    };

    await expect(updateExpenseWorkflow(mockTx, input)).rejects.toThrow(
      'Items total must equal expense amount'
    );
  });

  it('should use existing amount when validating ITEMIZED split items and amount not provided', async () => {
    expenseFindUnique.mockResolvedValueOnce(createMockExistingExpense([1, 2]));

    const input: UpdateExpenseInput = {
      ...baseInput,
      splitType: 'ITEMIZED',
      items: [
        { name: 'Item 1', price: 40, colleagueId: 1 },
        { name: 'Item 2', price: 50, colleagueId: 2 },
      ],
    };

    await expect(updateExpenseWorkflow(mockTx, input)).rejects.toThrow(
      'Items total must equal expense amount'
    );
  });

  // =============================================================================
  // RECEIPT METADATA TESTS
  // =============================================================================

  it('should update receipt metadata when provided', async () => {
    expenseFindUnique.mockResolvedValueOnce(createMockExistingExpense()).mockResolvedValueOnce(
      createMockExpense({
        receiptBucket: 'new-bucket',
        receiptObjectKey: 'uploads/new.pdf',
      })
    );
    expenseUpdate.mockResolvedValue({});
    expenseParticipantDeleteMany.mockResolvedValue({ count: 2 });
    expenseParticipantCreate.mockResolvedValue({});

    const input: UpdateExpenseInput = {
      ...baseInput,
      receiptBucket: 'new-bucket',
      receiptObjectKey: 'uploads/new.pdf',
    };

    await updateExpenseWorkflow(mockTx, input);

    expect(expenseUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        receiptBucket: 'new-bucket',
        receiptObjectKey: 'uploads/new.pdf',
      }),
    });
  });

  // =============================================================================
  // ERROR CASES
  // =============================================================================

  it('should throw error when expense not found', async () => {
    expenseFindUnique.mockResolvedValueOnce(null);

    await expect(updateExpenseWorkflow(mockTx, baseInput)).rejects.toThrow('Expense not found');
  });

  it('should propagate database errors during update', async () => {
    expenseFindUnique.mockResolvedValueOnce(createMockExistingExpense());
    expenseUpdate.mockRejectedValue(new Error('Database update failed'));

    await expect(updateExpenseWorkflow(mockTx, baseInput)).rejects.toThrow(
      'Database update failed'
    );
  });

  it('should throw error if fetched updated expense is null', async () => {
    expenseFindUnique
      .mockResolvedValueOnce(createMockExistingExpense())
      .mockResolvedValueOnce(null);
    expenseUpdate.mockResolvedValue({});
    expenseParticipantDeleteMany.mockResolvedValue({ count: 2 });
    expenseParticipantCreate.mockResolvedValue({});

    await expect(updateExpenseWorkflow(mockTx, baseInput)).rejects.toThrow(
      'Failed to fetch updated expense'
    );
  });
});
