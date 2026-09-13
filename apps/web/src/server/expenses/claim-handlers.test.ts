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
  requireAuthFromCookie: vi.fn(),
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
const { claimPayment, approvePaymentClaim, undoClaim } = await import('./mutations');
const { requireAdminFromCookie, requireAuthFromCookie } = await import(
  '@/server/infrastructure/auth/auth-cookie'
);
const { deleteFromStorage } = await import('@/server/infrastructure/storage');

describe('Claim Handlers (Integration)', () => {
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

  itIfEnabled('claimPayment creates a claim payment for participant', async () => {
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
          create: [{ colleagueId: colleague.id, amount: 50.0 }],
        },
      },
      include: { participants: true },
    });

    const participant = expense.participants[0];
    if (!participant) throw new Error('Expected participant to exist');

    // Build FormData
    const formData = new FormData();
    formData.append('participantId', String(participant.id));
    formData.append('paymentMethod', 'PAYME');

    // Mock authenticated colleague identity (claimPayment requires auth)
    vi.mocked(requireAuthFromCookie).mockResolvedValue({
      isAdmin: false,
      permissions: ['view'],
      accessCodeId: 1,
    });

    // Call handler
    const result = await claimPayment({ data: formData });

    // Verify result shape
    expect(result).toBeDefined();
    if (typeof result !== 'object' || result === null) {
      throw new Error('Expected result to be an object');
    }
    expect('success' in result && result.success).toBe(true);
    expect('participant' in result && result.participant).toBeDefined();
    expect('payment' in result && result.payment).toBeDefined();

    // Verify DB payment record created for the participant's expense
    const payments = await prisma.payment.findMany({
      where: { expenseId: expense.id },
    });
    expect(payments).toHaveLength(1);

    const payment = payments[0];
    if (!payment) throw new Error('Expected payment to exist');

    expect(payment.colleagueId).toBe(colleague.id);
    expect(payment.isApproved).toBe(false);
    expect(payment.createdBy).toBe('COLLEAGUE_CLAIM');
    expect(payment.paymentType).toBe('PAYME');
    expect(requireAuthFromCookie).toHaveBeenCalledTimes(1);
  });

  itIfEnabled('approvePaymentClaim approves a pending claim', async () => {
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
          create: [{ colleagueId: colleague.id, amount: 50.0 }],
        },
      },
      include: { participants: true },
    });

    const participant = expense.participants[0];
    if (!participant) throw new Error('Expected participant to exist');

    // Create a pending payment for the participant
    await prisma.payment.create({
      data: {
        colleagueId: colleague.id,
        amount: 50.0,
        date: new Date(),
        paymentType: 'PAYME',
        restaurantId: restaurant.id,
        expenseId: expense.id,
        isApproved: false,
        submittedAt: new Date(),
        createdBy: 'COLLEAGUE_CLAIM',
      },
    });

    // Mock admin auth
    vi.mocked(requireAdminFromCookie).mockResolvedValue({
      isAdmin: true,
      permissions: ['admin'],
      username: 'Admin',
    });

    // Call handler
    const result = await approvePaymentClaim({
      data: { participantId: participant.id, token: 'admin-token' },
    });

    // Verify result shape
    expect(result).toBeDefined();
    if (typeof result !== 'object' || result === null) {
      throw new Error('Expected result to be an object');
    }
    expect('success' in result && result.success).toBe(true);

    // Verify participant status updated — payment should now be approved
    const payments = await prisma.payment.findMany({
      where: { expenseId: expense.id, colleagueId: colleague.id },
    });
    expect(payments).toHaveLength(1);

    const payment = payments[0];
    if (!payment) throw new Error('Expected payment to exist');
    expect(payment.isApproved).toBe(true);

    // Verify payment application was created
    const applications = await prisma.paymentApplication.findMany({
      where: { participantId: participant.id },
    });
    expect(applications).toHaveLength(1);

    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });

  itIfEnabled('undoClaim reverts a pending claim', async () => {
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
          create: [{ colleagueId: colleague.id, amount: 50.0 }],
        },
      },
      include: { participants: true },
    });

    const participant = expense.participants[0];
    if (!participant) throw new Error('Expected participant to exist');

    // Create a pending payment
    const pendingPayment = await prisma.payment.create({
      data: {
        colleagueId: colleague.id,
        amount: 50.0,
        date: new Date(),
        paymentType: 'PAYME',
        restaurantId: restaurant.id,
        expenseId: expense.id,
        isApproved: false,
        submittedAt: new Date(),
        createdBy: 'COLLEAGUE_CLAIM',
        paymentProofBucket: 'proofs-bucket',
        paymentProofObjectKey: 'proofs/key.jpg',
      },
    });

    // Mock admin auth
    vi.mocked(requireAdminFromCookie).mockResolvedValue({
      isAdmin: true,
      permissions: ['admin'],
      username: 'Admin',
    });

    // Call handler
    const result = await undoClaim({
      data: { participantId: participant.id, type: 'PENDING', token: 'admin-token' },
    });

    // Verify result shape
    expect(result).toBeDefined();
    if (typeof result !== 'object' || result === null) {
      throw new Error('Expected result to be an object');
    }
    expect('success' in result && result.success).toBe(true);

    // Verify payment removed
    const deletedPayment = await prisma.payment.findUnique({
      where: { id: pendingPayment.id },
    });
    expect(deletedPayment).toBeNull();

    // Verify MinIO proofs deleted after transaction for pending claims
    expect(deleteFromStorage).toHaveBeenCalledWith('proofs-bucket', 'proofs/key.jpg');

    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });

  itIfEnabled('undoClaim reverts an approved claim', async () => {
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
          create: [{ colleagueId: colleague.id, amount: 50.0 }],
        },
      },
      include: { participants: true },
    });

    const participant = expense.participants[0];
    if (!participant) throw new Error('Expected participant to exist');

    // Create payment and approve it
    const payment = await prisma.payment.create({
      data: {
        colleagueId: colleague.id,
        amount: 50.0,
        date: new Date(),
        paymentType: 'PAYME',
        restaurantId: restaurant.id,
        expenseId: expense.id,
        isApproved: true,
        submittedAt: new Date(),
        createdBy: 'COLLEAGUE_CLAIM',
      },
    });

    await prisma.paymentApplication.create({
      data: {
        paymentId: payment.id,
        expenseId: expense.id,
        participantId: participant.id,
        amount: 50.0,
        appliedAt: new Date(),
      },
    });

    // Mock admin auth
    vi.mocked(requireAdminFromCookie).mockResolvedValue({
      isAdmin: true,
      permissions: ['admin'],
      username: 'Admin',
    });

    // Call handler
    const result = await undoClaim({
      data: { participantId: participant.id, type: 'APPROVED', token: 'admin-token' },
    });

    // Verify result shape
    expect(result).toBeDefined();
    if (typeof result !== 'object' || result === null) {
      throw new Error('Expected result to be an object');
    }
    expect('success' in result && result.success).toBe(true);

    // Verify payment reverted — should be unapproved and application deleted
    const revertedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
    });
    if (!revertedPayment) throw new Error('Expected payment to still exist');
    expect(revertedPayment.isApproved).toBe(false);

    const applications = await prisma.paymentApplication.findMany({
      where: { participantId: participant.id },
    });
    expect(applications).toHaveLength(0);

    // Verify no MinIO cleanup for approved claims
    expect(deleteFromStorage).not.toHaveBeenCalled();

    expect(requireAdminFromCookie).toHaveBeenCalledTimes(1);
  });
});
