import type { Prisma } from '@prisma/client';

type RestaurantPayload = Prisma.RestaurantGetPayload<object>;

export function createMockRestaurant(
  overrides: Partial<RestaurantPayload> = {}
): RestaurantPayload {
  return {
    id: 1,
    name: 'Test Restaurant',
    address: '123 Test St',
    cuisine: 'italian',
    notes: 'Test notes',
    createdAt: new Date('2024-01-15'),
    ...overrides,
  };
}

export function createMockRestaurants(count: number, startId = 1): RestaurantPayload[] {
  return Array.from({ length: count }, (_, i) =>
    createMockRestaurant({
      id: startId + i,
      name: `Restaurant ${startId + i}`,
      address: `Address ${startId + i}`,
      notes: null,
    })
  );
}
