import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServerFnBuilder } from '@/test/helpers/server-fn-mock';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => createMockServerFnBuilder(),
}));

vi.mock('@/server/infrastructure/prisma', () => ({
  prisma: {
    restaurant: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/server/infrastructure/auth/auth-cookie', () => ({
  requireAdminFromCookie: vi.fn(),
}));

vi.mock('./restaurant-utils', () => ({
  handleRestaurantError: vi.fn((_error, operation) => {
    throw new Error(`Failed to ${operation}`);
  }),
  validateRestaurantForDeletion: vi.fn(),
}));

import { requireAdminFromCookie } from '@/server/infrastructure/auth/auth-cookie';
import { prisma } from '@/server/infrastructure/prisma';
import { createRestaurant, deleteRestaurant, updateRestaurant } from './restaurant-mutations';
import { validateRestaurantForDeletion } from './restaurant-utils';

// biome-ignore lint/suspicious/noExplicitAny: test helper to call mocked server functions with loose typing
type ServerFn = (ctx: { data: any }) => Promise<any>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createRestaurant', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('creates restaurant successfully as admin', async () => {
    vi.mocked(prisma.restaurant.create).mockResolvedValue({
      id: 1,
      name: 'Test Restaurant',
      address: '123 Main St',
      cuisine: 'italian',
      notes: null,
    } as never);

    const result = await (createRestaurant as ServerFn)({
      data: { name: 'Test Restaurant', address: '123 Main St', cuisine: 'italian', token: 'token' },
    });

    expect(prisma.restaurant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Test Restaurant',
          address: '123 Main St',
          cuisine: 'italian',
        }),
      })
    );
    expect(result).toEqual(expect.objectContaining({ id: 1, name: 'Test Restaurant' }));
  });

  it('creates restaurant without optional fields', async () => {
    vi.mocked(prisma.restaurant.create).mockResolvedValue({
      id: 1,
      name: 'Test Restaurant',
      address: '123 Main St',
      cuisine: null,
      notes: null,
    } as never);

    const result = await (createRestaurant as ServerFn)({
      data: { name: 'Test Restaurant', address: '123 Main St', token: 'token' },
    });

    expect(result).toEqual(expect.objectContaining({ id: 1, name: 'Test Restaurant' }));
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    await expect(
      (createRestaurant as ServerFn)({
        data: { name: 'Test Restaurant', address: '123 Main St', token: 'token' },
      })
    ).rejects.toThrow('Admin access required');
  });

  it('rejects missing name', async () => {
    await expect(
      (createRestaurant as ServerFn)({ data: { name: '', token: 'token' } })
    ).rejects.toThrow();
  });

  it('handles prisma create error', async () => {
    vi.mocked(prisma.restaurant.create).mockRejectedValue(new Error('db fail'));

    await expect(
      (createRestaurant as ServerFn)({
        data: { name: 'Test Restaurant', address: '123 Main St', token: 'token' },
      })
    ).rejects.toThrow('Failed to create restaurant');
  });
});

describe('updateRestaurant', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('updates restaurant successfully as admin', async () => {
    vi.mocked(prisma.restaurant.update).mockResolvedValue({
      id: 1,
      name: 'Updated Restaurant',
      address: '456 Oak St',
      cuisine: 'japanese',
      notes: 'Great sushi',
    } as never);

    const result = await (updateRestaurant as ServerFn)({
      data: {
        id: 1,
        name: 'Updated Restaurant',
        address: '456 Oak St',
        cuisine: 'japanese',
        notes: 'Great sushi',
        token: 'token',
      },
    });

    expect(prisma.restaurant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ name: 'Updated Restaurant' }),
      })
    );
    expect(result).toEqual(expect.objectContaining({ id: 1, name: 'Updated Restaurant' }));
  });

  it('updates restaurant with partial data', async () => {
    vi.mocked(prisma.restaurant.update).mockResolvedValue({
      id: 1,
      name: 'Original Name',
      address: 'New Address',
    } as never);

    const result = await (updateRestaurant as ServerFn)({
      data: { id: 1, address: 'New Address', token: 'token' },
    });

    expect(prisma.restaurant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ address: 'New Address' }),
      })
    );
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    await expect(
      (updateRestaurant as ServerFn)({ data: { id: 1, name: 'Updated', token: 'token' } })
    ).rejects.toThrow('Admin access required');
  });

  it('updates restaurant with only name', async () => {
    vi.mocked(prisma.restaurant.update).mockResolvedValue({ id: 1 } as never);

    await (updateRestaurant as ServerFn)({
      data: { id: 1, name: 'Only Name', token: 'token' },
    });

    expect(prisma.restaurant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Only Name' }),
      })
    );
  });

  it('updates restaurant with empty string fields converted to null', async () => {
    vi.mocked(prisma.restaurant.update).mockResolvedValue({ id: 1 } as never);

    await (updateRestaurant as ServerFn)({
      data: {
        id: 1,
        name: 'Only Name',
        address: '',
        cuisine: '',
        notes: '',
        token: 'token',
      },
    });

    expect(prisma.restaurant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Only Name',
          address: null,
          notes: null,
        }),
      })
    );
  });

  it('handles prisma update error', async () => {
    vi.mocked(prisma.restaurant.update).mockRejectedValue(new Error('db fail'));

    await expect(
      (updateRestaurant as ServerFn)({ data: { id: 1, name: 'Updated', token: 'token' } })
    ).rejects.toThrow('Failed to update restaurant');
  });
});

describe('deleteRestaurant', () => {
  beforeEach(() => {
    vi.mocked(requireAdminFromCookie).mockResolvedValue({ id: 1, isAdmin: true } as never);
  });

  it('deletes restaurant successfully as admin', async () => {
    vi.mocked(validateRestaurantForDeletion).mockResolvedValue(undefined);
    vi.mocked(prisma.restaurant.delete).mockResolvedValue({ id: 1 } as never);

    const result = await (deleteRestaurant as ServerFn)({ data: { id: 1, token: 'token' } });

    expect(validateRestaurantForDeletion).toHaveBeenCalledWith(1);
    expect(prisma.restaurant.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual({ success: true });
  });

  it('rejects deletion when restaurant has expenses', async () => {
    vi.mocked(validateRestaurantForDeletion).mockImplementation(() => {
      throw new Error('Cannot delete restaurant with existing expenses');
    });

    await expect(
      (deleteRestaurant as ServerFn)({ data: { id: 1, token: 'token' } })
    ).rejects.toThrow('Failed to delete restaurant');
  });

  it('rejects non-admin users', async () => {
    vi.mocked(requireAdminFromCookie).mockRejectedValue(new Error('Admin access required'));

    await expect(
      (deleteRestaurant as ServerFn)({ data: { id: 1, token: 'token' } })
    ).rejects.toThrow('Admin access required');
  });
});
