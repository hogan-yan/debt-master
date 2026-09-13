import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import {
  type ColleagueDetailMetrics,
  colleagueDetailMetricsWorkflow,
} from './workflows/colleague-detail-metrics-workflow';

export const getColleagueDetailMetrics = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    return z
      .object({
        colleagueId: z.number().int().positive(),
      })
      .parse(data);
  })
  .handler(async ({ data }): Promise<ColleagueDetailMetrics> => {
    await requireAuthFromCookie();
    return colleagueDetailMetricsWorkflow(prisma, {}, { colleagueId: data.colleagueId });
  });
