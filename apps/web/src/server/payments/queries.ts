import { Prisma } from '@prisma/client';
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { getAuthFromCookie, requireAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { getStorageUrl } from '@/server/infrastructure/storage';
import { serializeDecimal } from '@/server/utils/decimal';
import { sanitizeSearchInput } from '@/server/utils/search-sanitization';
import {
  assertParticipantObjectAccess,
  assertPaymentObjectAccess,
} from '@/server/utils/storage-authz';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';
import { createEmptyPaginatedResponse, createPaginatedResponse } from '../utils/pagination';
import { serializePayment } from './types';
/**
 * Get payment by ID
 */
export const getPaymentById = createServerFn({ method: 'GET' })
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
      const payment = await prisma.payment.findUnique({
        where: { id: data.id },
        include: {
          colleague: true,
          restaurant: true,
          applications: {
            include: {
              expense: {
                include: {
                  restaurant: true,
                },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new AppError(ErrorCode.NOT_FOUND_PAYMENT, 'Payment not found');
      }

      return serializePayment(payment);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch payment');
    }
  });

/**
 * Get payment statistics with caching
 */
export const getPaymentStats = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await getAuthFromCookie())) {
    return { totalPayments: 0, totalAmount: 0, averageAmount: 0, uniquePayers: 0 };
  }
  try {
    const [totalPayments, paymentSum, uniquePayers] = await Promise.all([
      prisma.payment.count(),
      prisma.payment.aggregate({
        _sum: {
          amount: true,
        },
      }),
      prisma.payment.groupBy({
        by: ['colleagueId'],
      }),
    ]);

    const totalAmount = serializeDecimal(paymentSum._sum.amount);

    const averageAmount = totalPayments > 0 ? totalAmount / totalPayments : 0;

    const stats = {
      totalPayments,
      totalAmount,
      averageAmount,
      uniquePayers: uniquePayers.length,
    };

    return stats;
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch payment stats');
  }
});

/**
 * Get payments with pagination, search, and sorting with createdAt as secondary
 */
export const getPaymentsPaginated = createServerFn({ method: 'POST' })
  .validator((data) => {
    return z
      .object({
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().default(10),
        search: z.string().optional().transform(sanitizeSearchInput),
        sortBy: z.enum(['date', 'amount', 'paymentType', 'colleagueName']).default('date'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    if (!(await getAuthFromCookie())) {
      return createEmptyPaginatedResponse(data.page, data.pageSize);
    }
    try {
      const { page, pageSize, search, sortBy, sortOrder } = data;
      const skip = (page - 1) * pageSize;

      // Build where clause for search
      const whereClause: Prisma.PaymentWhereInput = {};
      if (search) {
        whereClause.OR = [
          {
            colleague: {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            paymentType: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
          {
            restaurant: {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          },
        ];
      }

      // Build orderBy clause with createdAt as secondary sort
      let orderBy: Prisma.PaymentOrderByWithRelationInput[] = [];
      switch (sortBy) {
        case 'colleagueName':
          orderBy = [{ colleague: { name: sortOrder } }, { createdAt: 'desc' }];
          break;
        case 'date':
          orderBy = [{ date: sortOrder }, { createdAt: 'desc' }];
          break;
        case 'amount':
        case 'paymentType':
          orderBy = [{ [sortBy]: sortOrder }, { createdAt: 'desc' }];
          break;
      }

      // Get total count
      const totalCount = await prisma.payment.count({
        where: whereClause,
      });

      // Get payments with pagination
      const payments = await prisma.payment.findMany({
        where: whereClause,
        include: {
          colleague: true,
          restaurant: true,
          applications: {
            include: {
              expense: {
                include: {
                  restaurant: true,
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      });

      return createPaginatedResponse(payments.map(serializePayment), totalCount, page, pageSize);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch paginated payments');
    }
  });

/**
 * Get payment proof URL for expense participant (legacy function)
 */
export const getPaymentProofUrl = createServerFn({ method: 'GET' })
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
      // Find the expense participant first
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

      const firstApp = participant.paymentApplications[0];
      if (!firstApp) {
        return { url: null };
      }
      const payment = firstApp.payment;

      if (!payment.paymentProofBucket || !payment.paymentProofObjectKey) {
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
 * Get payment proof URL directly for a Payment object
 */
export const getPaymentProofUrlByPaymentId = createServerFn({ method: 'GET' })
  .validator((data) => {
    return z
      .object({
        paymentId: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    await requireAuthFromCookie();
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: data.paymentId },
        select: {
          colleagueId: true,
          paymentProofBucket: true,
          paymentProofObjectKey: true,
        },
      });

      if (!payment?.paymentProofBucket || !payment.paymentProofObjectKey) {
        return { url: null };
      }

      await assertPaymentObjectAccess(payment);

      const url = await getStorageUrl(payment.paymentProofBucket, payment.paymentProofObjectKey);
      return { url };
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to get payment proof URL');
    }
  });
