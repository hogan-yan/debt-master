import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    colleague: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    restaurant: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
  requireAuthFromCookie: vi.fn(),
  requireAdminFromCookie: vi.fn(),
}));

vi.mock('../balance-calculator', () => ({
  getColleagueStatsFromCalculatedBalances: vi.fn(),
}));

vi.mock('./workflows/active-colleague-workflow', () => ({
  getActiveColleaguesWorkflow: vi.fn(),
}));

vi.mock('./workflows/create-colleague-workflow', () => ({
  createColleagueWorkflow: vi.fn(),
}));

vi.mock('./workflows/update-colleague-workflow', () => ({
  updateColleagueWorkflow: vi.fn(),
}));

vi.mock('./workflows/delete-colleague-workflow', () => ({
  deleteColleagueWorkflow: vi.fn(),
}));

vi.mock('./workflows/permanent-delete-colleague-workflow', () => ({
  permanentDeleteColleagueWorkflow: vi.fn(),
}));

vi.mock('./workflows/restore-colleague-workflow', () => ({
  restoreColleagueWorkflow: vi.fn(),
}));

vi.mock('../payments/workflows/get-unapplied-funds-workflow', () => ({
  getUnappliedFundsWorkflow: vi.fn(),
}));

import {
  getAuthFromCookie,
  requireAdminFromCookie,
  requireAuthFromCookie,
} from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { AppError, ErrorCode } from '@/utils/errors';
import { getColleagueStatsFromCalculatedBalances } from '../balance-calculator';
import { getUnappliedFundsWorkflow } from '../payments/workflows/get-unapplied-funds-workflow';
import {
  createColleague,
  deleteColleague,
  getActiveColleagues,
  getColleagueById,
  getColleagueStats,
  getColleagues,
  getColleaguesPaginated,
  getInactiveColleaguesPaginated,
  getUnappliedFundsForAllColleagues,
  permanentDeleteColleague,
  restoreColleague,
  updateColleague,
} from './handlers';
import { getActiveColleaguesWorkflow } from './workflows/active-colleague-workflow';
import { createColleagueWorkflow } from './workflows/create-colleague-workflow';
import { deleteColleagueWorkflow } from './workflows/delete-colleague-workflow';
import { permanentDeleteColleagueWorkflow } from './workflows/permanent-delete-colleague-workflow';
import { restoreColleagueWorkflow } from './workflows/restore-colleague-workflow';
import { updateColleagueWorkflow } from './workflows/update-colleague-workflow';

type ServerFn = (ctx: { data: unknown }) => Promise<unknown>;

const mockGetAuth = vi.mocked(getAuthFromCookie);
const mockRequireAuth = vi.mocked(requireAuthFromCookie);
const mockRequireAdmin = vi.mocked(requireAdminFromCookie);
const mockTransaction = vi.mocked(prisma.$transaction);
const mockColleague = vi.mocked(prisma.colleague);
const mockStatsCalc = vi.mocked(getColleagueStatsFromCalculatedBalances);
const mockActiveWorkflow = vi.mocked(getActiveColleaguesWorkflow);
const mockCreateWorkflow = vi.mocked(createColleagueWorkflow);
const mockUpdateWorkflow = vi.mocked(updateColleagueWorkflow);
const mockDeleteWorkflow = vi.mocked(deleteColleagueWorkflow);
const mockPermanentDeleteWorkflow = vi.mocked(permanentDeleteColleagueWorkflow);
const mockRestoreWorkflow = vi.mocked(restoreColleagueWorkflow);
const mockUnappliedFundsWorkflow = vi.mocked(getUnappliedFundsWorkflow);

beforeEach(() => {
  vi.resetAllMocks();
  mockTransaction.mockImplementation(async (callback) => callback(prisma));
});

describe('getColleagues', () => {
  beforeEach(() => {
    mockGetAuth.mockResolvedValue({ isAdmin: false, permissions: [] });
  });

  it('returns empty array when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null);

    const result = await (getColleagues as ServerFn)({ data: {} });

    expect(result).toEqual([]);
  });

  it('returns all active colleagues for authenticated user', async () => {
    mockColleague.findMany.mockResolvedValue([
      { id: 1, name: 'Alice', deletedAt: null },
      { id: 2, name: 'Bob', deletedAt: null },
    ] as never);

    const result = await (getColleagues as ServerFn)({ data: {} });

    expect(result).toHaveLength(2);
    expect(mockColleague.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    );
  });
});

