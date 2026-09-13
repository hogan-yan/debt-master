import { Prisma } from '@prisma/client';
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { getAuthFromCookie, requireAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { getStorageUrl } from '@/server/infrastructure/storage';
import { serializeDecimal } from '@/server/utils/decimal';
import {
  assertExpenseObjectAccess,
  assertParticipantObjectAccess,
} from '@/server/utils/storage-authz';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';
import { createEmptyPaginatedResponse, createPaginatedResponse } from '../utils/pagination';
import { paginationSchema } from './schemas';
import { EXPENSE_INCLUDE, serializeExpense } from './serialization';
// =============================================================================
// QUERY FUNCTIONS (READ OPERATIONS)
// =============================================================================

/**
 * Filter serialized expenses by payment status.
 * Expenses must already be serialized (i.e. participant payment status computed).
 */
export function filterExpensesByPaymentStatus<
  T extends { participants?: Array<{ isPaid: boolean }> },
>(expenses: T[], paymentStatus: 'all' | 'paid' | 'unpaid' | 'partial'): T[] {
  if (paymentStatus === 'all') return expenses;

  return expenses.filter((expense) => {
    const participants = expense.participants || [];
    const paidCount = participants.filter((p) => p.isPaid).length;
    const totalCount = participants.length;

    if (paymentStatus === 'paid') {
      return paidCount === totalCount && totalCount > 0;
    }
    if (paymentStatus === 'unpaid') {
      return paidCount === 0;
    }
    return paidCount > 0 && paidCount < totalCount;
  });
}

/**
 * Build the Prisma where clause for expense queries from search + colleague filters.
 * Extracted for direct unit testing (independent of the server-fn runtime).
 */
export function buildExpenseWhereClause(input: {
  search?: string;
  colleagueIds?: number[];
}): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {};

  // Add search filter
  if (input.search) {
    where.OR = [
      {
        restaurant: {
          name: {
            contains: input.search,
            mode: 'insensitive' as const,
          },
        },
      },
      {
        participants: {
          some: {
            colleague: {
              name: {
                contains: input.search,
                mode: 'insensitive' as const,
              },
            },
          },
        },
      },
    ];
  }

  // Add colleague filter - uses OR logic for multiple colleagues
  if (input.colleagueIds && input.colleagueIds.length > 0) {
    where.participants = {
      some: {
        colleagueId: {
          in: input.colleagueIds,
        },
      },
    };
  }

  return where;
}

/**
 * Get expenses with pagination
 */
