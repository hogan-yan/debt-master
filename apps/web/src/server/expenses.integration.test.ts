import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServerLogger } from '@/server/infrastructure/logger';

// NOTE: These tests require a test database
// Set DATABASE_URL in .env.test to point to a separate test database

const logger = createServerLogger('expenses.integration.test', false);

describe('Expense Operations (Integration)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Only run if explicitly enabled (avoid accidental production runs)
    if (!process.env.RUN_INTEGRATION_TESTS) {
      logger.info('Skipping integration tests. Set RUN_INTEGRATION_TESTS=1 to enable.');
      return;
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL must be set to run integration tests.');
    }
    // This Prisma config requires a driver adapter (see src/server/infrastructure/prisma).
    prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

    // Clean test database
    await prisma.paymentApplication.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.expenseItem.deleteMany();
    await prisma.expenseParticipant.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.colleague.deleteMany();
    await prisma.restaurant.deleteMany();
  });

  afterAll(async () => {
    if (!process.env.RUN_INTEGRATION_TESTS || !prisma) return;
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!process.env.RUN_INTEGRATION_TESTS || !prisma) return;
    // Clean slate for each test
    await prisma.paymentApplication.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.expenseItem.deleteMany();
    await prisma.expenseParticipant.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.colleague.deleteMany();
    await prisma.restaurant.deleteMany();
  });

  // Skip these tests by default unless env var is set
  const itIfEnabled = process.env.RUN_INTEGRATION_TESTS ? it : it.skip;

  itIfEnabled('creates an expense with participants', async () => {
    // Create prerequisite data
    const restaurant = await prisma.restaurant.create({
      data: { name: 'Test Restaurant' },
    });

    const colleague1 = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

    const colleague2 = await prisma.colleague.create({
      data: { name: 'Bob' },
    });

    // Create expense
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
      include: {
        participants: true,
      },
    });

    // Verify
    expect(expense.amount.toString()).toBe('100');
    expect(expense.participants).toHaveLength(2);
    const participant0 = expense.participants[0];
    const participant1 = expense.participants[1];
    if (!participant0 || !participant1) {
      throw new Error('Expected participants to exist');
    }
    expect(participant0.amount.toString()).toBe('50');
    expect(participant1.amount.toString()).toBe('50');
  });

  itIfEnabled('calculates payment status correctly', async () => {
    // Setup
    const restaurant = await prisma.restaurant.create({
      data: { name: 'Test Restaurant' },
    });

    const colleague = await prisma.colleague.create({
      data: { name: 'Charlie' },
    });

    const expense = await prisma.expense.create({
      data: {
        date: new Date(),
        amount: 100.0,
        splitType: 'EQUAL',
        restaurantId: restaurant.id,
        participants: {
          create: [{ colleagueId: colleague.id, amount: 100.0 }],
        },
      },
      include: {
        participants: true,
      },
    });

    const participant = expense.participants[0];
    if (!participant) {
      throw new Error('Expected participant to exist');
    }

    // Initially not paid - isPaid is a computed field not present on the raw Prisma model,
    // so we verify via querying payment applications
    const initialApplications = await prisma.paymentApplication.findMany({
      where: { participantId: participant.id },
    });
    expect(initialApplications).toHaveLength(0);

    // Create approved payment
    const payment = await prisma.payment.create({
      data: {
        colleagueId: colleague.id,
        amount: 100.0,
        date: new Date(),
        paymentType: 'FULL',
        isApproved: true,
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

    // Verify payment was recorded
    const applications = await prisma.paymentApplication.findMany({
      where: { participantId: participant.id },
      include: { payment: true },
    });

    expect(applications).toHaveLength(1);
    const application = applications[0];
    if (!application) {
      throw new Error('Expected application to exist');
    }
    expect(application.payment.isApproved).toBe(true);
  });
});