describe('getColleaguesPaginated', () => {
  beforeEach(() => {
    mockGetAuth.mockResolvedValue({ isAdmin: false, permissions: [] });
  });

  it('returns empty paginated response when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null);

    const result = await (getColleaguesPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } });

    expect(result).toEqual(
      expect.objectContaining({
        data: [],
        pagination: expect.objectContaining({ totalCount: 0 }),
      })
    );
  });

  it('returns paginated colleagues for authenticated user', async () => {
    mockColleague.count.mockResolvedValue(2);
    mockColleague.findMany.mockResolvedValue([
      { id: 1, name: 'Alice', deletedAt: null },
      { id: 2, name: 'Bob', deletedAt: null },
    ] as never);

    const result = await (getColleaguesPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } });

    expect(result).toEqual(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 2 }),
        ]),
        pagination: expect.objectContaining({ totalCount: 2 }),
      })
    );
  });

  it('applies search filter', async () => {
    mockColleague.count.mockResolvedValue(1);
    mockColleague.findMany.mockResolvedValue([{ id: 1, name: 'Alice', deletedAt: null }] as never);

    const result = await (getColleaguesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, search: 'ali' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ name: 'Alice' })]),
      })
    );
    expect(mockColleague.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: expect.any(Object),
        }),
      })
    );
  });
});

describe('getColleagueStats', () => {
  beforeEach(() => {
    mockGetAuth.mockResolvedValue({ isAdmin: false, permissions: [] });
  });

  it('returns zeros when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null);

    const result = await (getColleagueStats as ServerFn)({ data: {} });

    expect(result).toEqual({
      totalColleagues: 0,
      totalOutstanding: 0,
      totalCredit: 0,
      totalPayments: 0,
    });
  });

  it('returns stats from calculator for authenticated user', async () => {
    mockStatsCalc.mockResolvedValue({
      totalColleagues: 5,
      totalOutstanding: 1000,
      totalCredit: 200,
      totalPayments: 800,
    });

    const result = await (getColleagueStats as ServerFn)({ data: {} });

    expect(result).toEqual({
      totalColleagues: 5,
      totalOutstanding: 1000,
      totalCredit: 200,
      totalPayments: 800,
    });
  });
});

describe('getColleagueById', () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({ isAdmin: false, permissions: [] });
  });

  it('returns serialized colleague when found', async () => {
    mockColleague.findFirst.mockResolvedValue({
      id: 1,
      name: 'Alice',
      deletedAt: null,
      expenseParticipants: [],
      payments: [],
    } as never);

    const result = await (getColleagueById as ServerFn)({ data: { id: 1 } });

    expect(result).toEqual(expect.objectContaining({ id: 1, name: 'Alice' }));
  });

  it('serializes nested Decimal amounts and missing related records', async () => {
    mockColleague.findFirst.mockResolvedValue({
      id: 1,
      name: 'Alice',
      deletedAt: null,
      expenseParticipants: [
        {
          id: 1,
          amount: new Prisma.Decimal('12.50'),
          expense: {
            id: 2,
            amount: new Prisma.Decimal('50.00'),
            restaurant: null,
          },
        },
        {
          id: 2,
          amount: new Prisma.Decimal('3.25'),
          expense: null,
        },
      ],
      payments: [{ id: 1, amount: new Prisma.Decimal('15.75') }],
    } as never);

    const result = await (getColleagueById as ServerFn)({ data: { id: 1 } });

    expect(result).toEqual(
      expect.objectContaining({
        expenseParticipants: [
          expect.objectContaining({
            amount: 12.5,
            expense: expect.objectContaining({
              amount: 50,
              restaurant: null,
            }),
          }),
          expect.objectContaining({ amount: 3.25, expense: null }),
        ],
        payments: [expect.objectContaining({ amount: 15.75 })],
      })
    );
  });

  it('throws when colleague not found', async () => {
    mockColleague.findFirst.mockResolvedValue(null);

    await expect((getColleagueById as ServerFn)({ data: { id: 999 } })).rejects.toThrow(
      'Colleague not found'
    );
  });

  it('throws when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Authentication required'));

    await expect((getColleagueById as ServerFn)({ data: { id: 1 } })).rejects.toThrow(
      'Authentication required'
    );
  });
});