export const getExpensesPaginated = createServerFn({ method: 'GET' })
  .validator((data) => paginationSchema.parse(data))
  .handler(async ({ data }) => {
    if (!(await getAuthFromCookie())) {
      return createEmptyPaginatedResponse(data.page, data.pageSize);
    }
    try {
      const { page, pageSize, search, sortBy, sortOrder, colleagueIds, paymentStatus } = data;
      const skip = (page - 1) * pageSize;

      // Build where clause for search and colleague filter
      const where = buildExpenseWhereClause({ search, colleagueIds });

      // Build order by clause with secondary sort for consistent ordering
      let orderBy: Prisma.ExpenseOrderByWithRelationInput[];
      switch (sortBy) {
        case 'restaurant':
          orderBy = [{ restaurant: { name: sortOrder } }, { createdAt: 'desc' }];
          break;
        case 'date':
          orderBy = [{ date: sortOrder }, { createdAt: 'desc' }];
          break;
        case 'amount':
        case 'splitType':
        case 'createdAt':
          orderBy = [{ [sortBy]: sortOrder }, { createdAt: 'desc' }];
          break;
      }

      // When payment status filtering is active, resolve matching expense ids
      // from lightweight per-participant status rows first (approved application
      // sums vs participant amount — the same isPaid predicate serializeExpense
      // uses), then fetch only the requested page with the deep include.
      if (paymentStatus && paymentStatus !== 'all') {
        const participantRows = await prisma.expenseParticipant.findMany({
          where: { expense: where },
          select: {
            expenseId: true,
            amount: true,
            paymentApplications: {
              where: { payment: { isApproved: true } },
              select: { amount: true },
            },
          },
        });

        const paidCount = new Map<number, number>();
        const totalCount = new Map<number, number>();
        for (const row of participantRows) {
          const total = totalCount.get(row.expenseId) ?? 0;
          totalCount.set(row.expenseId, total + 1);
          const paidCents = row.paymentApplications.reduce(
            (sum, app) => sum + BigInt(new Prisma.Decimal(app.amount).toFixed(2).replace('.', '')),
            0n
          );
          const owedCents = BigInt(new Prisma.Decimal(row.amount).toFixed(2).replace('.', ''));
          if (paidCents >= owedCents) {
            paidCount.set(row.expenseId, (paidCount.get(row.expenseId) ?? 0) + 1);
          }
        }

        const matchingIds = [...totalCount.keys()].filter((expenseId) => {
          const paid = paidCount.get(expenseId) ?? 0;
          const total = totalCount.get(expenseId) ?? 0;
          if (paymentStatus === 'paid') return paid === total && total > 0;
          if (paymentStatus === 'unpaid') return paid === 0;
          return paid > 0 && paid < total;
        });

        const filteredTotalCount = matchingIds.length;
        const start = (page - 1) * pageSize;
        const pageIds = matchingIds.slice(start, start + pageSize);

        if (pageIds.length === 0) {
          return createPaginatedResponse([], filteredTotalCount, page, pageSize);
        }

        const expenses = await prisma.expense.findMany({
          where: { ...where, id: { in: pageIds } },
          include: EXPENSE_INCLUDE,
          orderBy,
        });

        // Restore the requested order (the id filter does not preserve it)
        const byId = new Map(expenses.map((expense) => [expense.id, serializeExpense(expense)]));
        const ordered = pageIds
          .map((id) => byId.get(id))
          .filter((expense): expense is NonNullable<typeof expense> => expense != null);

        return createPaginatedResponse(ordered, filteredTotalCount, page, pageSize);
      }

      // Fast path: no payment status filter — use Prisma skip/take
      const totalCount = await prisma.expense.count({ where });
      const expenses = await prisma.expense.findMany({
        where,
        include: EXPENSE_INCLUDE,
        orderBy,
        skip,
        take: pageSize,
      });
      const serializedExpenses = expenses.map((expense) => serializeExpense(expense));
      return createPaginatedResponse(serializedExpenses, totalCount, page, pageSize);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch paginated expenses');
    }
  });

/**
 * Get expense statistics with caching
 */
export const getExpenseStats = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await getAuthFromCookie())) {
    return { totalExpenses: 0, totalAmount: 0, averageAmount: 0, uniqueRestaurants: 0 };
  }
  try {
    // Cache miss or cache not available - aggregate in the database so the
    // query cost is constant per call and the sum never accumulates float error.
    const [totalExpenses, sumResult, restaurantGroups] = await Promise.all([
      prisma.expense.count(),
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.expense.groupBy({ by: ['restaurantId'] }),
    ]);

    const totalAmount = serializeDecimal(sumResult._sum.amount);

    const averageAmount = totalExpenses > 0 ? totalAmount / totalExpenses : 0;

    const stats = {
      totalExpenses,
      totalAmount,
      averageAmount,
      uniqueRestaurants: restaurantGroups.length,
    };

    return stats;
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch expense stats');
  }
});

/**
 * Get expense by ID
 */
export const getExpenseById = createServerFn({ method: 'GET' })
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
      const expense = await prisma.expense.findUnique({
        where: { id: data.id },
        include: EXPENSE_INCLUDE,
      });

      if (!expense) {
        throw new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found');
      }

      return serializeExpense(expense);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch expense');
    }
  });

/**
 * Get expense receipt URL
 */
