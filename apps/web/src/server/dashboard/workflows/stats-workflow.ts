/**
 * Stats workflow — pure transformation logic for dashboard statistics
 */

import type { DashboardStats } from '../types';

export interface BalanceStats {
  totalColleagues: number;
  totalOutstanding: number;
  totalCredit: number;
  totalPayments: number;
}

export function buildDashboardStats(stats: BalanceStats): DashboardStats {
  return {
    totalColleagues: stats.totalColleagues,
    totalOutstanding: stats.totalOutstanding,
    totalCredit: stats.totalCredit,
    totalPayments: stats.totalPayments,
    netBalance: stats.totalCredit - stats.totalOutstanding,
    activeColleagues: stats.totalColleagues,
  };
}

export function emptyDashboardStats(): DashboardStats {
  return {
    totalColleagues: 0,
    totalOutstanding: 0,
    totalCredit: 0,
    totalPayments: 0,
    netBalance: 0,
    activeColleagues: 0,
  };
}
