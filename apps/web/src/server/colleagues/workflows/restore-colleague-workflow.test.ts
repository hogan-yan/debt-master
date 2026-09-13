import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockTx } from '@/test/helpers/mock-transaction';
import { type RestoreColleagueInput, restoreColleagueWorkflow } from './restore-colleague-workflow';

describe('restoreColleagueWorkflow', () => {
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

  const defaultInput: RestoreColleagueInput = { id: 1 };

  it('should clear deletedAt and deletedBy to restore a colleague', async () => {
    colleagueUpdate.mockResolvedValue({
      id: 1,
      name: 'Alice',
      deletedAt: null,
      deletedBy: null,
    });

    const result = await restoreColleagueWorkflow(mockTx, defaultInput);

    expect(colleagueUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: null, deletedBy: null },
    });
    expect(result).toEqual({ id: 1, name: 'Alice' });
  });

  it('should propagate error when colleague does not exist', async () => {
    colleagueUpdate.mockRejectedValue(new Error('Record to update not found'));

    await expect(restoreColleagueWorkflow(mockTx, { id: 999 })).rejects.toThrow(
      'Record to update not found'
    );
  });
});