describe('createColleague', () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({ isAdmin: true, permissions: [] });
  });

  it('creates colleague successfully as admin', async () => {
    mockCreateWorkflow.mockResolvedValue({ id: 3, name: 'Charlie' });

    const result = await (createColleague as ServerFn)({
      data: { name: 'Charlie' },
    });

    expect(mockCreateWorkflow).toHaveBeenCalledWith(prisma, { name: 'Charlie' });
    expect(result).toEqual({ id: 3, name: 'Charlie' });
  });

  it('rejects non-admin users', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Admin access required'));

    await expect((createColleague as ServerFn)({ data: { name: 'Charlie' } })).rejects.toThrow(
      'Admin access required'
    );
  });

  it('rejects when there is no valid session cookie', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Authentication required'));

    await expect((createColleague as ServerFn)({ data: { name: 'Charlie' } })).rejects.toThrow(
      'Authentication required'
    );
  });

  it('rejects empty name', async () => {
    await expect((createColleague as ServerFn)({ data: { name: '' } })).rejects.toThrow();
  });
});

describe('updateColleague', () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({ isAdmin: true, permissions: [] });
  });

  it('updates colleague successfully as admin', async () => {
    mockUpdateWorkflow.mockResolvedValue({ id: 1, name: 'Alice Updated' });

    const result = await (updateColleague as ServerFn)({
      data: { id: 1, name: 'Alice Updated' },
    });

    expect(mockUpdateWorkflow).toHaveBeenCalledWith(prisma, { id: 1, name: 'Alice Updated' });
    expect(result).toEqual({ id: 1, name: 'Alice Updated' });
  });

  it('updates colleague with partial data', async () => {
    mockUpdateWorkflow.mockResolvedValue({ id: 1, name: 'Alice' });

    const result = await (updateColleague as ServerFn)({ data: { id: 1 } });

    expect(mockUpdateWorkflow).toHaveBeenCalledWith(prisma, { id: 1, name: '' });
    expect(result).toEqual({ id: 1, name: 'Alice' });
  });

  it('rejects non-admin users', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Admin access required'));

    await expect((updateColleague as ServerFn)({ data: { id: 1, name: 'Alice' } })).rejects.toThrow(
      'Admin access required'
    );
  });
});

describe('deleteColleague', () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({ isAdmin: true, permissions: [] });
  });

  it('soft deletes colleague successfully as admin', async () => {
    mockDeleteWorkflow.mockResolvedValue({ id: 1, name: 'Alice', deletedAt: new Date() });

    const result = await (deleteColleague as ServerFn)({ data: { id: 1 } });

    expect(mockDeleteWorkflow).toHaveBeenCalledWith(prisma, { id: 1 });
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('rejects non-admin users', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Admin access required'));

    await expect((deleteColleague as ServerFn)({ data: { id: 1 } })).rejects.toThrow(
      'Admin access required'
    );
  });
});

describe('getUnappliedFundsForAllColleagues', () => {
  beforeEach(() => {
    mockGetAuth.mockResolvedValue({ isAdmin: false, permissions: [] });
  });

  it('returns empty object when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null);

    const result = await (getUnappliedFundsForAllColleagues as ServerFn)({ data: {} });

    expect(result).toEqual({});
  });

  it('returns unapplied funds map for authenticated user', async () => {
    mockUnappliedFundsWorkflow.mockResolvedValue({
      unappliedFunds: { 1: 50, 2: 30 },
    });

    const result = await (getUnappliedFundsForAllColleagues as ServerFn)({ data: {} });

    expect(result).toEqual({ 1: 50, 2: 30 });
    expect(mockUnappliedFundsWorkflow).toHaveBeenCalledWith(prisma);
  });
});

describe('getActiveColleagues', () => {
  beforeEach(() => {
    mockGetAuth.mockResolvedValue({ isAdmin: false, permissions: [] });
  });

  it('returns empty array when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null);

    const result = await (getActiveColleagues as ServerFn)({ data: {} });

    expect(result).toEqual([]);
  });

  it('returns active colleagues for authenticated user', async () => {
    mockActiveWorkflow.mockResolvedValue([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ] as never);

    const result = await (getActiveColleagues as ServerFn)({ data: {} });

    expect(result).toHaveLength(2);
    expect(mockActiveWorkflow).toHaveBeenCalledWith(prisma);
  });
});

describe('getInactiveColleaguesPaginated', () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({ isAdmin: true, permissions: [] });
  });

  it('returns paginated inactive colleagues for admin', async () => {
    mockColleague.count.mockResolvedValue(1);
    mockColleague.findMany.mockResolvedValue([
      { id: 1, name: 'Old Alice', deletedAt: new Date() },
    ] as never);

    const result = await (getInactiveColleaguesPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, token: 'token' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        pagination: expect.objectContaining({ totalCount: 1 }),
        data: expect.arrayContaining([expect.objectContaining({ name: 'Old Alice' })]),
      })
    );
  });

  it('rejects non-admin users', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Admin access required'));

    await expect(
      (getInactiveColleaguesPaginated as ServerFn)({
        data: { page: 1, pageSize: 10, token: 'token' },
      })
    ).rejects.toThrow('Admin access required');
  });
});

