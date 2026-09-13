import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

// Mock TanStack Start createServerFn before importing handlers
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
  requireAdminFromCookie: vi.fn(),
}));

vi.mock('@/server/infrastructure/storage', () => ({
  uploadToMinio: vi.fn(),
  deleteFromStorage: vi.fn(),
}));

vi.mock('@/server/utils/file-validation', () => ({
  validateUploadedFileObject: vi.fn(),
}));

vi.mock('@/server/infrastructure/prisma', async () => {
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = await import('@prisma/client');
  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://debtmaster:debtmaster@localhost:5432/debtmaster';
  const adapter = new PrismaPg(databaseUrl);
  const prisma = new PrismaClient({ adapter });
  return { prisma };
});

// Dynamic import of handlers AFTER mocks are set up
const { createExpense, updateExpense, deleteExpense, getExpenseRelatedPayments } = await import(
  './mutations'
);
const { requireAdminFromCookie, getAuthFromCookie } = await import(
  '@/server/infrastructure/auth/auth-cookie'
);

describe('Expense Handlers (Integration)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!process.env.RUN_INTEGRATION_TESTS) return;
    const { prisma: mockPrisma } = await import('@/server/infrastructure/prisma');
    prisma = mockPrisma as PrismaClient;
  });

  afterAll(async () => {
    if (!process.env.RUN_INTEGRATION_TESTS || !prisma) return;
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!process.env.RUN_INTEGRATION_TESTS || !prisma) return;
    await prisma.paymentApplication.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.expenseItem.deleteMany();
    await prisma.expenseParticipant.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.colleague.deleteMany();
    await prisma.restaurant.deleteMany();

    vi.clearAllMocks();
  });

  const itIfEnabled = process.env.RUN_INTEGRATION_TESTS ? it : it.skip;

  itIfEnabled('createExpense handler creates an expense in DB', async () => {
    // Setup prerequisite data
    const restaurant = await prisma.restaurant.create({
      data: { name: 'Test Restaurant' },
    });

    const colleague1 = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

    const colleague2 = await prisma.colleague.create({
      data: { name: 'Bob' },
    });

    // Mock admin auth
    vi.mocked(requireAdminFromCookie).mockResolvedValue({
      id: 1,
      name: 'Admin',
      isAdmin: true,
    } as unknown as Awaited<ReturnType<typeof requireAdminFromCookie>>);

    // Build FormData
    const formData = new FormData();
    formData.append('token', 'admin-token');
    formData.append('date', '2024-01-15');
    formData.append('restaurantId', String(restaurant.id));
    formData.append('amount', '100.00');
    formData.append('splitType', 'EQUAL');
    formData.append('participantIds', JSON.stringify([colleague1.id, colleague2.id]));

    // Call handler
    const result = await createExpense({ data: formData });

    // Verify result shape
    expect(result).toBeDefined();
    expect(result.amount).toBe(100);

    // Verify DB record
    const expenses = await prisma.expense.findMany({
      include: { participants: true },
    });
    expect(expenses).toHaveLength(1);

    const expense = expenses[0];
    if (!expense) throw new Error('Expected expense to exist');

    expect(expense.amount.toNumber()).toBe(100);
    expect(expense.splitType).toBe('EQUAL');
    expect(expense.restaurantId).toBe(restaurant.id);
    expect(expense.participants).toHaveLength(2);

    const participantIds = expense.participants.map((p) => p.colleagueId).sort();
    expect(participantIds).toEqual([colleague1.id, colleague2.id].sort());

    // Verify mocks
    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });

  itIfEnabled('createExpense handler returns error for non-admin', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    const formData = new FormData();
    formData.append('token', 'non-admin-token');
    formData.append('date', '2024-01-15');
    formData.append('restaurantId', '1');
    formData.append('amount', '100.00');
    formData.append('splitType', 'EQUAL');
    formData.append('participantIds', JSON.stringify([1]));

    await expect(createExpense({ data: formData })).rejects.toThrow('Failed to create expense');
    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });

  itIfEnabled('updateExpense handler updates an expense in DB', async () => {
    // Setup prerequisite data
    const restaurant = await prisma.restaurant.create({
      data: { name: 'Test Restaurant' },
    });

    const colleague1 = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

    const colleague2 = await prisma.colleague.create({
      data: { name: 'Bob' },
    });

    // Create an expense directly via Prisma
    const expense = await prisma.expense.create({
      data: {
        date: new Date('2024-01-15'),
        amount: 100.0,
        splitType: 'EQUAL',
        restaurantId: restaurant.id,
        participants: {
          create: [
            { colleagueId: colleague1.id, amount: 50.0 },
            { colleagueId: colleague2.id, amount: 50.0 },
          ],
        },
      },
      include: { participants: true },
    });

    // Mock admin auth
    vi.mocked(requireAdminFromCookie).mockResolvedValue({
      id: 1,
      name: 'Admin',
      isAdmin: true,
    } as unknown as Awaited<ReturnType<typeof requireAdminFromCookie>>);

    // Build FormData with updated fields
    const formData = new FormData();
    formData.append('token', 'admin-token');
    formData.append('id', String(expense.id));
    formData.append('date', '2024-02-20');
    formData.append('restaurantId', String(restaurant.id));
    formData.append('amount', '200.00');
    formData.append('splitType', 'EQUAL');
    formData.append('participantIds', JSON.stringify([colleague1.id, colleague2.id]));

    // Call handler
    const result = await updateExpense({ data: formData });

    // Verify result shape
    expect(result).toBeDefined();
    expect(result.amount).toBe(200);

    // Verify DB record was updated
    const updatedExpense = await prisma.expense.findUnique({
      where: { id: expense.id },
      include: { participants: true },
    });

    if (!updatedExpense) throw new Error('Expected expense to exist');

    expect(updatedExpense.amount.toNumber()).toBe(200);
    expect(updatedExpense.participants).toHaveLength(2);

    // Verify mocks
    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });

  itIfEnabled('deleteExpense handler deletes an expense from DB', async () => {
    // Setup prerequisite data
    const restaurant = await prisma.restaurant.create({
      data: { name: 'Test Restaurant' },
    });

    const colleague = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

    // Create an expense directly via Prisma
    const expense = await prisma.expense.create({
      data: {
        date: new Date('2024-01-15'),
        amount: 100.0,
        splitType: 'EQUAL',
        restaurantId: restaurant.id,
        participants: {
          create: [{ colleagueId: colleague.id, amount: 100.0 }],
        },
      },
    });

    // Mock admin auth
    vi.mocked(requireAdminFromCookie).mockResolvedValue({
      id: 1,
      name: 'Admin',
      isAdmin: true,
    } as unknown as Awaited<ReturnType<typeof requireAdminFromCookie>>);

    // Call handler with plain object (JSON inputValidator)
    const result = await deleteExpense({
      data: { id: expense.id, token: 'admin-token' },
    });

    // Verify result
    expect(result).toEqual({ success: true });

    // Verify expense no longer in DB
    const deletedExpense = await prisma.expense.findUnique({
      where: { id: expense.id },
    });
    expect(deletedExpense).toBeNull();

    // Verify mocks
    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });

  itIfEnabled('getExpenseRelatedPayments returns correct payment count', async () => {
    // Setup prerequisite data
    const restaurant = await prisma.restaurant.create({
      data: { name: 'Test Restaurant' },
    });

    const colleague = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

    // Create expense with participant
    const expense = await prisma.expense.create({
      data: {
        date: new Date('2024-01-15'),
        amount: 100.0,
        splitType: 'EQUAL',
        restaurantId: restaurant.id,
        participants: {
          create: [{ colleagueId: colleague.id, amount: 100.0 }],
        },
      },
      include: { participants: true },
    });

    const participant = expense.participants[0];
    if (!participant) throw new Error('Expected participant to exist');

    // Create a payment and payment application
    const payment = await prisma.payment.create({
      data: {
        colleagueId: colleague.id,
        amount: 100.0,
        date: new Date('2024-01-16'),
        paymentType: 'FULL',
        isApproved: true,
        expenseId: expense.id,
      },
    });

    await prisma.paymentApplication.create({
      data: {
        paymentId: payment.id,
        expenseId: expense.id,
        participantId: participant.id,
        amount: 100.0,
      },
    });

    // Mock auth
    vi.mocked(getAuthFromCookie).mockResolvedValue({
      id: colleague.id,
      name: 'Alice',
      isAdmin: false,
    } as unknown as Awaited<ReturnType<typeof getAuthFromCookie>>);

    // Call handler with plain object (JSON inputValidator)
    const result = await getExpenseRelatedPayments({
      data: { id: expense.id },
    });

    // Verify result
    expect(result).toEqual({
      hasRelatedPayments: true,
      paymentCount: 1,
    });

    expect(getAuthFromCookie).toHaveBeenCalledTimes(1);
  });
});
