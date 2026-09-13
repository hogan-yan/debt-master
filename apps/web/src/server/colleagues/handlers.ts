import { Prisma } from '@prisma/client';
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import {
  getAuthFromCookie,
  requireAdminFromCookie,
  requireAuthFromCookie,
} from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { serializeDecimal } from '@/server/utils/decimal';
import { sanitizeSearchInput } from '@/server/utils/search-sanitization';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';
import { getUnappliedFundsWorkflow } from '../payments/workflows/get-unapplied-funds-workflow';
import { createEmptyPaginatedResponse, createPaginatedResponse } from '../utils/pagination';
import { getActiveColleaguesWorkflow } from './workflows/active-colleague-workflow';
import { createColleagueWorkflow } from './workflows/create-colleague-workflow';
import { deleteColleagueWorkflow } from './workflows/delete-colleague-workflow';
import { permanentDeleteColleagueWorkflow } from './workflows/permanent-delete-colleague-workflow';
import { restoreColleagueWorkflow } from './workflows/restore-colleague-workflow';
import { updateColleagueWorkflow } from './workflows/update-colleague-workflow';

// Define types for colleague with relations
type ColleagueWithRelations = Prisma.ColleagueGetPayload<{
  include: {
    expenseParticipants: {
      include: {
        expense: {
          include: {
            restaurant: true;
          };
        };
      };
    };
    payments: true;
  };
}>;

type ColleagueBasic = Prisma.ColleagueGetPayload<object>;

// Helper function to serialize Decimal to number for basic colleague
const serializeColleague = (colleague: ColleagueBasic) => ({
  ...colleague,
});

// Helper function to serialize colleague with relations
const serializeColleagueWithRelations = (colleague: ColleagueWithRelations) => ({
  ...colleague,
  expenseParticipants: colleague.expenseParticipants.map((ep) => ({
    ...ep,
    amount: serializeDecimal(ep.amount),
    expense: ep.expense
      ? {
          ...ep.expense,
          amount: serializeDecimal(ep.expense.amount),
          restaurant: ep.expense.restaurant || null,
        }
      : null,
  })),
  payments: colleague.payments.map((payment) => ({
    ...payment,
    amount: serializeDecimal(payment.amount),
  })),
});

// Pagination schema for colleagues
const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
  search: z.string().optional().transform(sanitizeSearchInput),
  sortBy: z.enum(['name']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Get all colleagues
export const getColleagues = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await getAuthFromCookie())) return [];
  try {
    const colleagues = await prisma.colleague.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return colleagues.map(serializeColleague);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch colleagues');
  }
});

async function paginateColleagues(
  where: Prisma.ColleagueWhereInput,
  page: number,
  pageSize: number,
  search: string | undefined,
  sortBy: string,
  sortOrder: 'asc' | 'desc'
) {
  const skip = (page - 1) * pageSize;

  const effectiveWhere: Prisma.ColleagueWhereInput = {
    ...where,
    ...(search
      ? {
          name: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : {}),
  };

  const orderBy: Prisma.ColleagueOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [total, colleagues] = await Promise.all([
    prisma.colleague.count({ where: effectiveWhere }),
    prisma.colleague.findMany({
      where: effectiveWhere,
      skip,
      take: pageSize,
      orderBy,
    }),
  ]);

  return createPaginatedResponse(colleagues.map(serializeColleague), total, page, pageSize);
}

// Get colleagues with pagination
export const getColleaguesPaginated = createServerFn({ method: 'GET' })
  .validator((data) => paginationSchema.parse(data))
  .handler(async ({ data }) => {
    if (!(await getAuthFromCookie())) {
      return createEmptyPaginatedResponse(data.page, data.pageSize);
    }
    try {
      return await paginateColleagues(
        { deletedAt: null },
        data.page,
        data.pageSize,
        data.search,
        data.sortBy,
        data.sortOrder
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch paginated colleagues');
    }
  });

// Get colleague statistics
export const getColleagueStats = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await getAuthFromCookie())) {
    return { totalColleagues: 0, totalOutstanding: 0, totalCredit: 0, totalPayments: 0 };
  }
  try {
    // Import the balance calculation function
    const { getColleagueStatsFromCalculatedBalances } = await import('../balance-calculator');

    // Use the new calculated balance stats function
    return await getColleagueStatsFromCalculatedBalances();
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch colleague stats');
  }
});

