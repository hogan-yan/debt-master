import { createServerFn } from '@tanstack/react-start';
import { getAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { AppError, ErrorCode, isAppError } from '@/utils/errors';
import { getColleagueStatsFromCalculatedBalances } from '../balance-calculator';
import type { DashboardStats } from './types';
import { buildDashboardStats, emptyDashboardStats } from './workflows/stats-workflow';

export const getDashboardStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardStats> => {
    if (!(await getAuthFromCookie())) {
      return emptyDashboardStats();
    }
    try {
      const balanceStats = await getColleagueStatsFromCalculatedBalances();
      return buildDashboardStats(balanceStats);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to fetch dashboard statistics');
    }
  }
);
