import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockTx } from '@/test/helpers/mock-transaction';
import { type CreateColleagueInput, createColleagueWorkflow } from './create-colleague-workflow';

describe('createColleagueWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let colleagueCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    colleagueCreate = vi.fn();
    mockTx = createMockTx({
      colleague: {
        create: colleagueCreate,
      },
    });
    vi.clearAllMocks();
  });

  const defaultInput: CreateColleagueInput = {
    name: 'Alice',
  };

  it('should create a colleague with the given name', async () => {
    colleagueCreate.mockResolvedValue({
      id: 1,
      name: 'Alice',
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date('2026-01-15'),
    });

    const result = await createColleagueWorkflow(mockTx, defaultInput);

    expect(colleagueCreate).toHaveBeenCalledWith({
      data: { name: 'Alice' },
    });
    expect(result).toEqual({
      id: 1,
      name: 'Alice',
    });
  });

  it('should propagate error when Prisma create fails', async () => {
    colleagueCreate.mockRejectedValue(new Error('Unique constraint failed'));

    await expect(createColleagueWorkflow(mockTx, defaultInput)).rejects.toThrow(
      'Unique constraint failed'
    );
  });
});
