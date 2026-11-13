import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';
import { AppError, ErrorCode } from '@/utils/errors';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
  requireAdminFromCookie: vi.fn(),
  requireAuthFromCookie: vi.fn(),
}));

// Admin payload returned by requireAdminFromCookie when the cookie resolves an
// admin session. Handlers trust this (the real check lives in the cookie util).
const adminPayload = { isAdmin: true, permissions: ['view', 'create', 'edit', 'delete'] };

const itIfEnabled = process.env.RUN_INTEGRATION_TESTS ? it : it.skip;

describe('Colleague Handlers (Integration)', () => {
  let prisma: PrismaClient;
  let createColleague: (ctx: { data: unknown }) => Promise<unknown>;
  let updateColleague: (ctx: { data: unknown }) => Promise<unknown>;
  let deleteColleague: (ctx: { data: unknown }) => Promise<unknown>;
  let restoreColleague: (ctx: { data: unknown }) => Promise<unknown>;
  let getColleagueById: (ctx: { data: unknown }) => Promise<unknown>;

  beforeAll(async () => {
    if (!process.env.RUN_INTEGRATION_TESTS) {
      return;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL must be set to run integration tests.');
    }
    // This Prisma config requires a driver adapter (see src/server/infrastructure/prisma).
    prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

    await prisma.paymentApplication.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.expenseItem.deleteMany();
    await prisma.expenseParticipant.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.colleague.deleteMany();
    await prisma.restaurant.deleteMany();

    const colleagues = await import('./handlers');
    createColleague = colleagues.createColleague as (ctx: { data: unknown }) => Promise<unknown>;
    updateColleague = colleagues.updateColleague as (ctx: { data: unknown }) => Promise<unknown>;
    deleteColleague = colleagues.deleteColleague as (ctx: { data: unknown }) => Promise<unknown>;
    restoreColleague = colleagues.restoreColleague as (ctx: { data: unknown }) => Promise<unknown>;
    getColleagueById = colleagues.getColleagueById as (ctx: { data: unknown }) => Promise<unknown>;
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

  itIfEnabled('createColleague handler creates a colleague in DB', async () => {
    const { requireAdminFromCookie } = await import('@/server/infrastructure/auth/auth-cookie');
    vi.mocked(requireAdminFromCookie).mockResolvedValue(adminPayload);

    const result = await createColleague({ data: { name: 'Alice' } });

    expect(result).toEqual(expect.objectContaining({ name: 'Alice' }));

    const colleague = await prisma.colleague.findFirst({
      where: { name: 'Alice' },
    });
    expect(colleague).not.toBeNull();
    expect(colleague?.name).toBe('Alice');
  });

  itIfEnabled('createColleague handler rejects non-admin', async () => {
    const { requireAdminFromCookie } = await import('@/server/infrastructure/auth/auth-cookie');
    // The real requireAdminFromCookie throws AUTH_ADMIN_REQUIRED when the
    // resolved session is not an admin; the handler propagates it.
    vi.mocked(requireAdminFromCookie).mockRejectedValue(
      new AppError(ErrorCode.AUTH_ADMIN_REQUIRED, 'Admin access required')
    );

    await expect(createColleague({ data: { name: 'Alice' } })).rejects.toThrow(
      'Admin access required'
    );
  });

  itIfEnabled('updateColleague handler updates a colleague in DB', async () => {
    const { requireAdminFromCookie } = await import('@/server/infrastructure/auth/auth-cookie');
    vi.mocked(requireAdminFromCookie).mockResolvedValue(adminPayload);

    const created = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

    const result = await updateColleague({
      data: { id: created.id, name: 'Alice Updated' },
    });

    expect(result).toEqual(expect.objectContaining({ name: 'Alice Updated' }));

    const updated = await prisma.colleague.findUnique({
      where: { id: created.id },
    });
    expect(updated?.name).toBe('Alice Updated');
  });

  itIfEnabled('deleteColleague handler soft-deletes a colleague', async () => {
    const { requireAdminFromCookie } = await import('@/server/infrastructure/auth/auth-cookie');
    vi.mocked(requireAdminFromCookie).mockResolvedValue(adminPayload);

    const created = await prisma.colleague.create({
      data: { name: 'Alice' },
    });
    expect(created.deletedAt).toBeNull();

    const result = await deleteColleague({
      data: { id: created.id },
    });

    expect(result).toEqual(expect.objectContaining({ id: created.id }));

    const deleted = await prisma.colleague.findUnique({
      where: { id: created.id },
    });
    expect(deleted?.deletedAt).not.toBeNull();
  });

  itIfEnabled('restoreColleague handler restores a soft-deleted colleague', async () => {
    const { requireAdminFromCookie } = await import('@/server/infrastructure/auth/auth-cookie');
    vi.mocked(requireAdminFromCookie).mockResolvedValue({
      isAdmin: true,
      permissions: [],
    });

    const created = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

    await prisma.colleague.update({
      where: { id: created.id },
      data: { deletedAt: new Date() },
    });

    const beforeRestore = await prisma.colleague.findUnique({
      where: { id: created.id },
    });
    expect(beforeRestore?.deletedAt).not.toBeNull();

    const result = await restoreColleague({
      data: { id: created.id, token: 'admin-token' },
    });

    expect(result).toEqual(expect.objectContaining({ id: created.id, name: 'Alice' }));

    const restored = await prisma.colleague.findUnique({
      where: { id: created.id },
    });
    expect(restored?.deletedAt).toBeNull();
  });

  itIfEnabled('getColleagueById returns colleague with relations', async () => {
    const { requireAuthFromCookie } = await import('@/server/infrastructure/auth/auth-cookie');
    vi.mocked(requireAuthFromCookie).mockResolvedValue({
      isAdmin: false,
      permissions: [],
    });

    const restaurant = await prisma.restaurant.create({
      data: { name: 'Test Restaurant' },
    });

    const colleague = await prisma.colleague.create({
      data: { name: 'Alice' },
    });

    await prisma.expense.create({
      data: {
        date: new Date(),
        amount: 100,
        splitType: 'EQUAL',
        restaurantId: restaurant.id,
        participants: {
          create: [{ colleagueId: colleague.id, amount: 100 }],
        },
      },
    });

    const result = await getColleagueById({ data: { id: colleague.id } });

    expect(result).toEqual(expect.objectContaining({ name: 'Alice' }));
  });
});
