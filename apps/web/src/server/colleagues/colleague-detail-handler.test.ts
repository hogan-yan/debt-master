import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    colleague: { findMany: vi.fn() },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  requireAuthFromCookie: vi.fn(),
}));

vi.mock('./workflows/colleague-detail-metrics-workflow', () => ({
  colleagueDetailMetricsWorkflow: vi.fn(),
}));

import { requireAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { getColleagueDetailMetrics } from './colleague-detail';
import { colleagueDetailMetricsWorkflow } from './workflows/colleague-detail-metrics-workflow';

type ServerFn = (ctx: { data: unknown }) => Promise<unknown>;

describe('getColleagueDetailMetrics handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('calls workflow with colleagueId from input', async () => {
    const mockMetrics = {
      totalOwed: 100,
      totalPaid: 50,
      currentBalance: -50,
      debtAgeDays: 10,
      lastActivityDate: new Date(),
      expenseCount: 5,
      paymentCount: 3,
      agingBuckets: { current: 0, days1to30: 50, days31to60: 0, days61to90: 0, days90plus: 0 },
    };
    vi.mocked(colleagueDetailMetricsWorkflow).mockResolvedValue(mockMetrics);

    const result = await (getColleagueDetailMetrics as ServerFn)({ data: { colleagueId: 42 } });

    expect(colleagueDetailMetricsWorkflow).toHaveBeenCalledWith(prisma, {}, { colleagueId: 42 });
    expect(result).toEqual(mockMetrics);
  });

  it('throws when unauthenticated', async () => {
    vi.mocked(requireAuthFromCookie).mockRejectedValue(new Error('Auth required'));

    await expect(
      (getColleagueDetailMetrics as ServerFn)({ data: { colleagueId: 1 } })
    ).rejects.toThrow('Auth required');
  });
});
