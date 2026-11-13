import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockTx } from '@/test/helpers/mock-transaction';
import { getActiveColleaguesWorkflow } from './workflows/active-colleague-workflow';

describe('getActiveColleaguesWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let colleagueFindMany: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    colleagueFindMany = vi.fn();
    mockTx = createMockTx({
      colleague: {
        findMany: colleagueFindMany,
      },
    });
    vi.clearAllMocks();
  });

  it('should return only active (non-deleted) colleagues', async () => {
    const activeColleagues = [
      { id: 1, name: 'Alice', createdAt: new Date('2024-01-15') },
      { id: 2, name: 'Bob', createdAt: new Date('2024-01-16') },
    ];

    colleagueFindMany.mockResolvedValue(activeColleagues);

    const result = await getActiveColleaguesWorkflow(mockTx);

    expect(result).toHaveLength(2);
    expect(colleagueFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  });

  it('should return empty array when no active colleagues', async () => {
    colleagueFindMany.mockResolvedValue([]);

    const result = await getActiveColleaguesWorkflow(mockTx);

    expect(result).toEqual([]);
  });
});
