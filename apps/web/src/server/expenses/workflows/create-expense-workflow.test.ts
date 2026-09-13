/**
 * Create Expense Workflow Tests
 *
 * These tests verify the core business logic of creating expenses.
 * They use mocked Prisma transaction client for fast, deterministic tests.
 */

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import { ExpenseWithRelations } from '../types';
import { CreateExpenseInput, createExpenseWorkflow } from './create-expense-workflow';

/**
 * Helper function to safely access array elements in tests.
 */
function expectElement<T>(arr: T[], index: number): T {
  const element = arr[index];
  if (element === undefined) {
    throw new Error(`Expected array to have element at index ${index}, but it was undefined`);
  }
  return element;
}

// =============================================================================
// TEST SETUP
// =============================================================================

describe('createExpenseWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let expenseCreate: ReturnType<typeof vi.fn>;
  let expenseFindUnique: ReturnType<typeof vi.fn>;
  let expenseParticipantCreate: ReturnType<typeof vi.fn>;
  let expenseItemCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    expenseCreate = vi.fn();
    expenseFindUnique = vi.fn();
    expenseParticipantCreate = vi.fn();
    expenseItemCreate = vi.fn();

    mockTx = createMockTx({
      expense: {
        create: expenseCreate,
        findUnique: expenseFindUnique,
      },
      expenseParticipant: {
        create: expenseParticipantCreate,
      },
      expenseItem: {
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

  const baseInput: CreateExpenseInput = {
    date: '2024-06-15',
    restaurantId: 1,
    amount: 100,
    splitType: 'EQUAL',
    participantIds: [1, 2],
  };

  // =============================================================================
  // EQUAL SPLIT TESTS
  // =============================================================================

  it('should create expense with EQUAL split', async () => {
    const createdExpense = createMockExpense({
      amount: new Prisma.Decimal('100.00'),
      splitType: 'EQUAL',
    });

    expenseCreate.mockResolvedValue({
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
    });
    expenseParticipantCreate.mockResolvedValue({});
    expenseFindUnique.mockResolvedValue(createdExpense);

    const result = await createExpenseWorkflow(mockTx, baseInput);

    expect(expenseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        date: new Date('2024-06-15'),
        restaurantId: 1,
        amount: 100,
        splitType: 'EQUAL',
        notes: null,
        receiptBucket: null,
        receiptObjectKey: null,
      }),
    });
    expect(expenseParticipantCreate).toHaveBeenCalledTimes(2);
    expect(expenseParticipantCreate).toHaveBeenNthCalledWith(1, {
      data: {
        expenseId: 1,
        colleagueId: 1,
        amount: 50,
      },
    });
    expect(expenseParticipantCreate).toHaveBeenNthCalledWith(2, {
      data: {
        expenseId: 1,
        colleagueId: 2,
        amount: 50,
      },
    });
    expect(result.expense).toEqual(createdExpense);
  });

  it('should handle EQUAL split with rounding remainder', async () => {
    expenseCreate.mockResolvedValue({
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
    });
    expenseParticipantCreate.mockResolvedValue({});
    expenseFindUnique.mockResolvedValue(createMockExpense());

    const input: CreateExpenseInput = {
      ...baseInput,
      amount: 100,
      participantIds: [1, 2, 3],
    };

    await createExpenseWorkflow(mockTx, input);

    expect(expenseParticipantCreate).toHaveBeenCalledTimes(3);
    const calls = expenseParticipantCreate.mock.calls;
    // First participant gets the remainder penny: $33.34, others get $33.33
    expect(expectElement(calls, 0)[0].data.amount).toBeCloseTo(33.34, 2);
    expect(expectElement(calls, 1)[0].data.amount).toBeCloseTo(33.33, 2);
    expect(expectElement(calls, 2)[0].data.amount).toBeCloseTo(33.33, 2);
  });

  // =============================================================================
  // ITEMIZED SPLIT TESTS
  // =============================================================================

  it('should create expense with ITEMIZED split', async () => {
    const createdExpense = createMockExpense({
      amount: new Prisma.Decimal('90.00'),
      splitType: 'ITEMIZED',
    });

    expenseCreate.mockResolvedValue({
      id: 1,
      date: new Date('2024-06-15'),
      restaurantId: 1,
      amount: new Prisma.Decimal('90.00'),
      splitType: 'ITEMIZED',
      notes: null,
      receiptBucket: null,
      receiptObjectKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expenseItemCreate.mockResolvedValue({});
    expenseParticipantCreate.mockResolvedValue({});
    expenseFindUnique.mockResolvedValue(createdExpense);

    const input: CreateExpenseInput = {
      ...baseInput,
      amount: 90,
      splitType: 'ITEMIZED',
      participantIds: [], // Not used for itemized
      items: [
        { name: '', price: 40, colleagueId: 1 },
        { name: 'Fries', price: 20, colleagueId: 1 },
        { name: 'Drink', price: 30, colleagueId: 2 },
      ],
    };

    const result = await createExpenseWorkflow(mockTx, input);

    expect(expenseItemCreate).toHaveBeenCalledTimes(3);
    expect(expenseItemCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ name: 'Unnamed Item' }) })
    );
    expect(expenseParticipantCreate).toHaveBeenCalledTimes(2);
    expect(expenseParticipantCreate).toHaveBeenNthCalledWith(1, {
      data: {
        expenseId: 1,
        colleagueId: 1,
        amount: 60,
      },
    });
    expect(expenseParticipantCreate).toHaveBeenNthCalledWith(2, {
      data: {
        expenseId: 1,
        colleagueId: 2,
        amount: 30,
      },
    });
    expect(result.expense).toEqual(createdExpense);
  });

  it('should throw error when ITEMIZED items do not sum to amount', async () => {
    const input: CreateExpenseInput = {
      ...baseInput,
      amount: 100,
      splitType: 'ITEMIZED',
      participantIds: [],
      items: [
        { name: 'Burger', price: 40, colleagueId: 1 },
        { name: 'Fries', price: 20, colleagueId: 2 },
      ],
    };

    await expect(createExpenseWorkflow(mockTx, input)).rejects.toThrow(
      'Items total must equal expense amount'
    );
  });

  it('should throw error when ITEMIZED split has no items', async () => {
    const input: CreateExpenseInput = {
      ...baseInput,
      amount: 100,
      splitType: 'ITEMIZED',
      participantIds: [],
      items: [],
    };

    await expect(createExpenseWorkflow(mockTx, input)).rejects.toThrow(
      'Itemized split requires items'
    );
  });

  it('requireItemizedItems throws when items are missing', async () => {
    const { requireItemizedItems } = await import('./create-expense-workflow');
    expect(() => requireItemizedItems(undefined)).toThrow('Itemized split requires items');
  });

  // =============================================================================
  // RECEIPT METADATA TESTS
  // =============================================================================

  it('should include receipt metadata when provided', async () => {
    expenseCreate.mockResolvedValue({
      id: 1,
      date: new Date('2024-06-15'),
      restaurantId: 1,
      amount: new Prisma.Decimal('100.00'),
      splitType: 'EQUAL',
      notes: null,
      receiptBucket: 'receipts-bucket',
      receiptObjectKey: 'uploads/receipt.pdf',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expenseParticipantCreate.mockResolvedValue({});
    expenseFindUnique.mockResolvedValue(
      createMockExpense({
        receiptBucket: 'receipts-bucket',
        receiptObjectKey: 'uploads/receipt.pdf',
      })
    );

    const input: CreateExpenseInput = {
      ...baseInput,
      receiptBucket: 'receipts-bucket',
      receiptObjectKey: 'uploads/receipt.pdf',
    };

    await createExpenseWorkflow(mockTx, input);

    expect(expenseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        receiptBucket: 'receipts-bucket',
        receiptObjectKey: 'uploads/receipt.pdf',
      }),
    });
  });

  // =============================================================================
  // NOTES AND EDGE CASES
  // =============================================================================

  it('should include notes when provided', async () => {
    expenseCreate.mockResolvedValue({
      id: 1,
      date: new Date('2024-06-15'),
      restaurantId: 1,
      amount: new Prisma.Decimal('100.00'),
      splitType: 'EQUAL',
      notes: 'Team lunch',
      receiptBucket: null,
      receiptObjectKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expenseParticipantCreate.mockResolvedValue({});
    expenseFindUnique.mockResolvedValue(createMockExpense());

    const input: CreateExpenseInput = {
      ...baseInput,
      notes: 'Team lunch',
    };

    await createExpenseWorkflow(mockTx, input);

    expect(expenseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notes: 'Team lunch',
      }),
    });
  });

  it('should propagate database errors during creation', async () => {
    expenseCreate.mockRejectedValue(new Error('Database connection failed'));

    await expect(createExpenseWorkflow(mockTx, baseInput)).rejects.toThrow(
      'Database connection failed'
    );
  });

  it('should throw error if fetched expense is null', async () => {
    expenseCreate.mockResolvedValue({
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
    });
    expenseParticipantCreate.mockResolvedValue({});
    expenseFindUnique.mockResolvedValue(null);

    await expect(createExpenseWorkflow(mockTx, baseInput)).rejects.toThrow(
      'Failed to fetch created expense'
    );
  });
});
