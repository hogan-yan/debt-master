import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    restaurant: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  getAuthFromCookie: vi.fn(),
  requireAuthFromCookie: vi.fn(),
}));

vi.mock('@/server/utils/decimal', () => ({
  serializeDecimal: vi.fn((decimal) => (decimal ? Number(decimal.toString()) : 0)),
}));

vi.mock('./restaurant-utils', () => ({
  getAllRestaurantsExpenseAggregation: vi.fn().mockResolvedValue(new Map()),
  getExpenseAggregationMap: vi.fn().mockResolvedValue(new Map()),
  handleRestaurantError: vi.fn((_error, operation) => {
    throw new Error(`Failed to ${operation}`);
  }),
}));

import { getAuthFromCookie, requireAuthFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { getRestaurantById, getRestaurants, getRestaurantsPaginated } from './restaurant-queries';
import { getAllRestaurantsExpenseAggregation, getExpenseAggregationMap } from './restaurant-utils';

// biome-ignore lint/suspicious/noExplicitAny: test helper to call mocked server functions with loose typing
type ServerFn = (ctx: { data: any }) => Promise<any>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getRestaurants', () => {
  beforeEach(() => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns empty array when unauthenticated', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue(null);

    const result = await (getRestaurants as ServerFn)({ data: {} });

    expect(result).toEqual([]);
  });

  it('returns restaurants with aggregation for authenticated user', async () => {
    vi.mocked(prisma.restaurant.findMany).mockResolvedValue([
      {
        id: 1,
        name: 'R1',
        address: 'A1',
        cuisine: 'italian',
        notes: null,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 2,
        name: 'R2',
        address: 'A2',
        cuisine: 'japanese',
        notes: null,
        createdAt: new Date('2024-01-02'),
      },
    ] as never);
    const aggregationMap = new Map([
      [1, { totalExpenses: 5, totalAmount: 500 }],
      [2, { totalExpenses: 3, totalAmount: 300 }],
    ]);
    vi.mocked(getAllRestaurantsExpenseAggregation).mockResolvedValue(aggregationMap);

    const result = await (getRestaurants as ServerFn)({ data: {} });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({ id: 1, totalExpenses: 5, totalAmount: 500 })
    );
    expect(result[1]).toEqual(
      expect.objectContaining({ id: 2, totalExpenses: 3, totalAmount: 300 })
    );
  });

  it('returns zero aggregation when no expenses', async () => {
    vi.mocked(prisma.restaurant.findMany).mockResolvedValue([
      { id: 1, name: 'R1', address: 'A1', cuisine: null, notes: null, createdAt: new Date() },
    ] as never);
    vi.mocked(getAllRestaurantsExpenseAggregation).mockResolvedValue(new Map());

    const result = await (getRestaurants as ServerFn)({ data: {} });

    expect(result[0]).toEqual(expect.objectContaining({ totalExpenses: 0, totalAmount: 0 }));
  });

  it('routes prisma failures through handleRestaurantError', async () => {
    vi.mocked(prisma.restaurant.findMany).mockRejectedValue(new Error('db down'));

    await expect((getRestaurants as ServerFn)({ data: {} })).rejects.toThrow(
      'Failed to fetch restaurants'
    );
  });
});

describe('getRestaurantsPaginated', () => {
  beforeEach(() => {
    vi.mocked(getAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns empty paginated response when unauthenticated', async () => {
    vi.mocked(getAuthFromCookie).mockResolvedValue(null);

    const result = await (getRestaurantsPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } });

    expect(result.data).toEqual([]);
    expect(result.pagination.totalCount).toBe(0);
  });

  it('returns paginated restaurants for authenticated user', async () => {
    vi.mocked(prisma.restaurant.count).mockResolvedValue(2);
    vi.mocked(prisma.restaurant.findMany).mockResolvedValue([
      { id: 1, name: 'R1', address: 'A1', cuisine: 'italian', notes: null, createdAt: new Date() },
      { id: 2, name: 'R2', address: 'A2', cuisine: 'japanese', notes: null, createdAt: new Date() },
    ] as never);
    vi.mocked(getExpenseAggregationMap).mockResolvedValue(new Map());

    const result = await (getRestaurantsPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } });

    expect(result.pagination.totalCount).toBe(2);
    expect(result.data).toHaveLength(2);
  });

  it('applies search filter', async () => {
    vi.mocked(prisma.restaurant.count).mockResolvedValue(1);
    vi.mocked(prisma.restaurant.findMany).mockResolvedValue([
      {
        id: 1,
        name: 'Italian Place',
        address: 'A1',
        cuisine: 'italian',
        notes: null,
        createdAt: new Date(),
      },
    ] as never);
    vi.mocked(getExpenseAggregationMap).mockResolvedValue(new Map());

    const result = await (getRestaurantsPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, search: 'italian' },
    });

    expect(result.data).toHaveLength(1);
    expect(prisma.restaurant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      })
    );
  });

  it('applies sorting by name desc', async () => {
    vi.mocked(prisma.restaurant.count).mockResolvedValue(2);
    vi.mocked(prisma.restaurant.findMany).mockResolvedValue([
      { id: 2, name: 'R2', address: 'A2', cuisine: null, notes: null, createdAt: new Date() },
      { id: 1, name: 'R1', address: 'A1', cuisine: null, notes: null, createdAt: new Date() },
    ] as never);
    vi.mocked(getExpenseAggregationMap).mockResolvedValue(new Map());

    await (getRestaurantsPaginated as ServerFn)({
      data: { page: 1, pageSize: 10, sortBy: 'name', sortOrder: 'desc' },
    });

    expect(prisma.restaurant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'desc' },
      })
    );
  });

  it('routes prisma failures through handleRestaurantError', async () => {
    vi.mocked(prisma.restaurant.count).mockRejectedValue(new Error('db down'));

    await expect(
      (getRestaurantsPaginated as ServerFn)({ data: { page: 1, pageSize: 10 } })
    ).rejects.toThrow('Failed to fetch paginated restaurants');
  });
});

describe('getRestaurantById', () => {
  beforeEach(() => {
    vi.mocked(requireAuthFromCookie).mockResolvedValue({ id: 1 } as never);
  });

  it('returns restaurant with expenses when found', async () => {
    vi.mocked(prisma.restaurant.findUnique).mockResolvedValue({
      id: 1,
      name: 'R1',
      address: 'A1',
      expenses: [
        {
          id: 1,
          amount: { toString: () => '100' },
          participants: [
            {
              id: 1,
              amount: { toString: () => '50' },
              colleague: { id: 1, name: 'Alice' },
            },
          ],
        },
      ],
    } as never);

    const result = await (getRestaurantById as ServerFn)({ data: { id: 1 } });

    expect(result).toEqual(expect.objectContaining({ id: 1, name: 'R1' }));
    expect(result.expenses).toHaveLength(1);
    expect(prisma.restaurant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    );
  });

  it('throws when restaurant not found', async () => {
    vi.mocked(prisma.restaurant.findUnique).mockResolvedValue(null);

    await expect((getRestaurantById as ServerFn)({ data: { id: 999 } })).rejects.toThrow(
      'Failed to fetch restaurant'
    );
  });

  it('throws when unauthenticated', async () => {
    vi.mocked(requireAuthFromCookie).mockRejectedValue(new Error('Authentication required'));

    await expect((getRestaurantById as ServerFn)({ data: { id: 1 } })).rejects.toThrow(
      'Authentication required'
    );
  });
});