describe('restoreColleague', () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({ isAdmin: true, permissions: [] });
  });

  it('restores soft-deleted colleague as admin', async () => {
    mockRestoreWorkflow.mockResolvedValue({ id: 1, name: 'Alice' });

    const result = await (restoreColleague as ServerFn)({ data: { id: 1, token: 'token' } });

    expect(mockRestoreWorkflow).toHaveBeenCalledWith(prisma, { id: 1 });
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('rejects non-admin users', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Admin access required'));

    await expect(
      (restoreColleague as ServerFn)({ data: { id: 1, token: 'token' } })
    ).rejects.toThrow('Admin access required');
  });
});

describe('permanentDeleteColleague', () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({ isAdmin: true, permissions: [] });
  });

  it('permanently deletes colleague as admin', async () => {
    mockPermanentDeleteWorkflow.mockResolvedValue({ id: 1, name: 'Charlie' });

    const result = await (permanentDeleteColleague as ServerFn)({
      data: { id: 1, token: 'token' },
    });

    expect(mockPermanentDeleteWorkflow).toHaveBeenCalledWith(prisma, { id: 1 });
    expect(result).toEqual({ id: 1, name: 'Charlie' });
  });

  it('rejects non-admin users', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Admin access required'));

    await expect(
      (permanentDeleteColleague as ServerFn)({ data: { id: 1, token: 'token' } })
    ).rejects.toThrow('Admin access required');
  });
});