// Get colleague by ID
export const getColleagueById = createServerFn({ method: 'GET' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    await requireAuthFromCookie();
    try {
      const colleague = await prisma.colleague.findFirst({
        where: { id: data.id, deletedAt: null },
        include: {
          // Include related data when needed
          expenseParticipants: {
            include: {
              expense: {
                include: {
                  restaurant: true,
                },
              },
            },
          },
          payments: true,
        },
      });

      if (!colleague) {
        throw new AppError(ErrorCode.NOT_FOUND_COLLEAGUE, 'Colleague not found');
      }

      // Serialize the colleague and any nested data with Decimals
      return serializeColleagueWithRelations(colleague);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch colleague');
    }
  });

// Create a new colleague (admin only)
export const createColleague = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        name: z.string().min(1, 'Name is required'),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      return await prisma.$transaction(async (tx) => {
        return createColleagueWorkflow(tx, { name: data.name });
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to create colleague');
    }
  });

// Update a colleague (admin only)
export const updateColleague = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
        name: z.string().min(1, 'Name is required').optional(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      return await prisma.$transaction(async (tx) => {
        return updateColleagueWorkflow(tx, { id: data.id, name: data.name ?? '' });
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to update colleague');
    }
  });

// Delete a colleague (admin only) — soft delete
export const deleteColleague = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    // Verify admin authentication
    await requireAdminFromCookie();

    try {
      return await prisma.$transaction(async (tx) => {
        return deleteColleagueWorkflow(tx, { id: data.id });
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to delete colleague');
    }
  });

/**
 * Get unapplied funds for all colleagues.
 * Unapplied funds = Sum of all approved payments - Sum of all payment applications
 * Returns a map of colleagueId -> unapplied funds.
 */
export const getUnappliedFundsForAllColleagues = createServerFn({
  method: 'GET',
}).handler(async () => {
  if (!(await getAuthFromCookie())) return {};
  const result = await prisma.$transaction(async (tx) => {
    return getUnappliedFundsWorkflow(tx);
  });
  return result.unappliedFunds;
});

// Get active colleagues only (for expense form dropdowns)
export const getActiveColleagues = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await getAuthFromCookie())) return [];
  try {
    return await prisma.$transaction(async (tx) => {
      return getActiveColleaguesWorkflow(tx);
    });
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch active colleagues');
  }
});

// Inactive colleagues pagination schema
const inactivePaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
  search: z.string().optional().transform(sanitizeSearchInput),
  sortBy: z.enum(['name', 'deletedAt']).default('deletedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Get inactive (soft-deleted) colleagues with pagination (admin only)
export const getInactiveColleaguesPaginated = createServerFn({ method: 'GET' })
  .validator((data) => inactivePaginationSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdminFromCookie();

    try {
      return await paginateColleagues(
        { deletedAt: { not: null } },
        data.page,
        data.pageSize,
        data.search,
        data.sortBy,
        data.sortOrder
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch inactive colleagues');
    }
  });

// Restore a soft-deleted colleague (admin only)
export const restoreColleague = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    await requireAdminFromCookie();

    try {
      return await prisma.$transaction(async (tx) => {
        return restoreColleagueWorkflow(tx, { id: data.id });
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to restore colleague');
    }
  });

// Permanently delete a colleague (admin only)
export const permanentDeleteColleague = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        id: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    await requireAdminFromCookie();

    return await prisma.$transaction(async (tx) => {
      return permanentDeleteColleagueWorkflow(tx, { id: data.id });
    });
  });
