import { faker } from '@faker-js/faker';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

// Production guard — seeding plants shared access codes and fake data, so a
// re-seeded production database is a credential-planting incident, not a
// convenience. Refuse unless the operator explicitly asks for it.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
if (IS_PRODUCTION && process.env.SEED_ON_START !== 'true') {
  process.stderr.write(
    'SEED REFUSED: NODE_ENV=production. Seeding plants shared access codes and demo data. ' +
      'Set SEED_ON_START=true to run it anyway.\n'
  );
  process.exit(1);
}

// Create adapter from DATABASE_URL (required for Prisma v7)
function getAdapter(databaseUrl: string): PrismaPg {
  return new PrismaPg(databaseUrl);
}

const prisma = new PrismaClient({
  adapter: getAdapter(process.env.DATABASE_URL || 'postgresql://localhost:5432/debtmaster'),
});

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  colleagues: 12,
  restaurants: 18,
  expenses: 80,
  payments: 50,
};

// =============================================================================
// HELPERS
// =============================================================================

function d(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function randInt(min: number, max: number): number {
  return faker.number.int({ min, max });
}

function randBool(probability = 0.5): boolean {
  return Math.random() < probability;
}

function randPick<T>(arr: T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randSample<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function divideEqual(total: number, parts: number): number[] {
  const base = Math.floor((total / parts) * 100) / 100;
  const amounts = Array(parts).fill(base);
  const diff = +(total - amounts.reduce((a, b) => a + b, 0)).toFixed(2);
  if (diff !== 0) amounts[0] = +(amounts[0] + diff).toFixed(2);
  return amounts;
}

// =============================================================================
// SEEDERS
// =============================================================================

async function seedAccessCode(): Promise<void> {
  // 'admin123' fallback is dev/test-only. Production seeding must come from an
  // explicit TEST_ADMIN_ACCESS_CODE — a guessable default admin code in any
  // production-reachable path is a privilege-escalation vector.
  const adminCode = process.env.TEST_ADMIN_ACCESS_CODE || (IS_PRODUCTION ? null : 'admin123');

  if (adminCode) {
    // Seed admin access code from .env (for E2E tests)
    const existingAdmin = await prisma.accessCode.findFirst({
      where: { code: adminCode },
    });

    if (!existingAdmin) {
      await prisma.accessCode.create({
        data: { code: adminCode, isActive: true },
      });
    }
  } else {
    process.stderr.write('TEST_ADMIN_ACCESS_CODE not set — skipping admin access code seed.\n');
  }

  // Seed regular colleague access code
  const existingColleague = await prisma.accessCode.findFirst({
    where: { code: 'JUDebt123!~' },
  });

  if (!existingColleague) {
    await prisma.accessCode.create({
      data: { code: 'JUDebt123!~', isActive: true },
    });
  }
}

async function seedColleagues(): Promise<number[]> {
  const existing = await prisma.colleague.count();
  if (existing > 0) {
    const all = await prisma.colleague.findMany({ select: { id: true } });
    return all.map((c) => c.id);
  }

  const names = Array.from({ length: CONFIG.colleagues }, () => faker.person.fullName());
  const data = names.map((name) => ({ name }));

  await prisma.colleague.createMany({ data });
  const created = await prisma.colleague.findMany({ select: { id: true } });
  return created.map((c) => c.id);
}

async function seedRestaurants(): Promise<number[]> {
  const existing = await prisma.restaurant.count();
  if (existing > 0) {
    const all = await prisma.restaurant.findMany({ select: { id: true } });
    return all.map((r) => r.id);
  }

  const cuisineTypes = [
    'Italian',
    'Chinese',
    'Japanese',
    'Mexican',
    'Indian',
    'Thai',
    'Korean',
    'Vietnamese',
    'American',
    'French',
    'Mediterranean',
  ];

  const data = Array.from({ length: CONFIG.restaurants }, () => ({
    name: `${faker.company.name()} ${randPick(cuisineTypes)}`,
    address: randBool(0.7) ? faker.location.streetAddress() : null,
  }));

  await prisma.restaurant.createMany({ data });
  const created = await prisma.restaurant.findMany({ select: { id: true } });
  return created.map((r) => r.id);
}

async function seedExpenses(colleagueIds: number[], restaurantIds: number[]): Promise<number[]> {
  const existing = await prisma.expense.count();
  if (existing > 0) {
    const all = await prisma.expense.findMany({ select: { id: true } });
    return all.map((e) => e.id);
  }

  const expenseIds: number[] = [];

  for (let i = 0; i < CONFIG.expenses; i++) {
    const date = faker.date.between({ from: '2024-01-01', to: new Date() });
    const restaurantId = randPick(restaurantIds);
    if (restaurantId === undefined) continue;
    const amount = randInt(80, 600);
    const participantCount = randInt(2, Math.min(6, colleagueIds.length));
    const participants = randSample(colleagueIds, participantCount);
    const splitType = randBool(0.6) ? 'EQUAL' : 'ITEMIZED';
    const hasReceipt = randBool(0.3);

    const expense = await prisma.expense.create({
      data: {
        date,
        restaurantId,
        amount: d(amount),
        splitType,
        notes: randBool(0.4) ? faker.lorem.sentence() : null,
        receiptBucket: hasReceipt ? 'receipts' : null,
        receiptObjectKey: hasReceipt ? `receipt-${faker.string.uuid()}.jpg` : null,
        createdBy: 'seed',
      },
    });

    if (splitType === 'EQUAL') {
      const amounts = divideEqual(amount, participants.length);
      await prisma.expenseParticipant.createMany({
        data: participants.map((colleagueId, idx) => {
          const amt = amounts[idx];
          if (amt === undefined) throw new Error(`No amount found for index ${idx}`);
          return {
            expenseId: expense.id,
            colleagueId,
            amount: d(amt),
          };
        }),
      });
    } else {
      // ITEMIZED: create items and participant records
      let remaining = amount;
      const itemData: {
        name: string;
        price: Prisma.Decimal;
        colleagueId: number;
        expenseId: number;
      }[] = [];

      for (let p = 0; p < participants.length; p++) {
        const isLast = p === participants.length - 1;
        const itemPrice = isLast ? remaining : randInt(20, Math.max(25, Math.floor(remaining / 2)));
        remaining -= itemPrice;
        const participantId = participants[p];
        if (participantId === undefined) throw new Error(`No participant found for index ${p}`);
        itemData.push({
          name: faker.commerce.productName(),
          price: d(itemPrice),
          colleagueId: participantId,
          expenseId: expense.id,
        });
      }

      await prisma.expenseItem.createMany({ data: itemData });

      // Sum per colleague for participants
      const perColleague = itemData.reduce<Record<number, number>>((acc, item) => {
        acc[item.colleagueId] = (acc[item.colleagueId] || 0) + Number(item.price);
        return acc;
      }, {});

      await prisma.expenseParticipant.createMany({
        data: Object.entries(perColleague).map(([colleagueId, amt]) => ({
          expenseId: expense.id,
          colleagueId: Number(colleagueId),
          amount: d(amt),
        })),
      });
    }

    expenseIds.push(expense.id);
  }
  return expenseIds;
}

async function seedPayments(
  colleagueIds: number[],
  restaurantIds: number[],
  expenseIds: number[]
): Promise<void> {
  const existing = await prisma.payment.count();
  if (existing > 0) {
    return;
  }

  const paymentTypes = ['PAYME', 'FPS', 'CASH', 'OTHER'];

  // Fetch participant info for all expenses
  const expensesWithParticipants = await prisma.expense.findMany({
    where: { id: { in: expenseIds } },
    include: {
      participants: true,
    },
  });

  for (let i = 0; i < CONFIG.payments; i++) {
    const colleagueId = randPick(colleagueIds);
    if (colleagueId === undefined) continue;
    const paymentType = randPick(paymentTypes);
    if (paymentType === undefined) continue;
    const date = faker.date.between({ from: '2024-01-01', to: new Date() });
    const isApplied = randBool(0.6);
    const hasProof = randBool(0.4);

    let amount = randInt(50, 500);
    let restaurantId: number | null = null;
    let expenseId: number | null = null;
    const applications: { participantId: number; expenseId: number; amount: Prisma.Decimal }[] = [];

    if (isApplied) {
      // Pick a random expense that this colleague participated in
      const eligible = expensesWithParticipants.filter((e) =>
        e.participants.some((p) => p.colleagueId === colleagueId)
      );

      if (eligible.length > 0) {
        const target = randPick(eligible);
        if (!target) continue;
        const participant = target.participants.find((p) => p.colleagueId === colleagueId);
        if (participant) {
          restaurantId = target.restaurantId;
          expenseId = target.id;
          const owed = Number(participant.amount);
          amount = randBool(0.5)
            ? owed
            : randInt(Math.min(20, Math.floor(owed)), Math.floor(owed) + 50);
          applications.push({
            participantId: participant.id,
            expenseId: target.id,
            amount: d(Math.min(amount, owed)),
          });
        }
      }
    }

    // If no eligible expense found, make it a general prepayment
    if (!isApplied || applications.length === 0) {
      const pickedRestaurantId = randPick(restaurantIds);
      restaurantId = randBool(0.5) ? (pickedRestaurantId ?? null) : null;
      amount = randInt(100, 800);
    }

    const payment = await prisma.payment.create({
      data: {
        colleagueId,
        amount: d(amount),
        date,
        paymentType,
        restaurantId,
        expenseId,
        isApproved: randBool(0.85),
        submittedAt: date,
        paymentProofBucket: hasProof ? 'payments' : null,
        paymentProofObjectKey: hasProof ? `proof-${faker.string.uuid()}.jpg` : null,
        createdBy: 'seed',
      },
    });

    if (applications.length > 0) {
      await prisma.paymentApplication.createMany({
        data: applications.map((app) => ({
          paymentId: payment.id,
          expenseId: app.expenseId,
          participantId: app.participantId,
          amount: app.amount,
        })),
      });
    }
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  await seedAccessCode();

  const colleagueIds = await seedColleagues();
  const restaurantIds = await seedRestaurants();

  if (colleagueIds.length < 2) {
    return;
  }

  const expenseIds = await seedExpenses(colleagueIds, restaurantIds);
  await seedPayments(colleagueIds, restaurantIds, expenseIds);
}

main()
  .catch((_error) => {
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