// Error path tests — exercise isAppError branches and generic error wrapping
describe('error handling paths', () => {
  describe('getColleagues error paths', () => {
    beforeEach(() => {
      mockGetAuth.mockResolvedValue({ isAdmin: false, permissions: [] });
    });

    it('rethrows AppError as-is', async () => {
      const appErr = new AppError(ErrorCode.NOT_FOUND_COLLEAGUE, 'test');
      mockColleague.findMany.mockRejectedValue(appErr);

      await expect((getColleagues as ServerFn)({ data: {} })).rejects.toBe(appErr);
    });

    it('wraps generic error as INFRASTRUCTURE_ERROR', async () => {
      mockColleague.findMany.mockRejectedValue(new Error('db down'));

      await expect((getColleagues as ServerFn)({ data: {} })).rejects.toThrow(
        'Failed to fetch colleagues'
      );
    });
  });

  describe('getColleaguesPaginated error paths', () => {
    beforeEach(() => {
      mockGetAuth.mockResolvedValue({ isAdmin: false, permissions: [] });
    });

    it('rethrows AppError as-is', async () => {
      const appErr = new AppError(ErrorCode.NOT_FOUND_COLLEAGUE, 'test');
      mockColleague.count.mockRejectedValue(appErr);

      await expect(
        (getColleaguesPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } })
      ).rejects.toBe(appErr);
    });

    it('wraps generic error as INFRASTRUCTURE_ERROR', async () => {
      mockColleague.count.mockRejectedValue(new Error('db down'));

      await expect(
        (getColleaguesPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } })
      ).rejects.toThrow('Failed to fetch paginated colleagues');
    });
  });

  describe('getColleagueStats error paths', () => {
    beforeEach(() => {
      mockGetAuth.mockResolvedValue({ isAdmin: false, permissions: [] });
    });

    it('rethrows AppError as-is', async () => {
      const appErr = new AppError(ErrorCode.NOT_FOUND_COLLEAGUE, 'test');
      mockStatsCalc.mockRejectedValue(appErr);

      await expect((getColleagueStats as ServerFn)({ data: { id: 1 } })).rejects.toBe(appErr);
    });

    it('wraps generic error as INFRASTRUCTURE_ERROR', async () => {
      mockStatsCalc.mockRejectedValue(new Error('calc failed'));

      await expect((getColleagueStats as ServerFn)({ data: { id: 1 } })).rejects.toThrow(
        'Failed to fetch colleague stats'
      );
    });
  });

  describe('getColleagueById error paths', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ isAdmin: false, permissions: [] });
    });

    it('rethrows AppError as-is', async () => {
      const appErr = new AppError(ErrorCode.NOT_FOUND_COLLEAGUE, 'test');
      mockColleague.findFirst.mockRejectedValue(appErr);

      await expect((getColleagueById as ServerFn)({ data: { id: 1 } })).rejects.toBe(appErr);
    });

    it('wraps generic error as INFRASTRUCTURE_ERROR', async () => {
      mockColleague.findFirst.mockRejectedValue(new Error('db down'));

      await expect((getColleagueById as ServerFn)({ data: { id: 1 } })).rejects.toThrow(
        'Failed to fetch colleague'
      );
    });
  });

  describe('createColleague error paths', () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ isAdmin: true, permissions: [] });
    });

    it('rethrows AppError as-is', async () => {
      const appErr = new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'test');
      mockCreateWorkflow.mockRejectedValue(appErr);

      await expect((createColleague as ServerFn)({ data: { name: 'X' } })).rejects.toBe(appErr);
    });

    it('wraps generic error as INFRASTRUCTURE_ERROR', async () => {
      mockCreateWorkflow.mockRejectedValue(new Error('tx failed'));

      await expect((createColleague as ServerFn)({ data: { name: 'X' } })).rejects.toThrow(
        'Failed to create colleague'
      );
    });
  });

  describe('updateColleague error paths', () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ isAdmin: true, permissions: [] });
    });

    it('rethrows AppError as-is', async () => {
      const appErr = new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'test');
      mockUpdateWorkflow.mockRejectedValue(appErr);

      await expect((updateColleague as ServerFn)({ data: { id: 1, name: 'X' } })).rejects.toBe(
        appErr
      );
    });

    it('wraps generic error as INFRASTRUCTURE_ERROR', async () => {
      mockUpdateWorkflow.mockRejectedValue(new Error('tx failed'));

      await expect((updateColleague as ServerFn)({ data: { id: 1, name: 'X' } })).rejects.toThrow(
        'Failed to update colleague'
      );
    });
  });

  describe('deleteColleague error paths', () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ isAdmin: true, permissions: [] });
    });

    it('rethrows AppError as-is', async () => {
      const appErr = new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'test');
      mockDeleteWorkflow.mockRejectedValue(appErr);

      await expect((deleteColleague as ServerFn)({ data: { id: 1 } })).rejects.toBe(appErr);
    });

    it('wraps generic error as INFRASTRUCTURE_ERROR', async () => {
      mockDeleteWorkflow.mockRejectedValue(new Error('tx failed'));

      await expect((deleteColleague as ServerFn)({ data: { id: 1 } })).rejects.toThrow(
        'Failed to delete colleague'
      );
    });
  });

  describe('getActiveColleagues error paths', () => {
    beforeEach(() => {
      mockGetAuth.mockResolvedValue({ isAdmin: false, permissions: [] });
    });

    it('rethrows AppError as-is', async () => {
      const appErr = new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'test');
      mockActiveWorkflow.mockRejectedValue(appErr);

      await expect((getActiveColleagues as ServerFn)({ data: {} })).rejects.toBe(appErr);
    });

    it('wraps generic error as INFRASTRUCTURE_ERROR', async () => {
      mockActiveWorkflow.mockRejectedValue(new Error('db down'));

      await expect((getActiveColleagues as ServerFn)({ data: {} })).rejects.toThrow(
        'Failed to fetch active colleagues'
      );
    });
  });

  describe('getInactiveColleaguesPaginated error paths', () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ isAdmin: true, permissions: [] });
    });

    it('rethrows AppError as-is', async () => {
      const appErr = new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'test');
      mockColleague.count.mockRejectedValue(appErr);

      await expect(
        (getInactiveColleaguesPaginated as ServerFn)({
          data: { page: 1, pageSize: 10, token: 'token' },
        })
      ).rejects.toBe(appErr);
    });

    it('wraps generic error as INFRASTRUCTURE_ERROR', async () => {
      mockColleague.count.mockRejectedValue(new Error('db down'));

      await expect(
        (getInactiveColleaguesPaginated as ServerFn)({
          data: { page: 1, pageSize: 10, token: 'token' },
        })
      ).rejects.toThrow('Failed to fetch inactive colleagues');
    });
  });

  describe('restoreColleague error paths', () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ isAdmin: true, permissions: [] });
    });

    it('rethrows AppError as-is', async () => {
      const appErr = new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'test');
      mockRestoreWorkflow.mockRejectedValue(appErr);

      await expect(
        (restoreColleague as ServerFn)({ data: { id: 1, token: 'token' } })
      ).rejects.toBe(appErr);
    });

    it('wraps generic error as INFRASTRUCTURE_ERROR', async () => {
      mockRestoreWorkflow.mockRejectedValue(new Error('tx failed'));

      await expect(
        (restoreColleague as ServerFn)({ data: { id: 1, token: 'token' } })
      ).rejects.toThrow('Failed to restore colleague');
    });
  });
});