export const getExpenseReceiptUrl = createServerFn({ method: 'GET' })
  .validator((data) => {
    return z
      .object({
        expenseId: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    await requireAuthFromCookie();
    await assertExpenseObjectAccess(data.expenseId);
    try {
      const expense = await prisma.expense.findUnique({
        where: { id: data.expenseId },
        select: {
          receiptBucket: true,
          receiptObjectKey: true,
        },
      });

      if (!expense?.receiptBucket || !expense.receiptObjectKey) {
        return { url: null };
      }

      const url = await getStorageUrl(expense.receiptBucket, expense.receiptObjectKey);
      return { url };
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to get expense receipt URL');
    }
  });

/**
 * Get payment proof URL for expense participant
 */
export const getExpensePaymentProofUrl = createServerFn({ method: 'GET' })
  .validator((data) => {
    return z
      .object({
        participantId: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    await requireAuthFromCookie();
    try {
      // Find the expense participant with their payment applications
      const participant = await prisma.expenseParticipant.findUnique({
        where: { id: data.participantId },
        include: {
          paymentApplications: {
            include: {
              payment: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      if (!participant?.paymentApplications.length) {
        return { url: null };
      }

      await assertParticipantObjectAccess(participant);

      const firstApplication = participant.paymentApplications[0];
      if (!firstApplication) {
        return { url: null };
      }
      const payment = firstApplication.payment;

      // Only show proof for approved payments
      if (!payment.isApproved || !payment.paymentProofBucket || !payment.paymentProofObjectKey) {
        return { url: null };
      }

      const url = await getStorageUrl(payment.paymentProofBucket, payment.paymentProofObjectKey);
      return { url };
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to get payment proof URL');
    }
  });

/**
 * Get unpaid expenses for a specific colleague
 * Returns expenses where the colleague is a participant but hasn't fully paid via approved payment applications
 */
export const getUnpaidExpensesForColleague = createServerFn({ method: 'GET' })
  .validator((data) => {
    return z
      .object({
        colleagueId: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    if (!(await getAuthFromCookie())) return [];
    try {
      // Find expense participants for this colleague
      const participants = await prisma.expenseParticipant.findMany({
        where: {
          colleagueId: data.colleagueId,
        },
        include: {
          expense: {
            include: {
              restaurant: true,
              participants: {
                include: {
                  colleague: true,
                },
              },
            },
          },
          paymentApplications: {
            include: {
              payment: true,
            },
          },
        },
        orderBy: {
          expense: {
            date: 'asc', // Show oldest expenses first for payment priority
          },
        },
      });

      // Filter to only unpaid expenses and transform the data
      const unpaidExpenses = participants
        .map((participant) => {
          const totalApprovedPaid =
            participant.paymentApplications
              ?.filter((app) => app.payment?.isApproved)
              .reduce((sum, app) => sum + serializeDecimal(app.amount), 0) || 0;

          const participantAmount = serializeDecimal(participant.amount);
          const remainingOwed = participantAmount - totalApprovedPaid;

          return {
            id: participant.expense.id,
            date: participant.expense.date,
            restaurantName: participant.expense.restaurant?.name || 'Unknown Restaurant',
            restaurantId: participant.expense.restaurantId,
            totalAmount: serializeDecimal(participant.expense.amount),
            colleagueAmount: participantAmount,
            participantId: participant.id,
            notes: participant.expense.notes,
            participantCount: participant.expense.participants?.length || 0,
            splitType: participant.expense.splitType,
            remainingOwed,
            totalApprovedPaid,
          };
        })
        .filter((expense) => expense.remainingOwed > 0); // Only return expenses with remaining balance

      return unpaidExpenses;
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        ErrorCode.INFRASTRUCTURE_ERROR,
        'Failed to fetch unpaid expenses for colleague'
      );
    }
  });

/**
 * Helper function to check if a participant has pending payment claims
 */
export const checkParticipantPendingStatus = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        participantId: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    await requireAuthFromCookie();
    try {
      // Get participant info
      const participant = await prisma.expenseParticipant.findUnique({
        where: { id: data.participantId },
        include: {
          expense: {
            include: {
              restaurant: true,
            },
          },
          colleague: true,
        },
      });

      if (!participant) {
        return { hasPendingClaim: false, submittedAt: null };
      }

      // Check for pending payment claims
      const pendingPayments = await prisma.payment.findMany({
        where: {
          colleagueId: participant.colleagueId,
          isApproved: false,
          createdBy: 'COLLEAGUE_CLAIM',
          restaurantId: participant.expense?.restaurantId,
        },
        orderBy: {
          submittedAt: 'desc',
        },
        take: 1,
      });

      return {
        hasPendingClaim: pendingPayments.length > 0,
        submittedAt: pendingPayments[0]?.submittedAt || null,
      };
    } catch (error) {
      // Fail loud: swallowing this reported `hasPendingClaim: false` on DB
      // errors, which defeats the duplicate-claim guard for colleagues.
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to check pending claim status');
    }
  });

/**
 * Get pending payment claims for a specific expense
 */
export const getPendingClaimsForExpense = createServerFn({ method: 'GET' })
  .validator((data) => {
    return z
      .object({
        expenseId: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    if (!(await getAuthFromCookie())) return [];
    try {
      const pendingPayments = await prisma.payment.findMany({
        where: {
          expenseId: data.expenseId,
          isApproved: false,
          createdBy: 'COLLEAGUE_CLAIM',
        },
        include: {
          colleague: true,
        },
        orderBy: {
          submittedAt: 'desc',
        },
      });

      return pendingPayments.map((payment) => ({
        id: payment.id,
        amount: serializeDecimal(payment.amount),
        submittedAt: payment.submittedAt || new Date(),
        hasPaymentProof: !!(payment.paymentProofBucket && payment.paymentProofObjectKey),
        colleagueName: payment.colleague?.name || 'Unknown',
        colleagueId: payment.colleagueId,
      }));
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        ErrorCode.INFRASTRUCTURE_ERROR,
        'Failed to fetch pending payment claims for expense'
      );
    }
  });

/**
 * Get pending payment claims - Admin only
 */
export const getPendingPaymentClaims = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await getAuthFromCookie())) return [];
  try {
    const pendingPayments = await prisma.payment.findMany({
      where: {
        isApproved: false,
        createdBy: 'COLLEAGUE_CLAIM',
      },
      include: {
        colleague: true,
        restaurant: true,
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    // Batch fetch all participants for pending payments (fixes N+1 query)
    const searchConditions = pendingPayments.map((payment) => ({
      colleagueId: payment.colleagueId,
      ...(payment.expenseId ? { expenseId: payment.expenseId } : {}),
    }));

    const participants =
      searchConditions.length > 0
        ? await prisma.expenseParticipant.findMany({
            where: { OR: searchConditions },
            include: {
              expense: {
                include: {
                  restaurant: true,
                },
              },
              colleague: true,
            },
          })
        : [];

    // Build lookup map by colleagueId-expenseId
    const participantMap = new Map(participants.map((p) => [`${p.colleagueId}-${p.expenseId}`, p]));

    const pendingClaimsWithParticipants = pendingPayments.map((payment) => {
      const participant = participantMap.get(`${payment.colleagueId}-${payment.expenseId}`);

      return {
        id: payment.id,
        participantId: participant?.id || null,
        amount: serializeDecimal(payment.amount),
        submittedAt: payment.submittedAt,
        paymentType: payment.paymentType,
        paymentProofBucket: payment.paymentProofBucket,
        paymentProofObjectKey: payment.paymentProofObjectKey,
        restaurantId: payment.restaurantId,
        colleague: payment.colleague
          ? {
              ...payment.colleague,
            }
          : undefined,
        restaurant: payment.restaurant
          ? {
              id: payment.restaurant.id,
              name: payment.restaurant.name,
            }
          : undefined,
        expense: participant?.expense
          ? {
              id: participant.expense.id,
              date: participant.expense.date,
              amount: serializeDecimal(participant.expense.amount),
            }
          : undefined,
      };
    });

    return pendingClaimsWithParticipants;
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch pending payment claims');
  }
});
