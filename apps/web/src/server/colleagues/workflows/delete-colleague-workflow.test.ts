import { describe, expect, it, vi } from 'vitest';
import { createMockTx } from '@/test/helpers/mock-transaction';
import { type DeleteColleagueInput, deleteColleagueWorkflow } from './delete-colleague-workflow';

const defaultInput: DeleteColleagueInput = {
  id: 1,
  deletedBy: 42,
};

describe('deleteColleagueWorkflow', () => {
  it('should soft-delete colleague by setting deletedAt and deletedBy', async () => {
    const mockTx = createMockTx({
      colleague: {
        update: vi.fn().mockResolvedValue({
          id: 1,
          name: 'Alice',
          deletedAt: new Date('2026-04-19T12:00:00Z'),
          deletedBy: 42,
        }),
      },
    });

    const result = await deleteColleagueWorkflow(mockTx, defaultInput);

    expect(mockTx.colleague.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        deletedBy: 42,
      }),
    });
    expect(result.id).toBe(1);
    expect(result.name).toBe('Alice');
    expect(result.deletedAt).toBeInstanceOf(Date);
  });

  it('should soft-delete without deletedBy when not provided', async () => {
    const mockTx = createMockTx({
      colleague: {
        update: vi.fn().mockResolvedValue({
          id: 1,
          name: 'Alice',
          deletedAt: new Date('2026-04-19T12:00:00Z'),
          deletedBy: null,
        }),
      },
    });

    const result = await deleteColleagueWorkflow(mockTx, {
      id: 1,
    });

    expect(mockTx.colleague.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
      }),
    });
    expect(result.deletedAt).toBeInstanceOf(Date);
  });

  it('should throw when colleague does not exist', async () => {
    const mockTx = createMockTx({
      colleague: {
        update: vi.fn().mockRejectedValue(new Error('Record to update not found')),
      },
    });

    await expect(deleteColleagueWorkflow(mockTx, defaultInput)).rejects.toThrow(
      'Record to update not found'
    );
  });
});
