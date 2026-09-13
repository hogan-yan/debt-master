import { createServerFn } from '@tanstack/react-start';
import { getAuthFromCookie, requireAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';
import type { ColleagueWithBalance, PendingPayment } from './types';
import { colleaguesBalanceWorkflow } from './workflows/colleagues-balance-workflow';
import type { RawPendingPayment } from './workflows/colleagues-workflow';
import { filterOwingColleagues, transformPendingPayments } from './workflows/colleagues-workflow';

export const getColleaguesWithBalances = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ColleagueWithBalance[]> => {
    if (!(await getAuthFromCookie())) return [];
    try {
      return await colleaguesBalanceWorkflow(prisma, {}, {});
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        ErrorCode.INFRASTRUCTURE_ERROR,
        'Failed to fetch colleagues with balances'
      );
    }
  }
);

export const getColleaguesWhoOwe = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ColleagueWithBalance[]> => {
    if (!(await getAuthFromCookie())) return [];
    try {
      const colleaguesWithBalances = await getColleaguesWithBalances();
      return filterOwingColleagues(colleaguesWithBalances);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        ErrorCode.INFRASTRUCTURE_ERROR,
        'Failed to fetch colleagues who owe money'
      );
    }
  }
);

export const getPendingPayments = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PendingPayment[]> => {
    const user = await requireAuthFromCookie();
    if (!user.isAdmin) {
      throw new AppError(ErrorCode.AUTH_ADMIN_REQUIRED, 'Admin access required');
    }
    try {
      const pendingPayments = await prisma.payment.findMany({
        where: { isApproved: false },
        include: { colleague: true, restaurant: true },
        orderBy: { submittedAt: 'asc' },
      });

      const rawPendingPayments: RawPendingPayment[] = pendingPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        date: p.date,
        colleague: p.colleague,
        restaurant: p.restaurant,
        submittedAt: p.submittedAt,
        paymentType: p.paymentType,
      }));

      return transformPendingPayments(rawPendingPayments);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch pending payments');
    }
  }
);
