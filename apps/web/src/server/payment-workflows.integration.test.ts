/**
 * Payment & expense workflow integration tests (DEBTM-96).
 *
 * These run the real workflow functions against a real Postgres database inside
 * real `prisma.$transaction` blocks — the layer between mocked unit tests and
 * browser e2e. They cover the three gaps DEBTM-96 was re-scoped to close:
 *   1. Money workflows exercised end-to-end against a real DB.
 *   2. Concurrency / double-spend: two concurrent applies cannot over-apply
 *      (guarded by the colleague row-lock in src/server/utils/tx-locks.ts).
 *   3. Transaction rollback: a mid-flow failure leaves zero persisted writes.
 *
 * Gated behind RUN_INTEGRATION_TESTS so they no-op in the default unit run and
 * only execute in CI (or locally with the flag set + a dedicated test DB).
 *
 * NOTE: requires a migrated test database pointed at by DATABASE_URL. The
 * per-test `cleanDb` wipes money tables, so NEVER point this at a DB with data
 * you care about.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { approveClaimWorkflow } from '@/server/expenses/workflows/approve-claim-workflow';
import { createClaimWorkflow } from '@/server/expenses/workflows/create-claim-workflow';
import { createExpenseWorkflow } from '@/server/expenses/workflows/create-expense-workflow';
import { deleteExpenseWorkflow } from '@/server/expenses/workflows/delete-expense-workflow';
import { createServerLogger } from '@/server/infrastructure/logger';
import { applyUnusedFundsWorkflow } from '@/server/payments/workflows/apply-unused-funds-workflow';
import { createPaymentWorkflow } from '@/server/payments/workflows/create-payment-workflow';
import { serializeDecimal } from '@/server/utils/decimal';

const logger = createServerLogger('payment-workflows.integration.test', false);
const ENABLED = Boolean(process.env.RUN_INTEGRATION_TESTS);

// `prisma` is assigned in beforeAll when ENABLED; tests only run via itIfEnabled
// (also gated on ENABLED), so it is always initialized before use.
let prisma: PrismaClient;

async function cleanDb(p: PrismaClient): Promise<void> {
  // FK-safe teardown order.
  await p.paymentApplication.deleteMany();
  await p.payment.deleteMany();
  await p.expenseItem.deleteMany();
  await p.expenseParticipant.deleteMany();
  await p.expense.deleteMany();
  await p.colleague.deleteMany();
  await p.restaurant.deleteMany();
}

async function seedRestaurant(name = 'Test Restaurant') {
  return prisma.restaurant.create({ data: { name } });
}

async function seedColleague(name: string) {
  return prisma.colleague.create({ data: { name } });
}

describe('Payment & expense workflows (integration)', () => {
  beforeAll(async () => {
    if (!ENABLED) {
      logger.info('Skipping integration tests. Set RUN_INTEGRATION_TESTS=1 to enable.');
      return;
    }
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL must be set to run integration tests.');
    }
    // Use the Prisma v7 adapter path, matching the production singleton.
    prisma = new PrismaClient({ adapter: new PrismaPg(url) });
  });

  beforeEach(async () => {
    if (!ENABLED) return;
    await cleanDb(prisma);
  });

  afterAll(async () => {
    if (!ENABLED) return;
    await prisma.$disconnect();
  });

  const itIfEnabled = ENABLED ? it : it.skip;

  // 1. createExpense → balance -------------------------------------------------
  itIfEnabled('createExpenseWorkflow splits an EQUAL expense across participants', async () => {
    const restaurant = await seedRestaurant();
    const alice = await seedColleague('Alice');
    const bob = await seedColleague('Bob');

    const { expense } = await prisma.$transaction((tx) =>
      createExpenseWorkflow(tx, {
        date: '2024-01-15',
        restaurantId: restaurant.id,
        amount: 100,
        splitType: 'EQUAL',
        participantIds: [alice.id, bob.id],
      })
    );

    const totalSplit = expense.participants.reduce((sum, p) => sum + serializeDecimal(p.amount), 0);
    expect(expense.participants).toHaveLength(2);
    expect(totalSplit).toBe(100);
  });

  // 2. createPayment (prepayment) → auto-apply → settled ----------------------
  itIfEnabled('createPaymentWorkflow auto-applies a prepayment to an owed expense', async () => {
    const restaurant = await seedRestaurant();
    const carol = await seedColleague('Carol');

    const { expense } = await prisma.$transaction((tx) =>
      createExpenseWorkflow(tx, {
        date: '2024-01-15',
        restaurantId: restaurant.id,
        amount: 60,
        splitType: 'EQUAL',
        participantIds: [carol.id],
      })
    );
    const participant = expense.participants[0];
    if (!participant) throw new Error('expected one participant');

    const result = await prisma.$transaction((tx) =>
      createPaymentWorkflow(tx, {
        colleagueId: carol.id,
        amount: 60,
        date: '2024-01-16',
        paymentType: 'PAYME',
        paymentProofBucket: null,
        paymentProofObjectKey: null,
        selectedExpenseIds: [],
      })
    );

    expect(result.totalAppliedAmount).toBe(60);
    expect(result.remainingAmount).toBe(0);

    const apps = await prisma.paymentApplication.findMany({
      where: { participantId: participant.id },
    });
    expect(apps).toHaveLength(1);
    expect(serializeDecimal(apps[0]?.amount)).toBe(60);
  });

  // 3. deleteExpense → cascade ------------------------------------------------
  itIfEnabled(
    'deleteExpenseWorkflow removes participants/items/applications via cascade',
    async () => {
      const restaurant = await seedRestaurant();
      const dan = await seedColleague('Dan');

      const { expense } = await prisma.$transaction((tx) =>
        createExpenseWorkflow(tx, {
          date: '2024-01-15',
          restaurantId: restaurant.id,
          amount: 50,
          splitType: 'EQUAL',
          participantIds: [dan.id],
        })
      );
      const participant = expense.participants[0];
      if (!participant) throw new Error('expected one participant');

      const payment = await prisma.payment.create({
        data: {
          colleagueId: dan.id,
          amount: 50,
          date: new Date('2024-01-16'),
          paymentType: 'PAYME',
          isApproved: true,
        },
      });
      await prisma.paymentApplication.create({
        data: {
          paymentId: payment.id,
          expenseId: expense.id,
          participantId: participant.id,
          amount: 50,
        },
      });

      await prisma.$transaction((tx) =>
        deleteExpenseWorkflow(tx, { id: expense.id, deleteRelatedPayments: false })
      );

      expect(await prisma.expense.findUnique({ where: { id: expense.id } })).toBeNull();
      expect(
        await prisma.expenseParticipant.findMany({ where: { expenseId: expense.id } })
      ).toHaveLength(0);
      expect(
        await prisma.paymentApplication.findMany({ where: { expenseId: expense.id } })
      ).toHaveLength(0);
      // deleteRelatedPayments: false → the payment itself survives.
      expect(await prisma.payment.findUnique({ where: { id: payment.id } })).not.toBeNull();
    }
  );

  // 4. concurrency / double-spend --------------------------------------------
  itIfEnabled(
    'concurrent applyUnusedFundsWorkflow calls never over-apply (colleague lock)',
    async () => {
      const restaurant = await seedRestaurant();
      const eve = await seedColleague('Eve');

      // Two separate expenses for the same colleague → two distinct participants
      // that can each claim the same unapplied payment.
      const [expenseA, expenseB] = await Promise.all([
        prisma.$transaction((tx) =>
          createExpenseWorkflow(tx, {
            date: '2024-01-15',
            restaurantId: restaurant.id,
            amount: 100,
            splitType: 'EQUAL',
            participantIds: [eve.id],
          })
        ),
        prisma.$transaction((tx) =>
          createExpenseWorkflow(tx, {
            date: '2024-01-15',
            restaurantId: restaurant.id,
            amount: 100,
            splitType: 'EQUAL',
            participantIds: [eve.id],
          })
        ),
      ]);
      const participantA = expenseA.expense.participants[0];
      const participantB = expenseB.expense.participants[0];
      if (!participantA || !participantB) throw new Error('expected participants');

      // One approved, fully-unapplied payment that can settle only one debt.
      await prisma.payment.create({
        data: {
          colleagueId: eve.id,
          amount: 100,
          date: new Date('2024-01-16'),
          paymentType: 'PAYME',
          isApproved: true,
        },
      });

      // Two concurrent settlements against different participants of the same
      // colleague. Without the colleague lock both would read the same 100
      // unapplied balance and each apply 100 (200 total).
      await Promise.allSettled([
        prisma.$transaction((tx) =>
          applyUnusedFundsWorkflow(tx, { participantId: participantA.id })
        ),
        prisma.$transaction((tx) =>
          applyUnusedFundsWorkflow(tx, { participantId: participantB.id })
        ),
      ]);

      const apps = await prisma.paymentApplication.findMany({
        where: { participantId: { in: [participantA.id, participantB.id] } },
      });
      const totalApplied = apps.reduce((sum, a) => sum + serializeDecimal(a.amount), 0);
      // The double-spend invariant: applied can never exceed the single payment.
      expect(totalApplied).toBeLessThanOrEqual(100);
      expect(totalApplied).toBe(100);

      // Sanity: only one application row exists (the payment can only be used once).
      expect(apps).toHaveLength(1);
    }
  );

  // 5. claim → approve chain ---------------------------------------------------
  itIfEnabled('createClaimWorkflow then approveClaimWorkflow settles the participant', async () => {
    const restaurant = await seedRestaurant();
    const frank = await seedColleague('Frank');

    const { expense } = await prisma.$transaction((tx) =>
      createExpenseWorkflow(tx, {
        date: '2024-01-15',
        restaurantId: restaurant.id,
        amount: 80,
        splitType: 'EQUAL',
        participantIds: [frank.id],
      })
    );
    const participant = expense.participants[0];
    if (!participant) throw new Error('expected one participant');

    const claim = await prisma.$transaction((tx) =>
      createClaimWorkflow(tx, { participantId: participant.id })
    );
    expect(claim.payment.isApproved).toBe(false);

    const approved = await prisma.$transaction((tx) =>
      approveClaimWorkflow(tx, { participantId: participant.id })
    );
    expect(approved.totalApproved).toBe(80);

    const apps = await prisma.paymentApplication.findMany({
      where: { participantId: participant.id },
    });
    expect(apps).toHaveLength(1);
    expect(serializeDecimal(apps[0]?.amount)).toBe(80);
  });

  // 6. transaction rollback ---------------------------------------------------
  itIfEnabled(
    'a mid-flow unique violation rolls back all prior writes in the transaction',
    async () => {
      const restaurant = await seedRestaurant();
      const grace = await seedColleague('Grace');

      const { expense } = await prisma.$transaction((tx) =>
        createExpenseWorkflow(tx, {
          date: '2024-01-15',
          restaurantId: restaurant.id,
          amount: 100,
          splitType: 'EQUAL',
          participantIds: [grace.id],
        })
      );
      const participant = expense.participants[0];
      if (!participant) throw new Error('expected one participant');

      // P1 (older) has full unapplied balance; P2 already has a seeded application
      // for (P2, participant) so a second insert for that pair violates the
      // @@unique([paymentId, participantId]) constraint mid-loop.
      const p1 = await prisma.payment.create({
        data: {
          colleagueId: grace.id,
          amount: 60,
          date: new Date('2024-01-16'),
          paymentType: 'PAYME',
          isApproved: true,
        },
      });
      const p2 = await prisma.payment.create({
        data: {
          colleagueId: grace.id,
          amount: 100,
          date: new Date('2024-01-17'),
          paymentType: 'PAYME',
          isApproved: true,
        },
      });
      await prisma.paymentApplication.create({
        data: {
          paymentId: p2.id,
          expenseId: expense.id,
          participantId: participant.id,
          amount: 30,
        },
      });

      // applyUnusedFunds: remainingOwed = 100 - 30 = 70; FIFO applies from P1
      // (writes 60 — succeeds) then P2 (writes 10 — collides with the seeded row).
      // The collision aborts the transaction, so the P1 application must NOT persist.
      await expect(
        prisma.$transaction((tx) => applyUnusedFundsWorkflow(tx, { participantId: participant.id }))
      ).rejects.toThrow();

      const apps = await prisma.paymentApplication.findMany({
        where: { participantId: participant.id },
      });
      // Only the pre-seeded (P2, 30) survives — the rolled-back P1 write is gone.
      expect(apps).toHaveLength(1);
      expect(apps[0]?.paymentId).toBe(p2.id);
      expect(serializeDecimal(apps[0]?.amount)).toBe(30);
      expect(apps.find((a) => a.paymentId === p1.id)).toBeUndefined();
    }
  );
});
