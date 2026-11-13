import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autoApplyPrepaymentWorkflow } from '../../payments/workflows/auto-apply-prepayment-workflow';
import {
  AutoApplyPrepaymentsInput,
  autoApplyPrepaymentsForExpenseWorkflow,
} from './auto-apply-prepayments-for-expense-workflow';

vi.mock('../../payments/workflows/auto-apply-prepayment-workflow');

const mockedAutoApply = vi.mocked(autoApplyPrepaymentWorkflow);

const createMockApplication = (
  overrides: Partial<Prisma.PaymentApplicationGetPayload<object>> = {}
): Prisma.PaymentApplicationGetPayload<object> => ({
  id: 1,
  createdAt: new Date(),
  amount: new Prisma.Decimal('50.00'),
  expenseId: 1,
  paymentId: 1,
  participantId: 1,
  appliedAt: new Date(),
  ...overrides,
});

describe('autoApplyPrepaymentsForExpenseWorkflow', () => {
  const mockTx = {} as Prisma.TransactionClient;

  beforeEach(() => {
    mockedAutoApply.mockReset();
  });

  const createInput = (
    participants: AutoApplyPrepaymentsInput['participants']
  ): AutoApplyPrepaymentsInput => ({
    participants,
  });

  describe('when no prepayments are applied', () => {
    it('returns undefined for empty participants', async () => {
      const result = await autoApplyPrepaymentsForExpenseWorkflow(mockTx, createInput([]));

      expect(result).toBeUndefined();
      expect(mockedAutoApply).not.toHaveBeenCalled();
    });

    it('returns undefined when all participants have zero applied amount', async () => {
      mockedAutoApply.mockResolvedValue({
        totalApplied: 0n,
        applications: [],
        remainingBalance: 0n,
      });

      const result = await autoApplyPrepaymentsForExpenseWorkflow(
        mockTx,
        createInput([
          { colleagueId: 1, amount: new Prisma.Decimal('50.00') },
          { colleagueId: 2, amount: new Prisma.Decimal('75.00') },
        ])
      );

      expect(result).toBeUndefined();
      expect(mockedAutoApply).toHaveBeenCalledTimes(2);
    });
  });

  describe('when prepayments are applied', () => {
    it('returns applications for a single participant', async () => {
      mockedAutoApply.mockResolvedValue({
        totalApplied: 5000n,
        applications: [createMockApplication()],
        remainingBalance: 0n,
      });

      const result = await autoApplyPrepaymentsForExpenseWorkflow(
        mockTx,
        createInput([{ colleagueId: 1, amount: new Prisma.Decimal('50.00') }])
      );

      expect(result).toEqual({
        autoApplications: [{ colleagueId: 1, appliedAmount: 50 }],
        totalAutoApplied: 50,
      });
      expect(mockedAutoApply).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          colleagueId: 1,
          maxAmount: 50,
        })
      );
    });

    it('returns applications for multiple participants', async () => {
      mockedAutoApply
        .mockResolvedValueOnce({
          totalApplied: 5000n,
          applications: [createMockApplication()],
          remainingBalance: 1000n,
        })
        .mockResolvedValueOnce({
          totalApplied: 7500n,
          applications: [createMockApplication({ id: 2, amount: new Prisma.Decimal('75.00') })],
          remainingBalance: 0n,
        });

      const result = await autoApplyPrepaymentsForExpenseWorkflow(
        mockTx,
        createInput([
          { colleagueId: 1, amount: new Prisma.Decimal('50.00') },
          { colleagueId: 2, amount: new Prisma.Decimal('75.00') },
        ])
      );

      expect(result).toEqual({
        autoApplications: [
          { colleagueId: 1, appliedAmount: 50 },
          { colleagueId: 2, appliedAmount: 75 },
        ],
        totalAutoApplied: 125,
      });
      expect(mockedAutoApply).toHaveBeenCalledTimes(2);
    });

    it('filters out participants with zero applied amount', async () => {
      mockedAutoApply
        .mockResolvedValueOnce({
          totalApplied: 5000n,
          applications: [createMockApplication()],
          remainingBalance: 0n,
        })
        .mockResolvedValueOnce({
          totalApplied: 0n,
          applications: [],
          remainingBalance: 100n,
        });

      const result = await autoApplyPrepaymentsForExpenseWorkflow(
        mockTx,
        createInput([
          { colleagueId: 1, amount: new Prisma.Decimal('50.00') },
          { colleagueId: 2, amount: new Prisma.Decimal('75.00') },
        ])
      );

      expect(result).toEqual({
        autoApplications: [{ colleagueId: 1, appliedAmount: 50 }],
        totalAutoApplied: 50,
      });
    });

    it('sums totalAutoApplied across all participants', async () => {
      mockedAutoApply
        .mockResolvedValueOnce({ totalApplied: 1000n, applications: [], remainingBalance: 0n })
        .mockResolvedValueOnce({ totalApplied: 2000n, applications: [], remainingBalance: 0n })
        .mockResolvedValueOnce({ totalApplied: 3000n, applications: [], remainingBalance: 0n });

      const result = await autoApplyPrepaymentsForExpenseWorkflow(
        mockTx,
        createInput([
          { colleagueId: 1, amount: new Prisma.Decimal('10.00') },
          { colleagueId: 2, amount: new Prisma.Decimal('20.00') },
          { colleagueId: 3, amount: new Prisma.Decimal('30.00') },
        ])
      );

      expect(result).toBeDefined();
      expect(result!.totalAutoApplied).toBe(60);
      expect(result!.autoApplications).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    it('continues processing when individual participants fail (errors intentionally silent)', async () => {
      mockedAutoApply.mockRejectedValueOnce(new Error('Database timeout')).mockResolvedValueOnce({
        totalApplied: 7500n,
        applications: [createMockApplication({ id: 2, amount: new Prisma.Decimal('75.00') })],
        remainingBalance: 0n,
      });

      const result = await autoApplyPrepaymentsForExpenseWorkflow(
        mockTx,
        createInput([
          { colleagueId: 1, amount: new Prisma.Decimal('50.00') },
          { colleagueId: 2, amount: new Prisma.Decimal('75.00') },
        ])
      );

      expect(result).toEqual({
        autoApplications: [{ colleagueId: 2, appliedAmount: 75 }],
        totalAutoApplied: 75,
      });
      expect(mockedAutoApply).toHaveBeenCalledTimes(2);
    });

    it('returns undefined when all participants fail', async () => {
      mockedAutoApply.mockRejectedValue(new Error('Database timeout'));

      const result = await autoApplyPrepaymentsForExpenseWorkflow(
        mockTx,
        createInput([
          { colleagueId: 1, amount: new Prisma.Decimal('50.00') },
          { colleagueId: 2, amount: new Prisma.Decimal('75.00') },
        ])
      );

      expect(result).toBeUndefined();
      expect(mockedAutoApply).toHaveBeenCalledTimes(2);
    });
  });
});
