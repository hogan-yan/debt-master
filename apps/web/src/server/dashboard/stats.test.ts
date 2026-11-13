import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, ErrorCode } from '@/utils/errors';

vi.mock('@tanstack/react-start', () => {
  const createBuilder = () => {
    const builder = {
      validator: () => builder,
      inputValidator: () => builder,
      handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) => fn,
    };
    return builder;
  };
  return { createServerFn: () => createBuilder() };
});

const mockGetAuth = vi.fn();
const mockGetStats = vi.fn();

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({ getAuthFromCookie: mockGetAuth }));
vi.mock('../balance-calculator', () => ({ getColleagueStatsFromCalculatedBalances: mockGetStats }));

const { getDashboardStats } = await import('./stats');

type ServerFn = (ctx: { data: unknown }) => Promise<unknown>;

describe('getDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty stats when not authenticated', async () => {
    mockGetAuth.mockResolvedValue(null);
    const result = (await (getDashboardStats as ServerFn)({ data: undefined })) as unknown;
    expect((result as { totalColleagues: number }).totalColleagues).toBe(0);
    expect((result as { netBalance: number }).netBalance).toBe(0);
  });

  it('returns stats for authenticated user', async () => {
    mockGetAuth.mockResolvedValue({ isAdmin: true });
    mockGetStats.mockResolvedValue({
      totalColleagues: 5,
      totalOutstanding: 300,
      totalCredit: 100,
      totalPayments: 12,
    });
    const result = (await (getDashboardStats as ServerFn)({ data: undefined })) as unknown;
    expect((result as { totalColleagues: number }).totalColleagues).toBe(5);
    expect((result as { netBalance: number }).netBalance).toBe(-200);
  });

  it('rethrows AppError as-is', async () => {
    mockGetAuth.mockResolvedValue({ isAdmin: true });
    const appErr = new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'db fail');
    mockGetStats.mockRejectedValue(appErr);
    await expect((getDashboardStats as ServerFn)({ data: undefined })).rejects.toBe(appErr);
  });

  it('wraps generic error in INFRASTRUCTURE_ERROR', async () => {
    mockGetAuth.mockResolvedValue({ isAdmin: true });
    mockGetStats.mockRejectedValue(new Error('fail'));
    await expect((getDashboardStats as ServerFn)({ data: undefined })).rejects.toThrow(
      'Failed to fetch dashboard statistics'
    );
  });
});
