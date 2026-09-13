import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockTx } from '@/test/helpers/mock-transaction';
import {
  type PermanentDeleteColleagueInput,
  permanentDeleteColleagueWorkflow,
} from './permanent-delete-colleague-workflow';

describe('permanentDeleteColleagueWorkflow', () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let colleagueFindFirst: ReturnType<typeof vi.fn>;
  let colleagueDelete: ReturnType<typeof vi.fn>;
  let expenseParticipantCount: ReturnType<typeof vi.fn>;
  let paymentCount: ReturnType<typeof vi.fn>;
  let expenseItemCount: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    colleagueFindFirst = vi.fn();
    colleagueDelete = vi.fn();
    expenseParticipantCount = vi.fn().mockResolvedValue(0);
    paymentCount = vi.fn().mockResolvedValue(0);
    expenseItemCount = vi.fn().mockResolvedValue(0);
    mockTx = createMockTx({
      colleague: {
        findFirst: colleagueFindFirst,
        delete: colleagueDelete,
      },
      expenseParticipant: { count: expenseParticipantCount },
      payment: { count: paymentCount },
      expenseItem: { count: expenseItemCount },
    });
  });

  const defaultInput: PermanentDeleteColleagueInput = { id: 1 };

  it('should hard delete when no related records exist', async () => {
    colleagueFindFirst.mockResolvedValue({ id: 1, name: 'Alice', deletedAt: new Date() });
    colleagueDelete.mockResolvedValue({ id: 1, name: 'Alice' });

    const result = await permanentDeleteColleagueWorkflow(mockTx, defaultInput);

    expect(result).toEqual({ id: 1, name: 'Alice' });
    expect(colleagueDelete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('should block when expense participants exist', async () => {
    colleagueFindFirst.mockResolvedValue({ id: 1, name: 'Alice', deletedAt: new Date() });
    expenseParticipantCount.mockResolvedValue(3);

    await expect(permanentDeleteColleagueWorkflow(mockTx, defaultInput)).rejects.toThrow(
      'expense participant'
    );
  });

  it('should block when payments exist', async () => {
    colleagueFindFirst.mockResolvedValue({ id: 1, name: 'Alice', deletedAt: new Date() });
    paymentCount.mockResolvedValue(2);

    await expect(permanentDeleteColleagueWorkflow(mockTx, defaultInput)).rejects.toThrow('payment');
  });

  it('should block when expense items exist', async () => {
    colleagueFindFirst.mockResolvedValue({ id: 1, name: 'Alice', deletedAt: new Date() });
    expenseItemCount.mockResolvedValue(1);

    await expect(permanentDeleteColleagueWorkflow(mockTx, defaultInput)).rejects.toThrow(
      'expense item'
    );
  });

  it('should throw when colleague does not exist', async () => {
    colleagueFindFirst.mockResolvedValue(null);

    await expect(permanentDeleteColleagueWorkflow(mockTx, { id: 999 })).rejects.toThrow(
      'Colleague not found'
    );
  });

  it('should throw when colleague is not archived', async () => {
    colleagueFindFirst.mockResolvedValue(null);

    await expect(permanentDeleteColleagueWorkflow(mockTx, defaultInput)).rejects.toThrow(
      'Colleague not found'
    );
  });
});
