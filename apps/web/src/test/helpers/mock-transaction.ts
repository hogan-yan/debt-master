import { Prisma } from '@prisma/client';
import { vi } from 'vitest';

type MockFn = ReturnType<typeof vi.fn>;

interface ModelMock {
  findMany?: MockFn;
  findUnique?: MockFn;
  findFirst?: MockFn;
  findFirstOrThrow?: MockFn;
  findUniqueOrThrow?: MockFn;
  create?: MockFn;
  update?: MockFn;
  updateMany?: MockFn;
  delete?: MockFn;
  deleteMany?: MockFn;
  count?: MockFn;
  groupBy?: MockFn;
  aggregate?: MockFn;
  upsert?: MockFn;
  createMany?: MockFn;
}

type ModelMocks = Partial<Record<keyof Prisma.TransactionClient, ModelMock>>;

/**
 * Raw SQL query/execute mocks. Money workflows acquire a colleague row-lock via
 * `$queryRaw\`SELECT ... FOR UPDATE\``, so any unit test that exercises a
 * locking workflow must back that call. Use {@link createLockRawMocks} to opt in.
 */
interface RawMocks {
  $queryRaw?: MockFn;
  $executeRaw?: MockFn;
}

/**
 * Creates a mock Prisma.TransactionClient for workflow tests.
 *
 * Instead of manually defining mock objects and casting with `as unknown as Prisma.TransactionClient`,
 * use this helper to get proper typing.
 *
 * Raw queries ($queryRaw / $executeRaw) are NOT mocked by default. This is
 * deliberate: a resolving default would silently hide any workflow that starts
 * issuing a new raw query. Workflows that lock (`withColleagueLock`) must opt in
 * via {@link createLockRawMocks} so the `$queryRaw FOR UPDATE` resolves.
 *
 * Usage:
 * ```typescript
 * const mockTx = createMockTx({
 *   expense: {
 *     findUnique: vi.fn().mockResolvedValue(mockExpense),
 *     delete: vi.fn().mockResolvedValue({ id: 1 }),
 *   },
 *   expenseParticipant: {
 *     deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
 *   },
 * });
 *
 * // No double-cast needed
 * await deleteExpenseWorkflow(mockTx, {}, { id: 1 });
 * ```
 *
 * Money / locking workflow:
 * ```typescript
 * const mockTx = createMockTx({ payment: { create: vi.fn() } }, createLockRawMocks());
 * ```
 */
export function createMockTx(models: ModelMocks, raw: RawMocks = {}): Prisma.TransactionClient {
  return {
    ...models,
    ...raw,
  } as unknown as Prisma.TransactionClient;
}

/**
 * Raw-query mocks backing the tx-lock helpers (`SELECT ... FOR UPDATE`). Pass to
 * {@link createMockTx} as the second argument for any test whose workflow calls
 * `withColleagueLock` / `lockColleagueForUpdate`.
 */
export function createLockRawMocks(): RawMocks {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
  };
}
