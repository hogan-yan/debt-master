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
  uploadToMinio: vi.fn().mockResolvedValue({ bucket: 'test-bucket', objectKey: 'test-key' }),
  deleteFromStorage: vi.fn(),
}));

vi.mock('@/server/utils/file-validation', () => ({
  validateUploadedFileObject: vi
    .fn()
    .mockResolvedValue({ isValid: true, detectedMimeType: 'image/png' }),
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
const { createPayment, updatePayment, deletePayment, applyUnusedFundsToExpense } = await import(
  './mutations'
);
const { requireAdminFromCookie } = await import('@/server/infrastructure/auth/auth-cookie');

describe('Payment Handlers (Integration)', () => {
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

    vi.resetAllMocks();
  });

  const itIfEnabled = process.env.RUN_INTEGRATION_TESTS ? it : it.skip;

  itIfEnabled('createPayment handler creates a payment in DB', async () => {
    // Create prerequisite data
    const colleague = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

    // Mock admin auth
    vi.mocked(requireAdminFromCookie).mockResolvedValue({
      isAdmin: true,
      permissions: ['admin'],
      username: 'Admin',
    });

    // Build FormData
    const formData = new FormData();
    formData.append('token', 'admin-token');
    formData.append('colleagueId', String(colleague.id));
    formData.append('amount', '100');
    formData.append('date', '2024-01-15');
    formData.append('paymentType', 'PAYME');

    // Call handler
    const result = await createPayment({ data: formData });

    // Verify result shape
    expect(result).toBeDefined();

    // Verify DB record
    const payments = await prisma.payment.findMany();
    expect(payments).toHaveLength(1);

    const payment = payments[0];
    if (!payment) throw new Error('Expected payment to exist');

    expect(payment.amount.toNumber()).toBe(100);
    expect(payment.paymentType).toBe('PAYME');
    expect(payment.colleagueId).toBe(colleague.id);
    expect(payment.isApproved).toBe(true);

    // Verify mocks
    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });

  itIfEnabled('createPayment handler rejects non-admin', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    const formData = new FormData();
    formData.append('token', 'non-admin-token');
    formData.append('colleagueId', '1');
    formData.append('amount', '100');
    formData.append('date', '2024-01-15');
    formData.append('paymentType', 'PAYME');

    await expect(createPayment({ data: formData })).rejects.toThrow('Admin access required');
    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });

  itIfEnabled('updatePayment handler updates a payment in DB', async () => {
    // Create prerequisite data
    const colleague = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

    const payment = await prisma.payment.create({
      data: {
        colleagueId: colleague.id,
        amount: 100.0,
        date: new Date('2024-01-15'),
        paymentType: 'PAYME',
        isApproved: true,
      },
    });

    // Mock admin auth
    vi.mocked(requireAdminFromCookie).mockResolvedValue({
      isAdmin: true,
      permissions: ['admin'],
      username: 'Admin',
    });

    // Build FormData with updated fields
    const formData = new FormData();
    formData.append('token', 'admin-token');
    formData.append('id', String(payment.id));
    formData.append('colleagueId', String(colleague.id));
    formData.append('amount', '200');
    formData.append('date', '2024-02-01');
    formData.append('paymentType', 'FPS');

    // Call handler
    const result = await updatePayment({ data: formData });

    // Verify result shape
    expect(result).toBeDefined();

    // Verify DB record was updated
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
    });

    if (!updatedPayment) throw new Error('Expected payment to exist');

    expect(updatedPayment.amount.toNumber()).toBe(200);
    expect(updatedPayment.paymentType).toBe('FPS');
    expect(updatedPayment.date.toISOString().startsWith('2024-02-01')).toBe(true);

    // Verify mocks
    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });

  itIfEnabled('deletePayment handler deletes a payment from DB', async () => {
    // Create prerequisite data
    const colleague = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

    const payment = await prisma.payment.create({
      data: {
        colleagueId: colleague.id,
        amount: 100.0,
        date: new Date('2024-01-15'),
        paymentType: 'PAYME',
        isApproved: true,
      },
    });

    // Mock admin auth
    vi.mocked(requireAdminFromCookie).mockResolvedValue({
      isAdmin: true,
      permissions: ['admin'],
      username: 'Admin',
    });

    // Call handler with plain object (JSON inputValidator)
    const result = await deletePayment({
      data: { id: payment.id, token: 'admin-token' },
    });

    // Verify result
    expect(result).toEqual({ success: true, deletedPaymentId: payment.id });

    // Verify payment no longer in DB
    const deletedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
    });
    expect(deletedPayment).toBeNull();

    // Verify mocks
    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });

  itIfEnabled('applyUnusedFundsToExpense handler applies funds to participant', async () => {
    // Create prerequisite data
    const restaurant = await prisma.restaurant.create({
      data: { name: 'Test Restaurant' },
    });

    const colleague = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

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

    // Create an approved payment with unapplied funds (prepayment)
    await prisma.payment.create({
      data: {
        colleagueId: colleague.id,
        amount: 100.0,
        date: new Date('2024-01-10'),
        paymentType: 'CASH',
        isApproved: true,
      },
    });

    // Mock admin auth
    vi.mocked(requireAdminFromCookie).mockResolvedValue({
      isAdmin: true,
      permissions: ['admin'],
      username: 'Admin',
    });

    // Call handler
    const result = await applyUnusedFundsToExpense({
      data: { participantId: participant.id, token: 'admin-token' },
    });

    // Verify result
    expect(result.success).toBe(true);
    expect(result.appliedAmount).toBeGreaterThan(0);
    expect(result.colleagueName).toBe('Alice');

    // Verify payment application was created
    const applications = await prisma.paymentApplication.findMany({
      where: { participantId: participant.id },
    });
    expect(applications.length).toBeGreaterThan(0);

    // Verify mocks
    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });
});
