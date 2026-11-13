import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockTx } from '@/test/helpers/mock-transaction';
import { updateColleagueWorkflow } from './update-colleague-workflow';

describe('updateColleagueWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let colleagueUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    colleagueUpdate = vi.fn();
    mockTx = createMockTx({
      colleague: {
        update: colleagueUpdate,
      },
    });
    vi.clearAllMocks();
  });

  it('should update a colleague name', async () => {
    colleagueUpdate.mockResolvedValue({
      id: 1,
      name: 'Alice Updated',
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date('2026-01-15'),
    });

    const result = await updateColleagueWorkflow(mockTx, {
      id: 1,
      name: 'Alice Updated',
    });

    expect(colleagueUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Alice Updated' },
    });
    expect(result).toEqual({
      id: 1,
      name: 'Alice Updated',
    });
  });

  it('should propagate error when colleague does not exist', async () => {
    colleagueUpdate.mockRejectedValue(new Error('Record to update not found'));

    await expect(updateColleagueWorkflow(mockTx, { id: 999, name: 'X' })).rejects.toThrow(
      'Record to update not found'
    );
  });
});
