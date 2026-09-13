import { describe, expect, it } from 'vitest';
import {
  computeDetailMetrics,
  type DetailMetricsInput,
} from './workflows/colleague-detail-metrics-workflow';

describe('computeDetailMetrics', () => {
  const baseInput: DetailMetricsInput = {
    totalOwed: 0,
    totalPaid: 0,
    expenseCount: 0,
    paymentCount: 0,
    transactions: [],
    lastExpenseDate: null,
    lastPaymentDate: null,
  };

  it('returns zeroed metrics for colleague with no transactions', () => {
    const result = computeDetailMetrics(baseInput);
    expect(result.totalOwed).toBe(0);
    expect(result.totalPaid).toBe(0);
    expect(result.currentBalance).toBe(0);
    expect(result.debtAgeDays).toBeNull();
    expect(result.lastActivityDate).toBeNull();
    expect(result.expenseCount).toBe(0);
    expect(result.paymentCount).toBe(0);
  });

  it('calculates totalOwed from expense participants', () => {
    const result = computeDetailMetrics({ ...baseInput, totalOwed: 150 });
    expect(result.totalOwed).toBe(150);
  });

  it('calculates totalPaid from payments', () => {
    const result = computeDetailMetrics({ ...baseInput, totalPaid: 80 });
    expect(result.totalPaid).toBe(80);
  });

  it('calculates currentBalance as totalPaid - totalOwed', () => {
    const result = computeDetailMetrics({ ...baseInput, totalOwed: 100, totalPaid: 60 });
    expect(result.currentBalance).toBe(-40);
  });

  it('computes debtAgeDays using calculateDebtAge', () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const result = computeDetailMetrics({
      ...baseInput,
      totalOwed: 100,
      totalPaid: 0,
      transactions: [{ type: 'expense', amount: 100, date: fiveDaysAgo }],
    });
    expect(result.debtAgeDays).toBe(5);
  });

  it('returns null debtAgeDays when colleague is not in debt', () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const result = computeDetailMetrics({
      ...baseInput,
      totalOwed: 50,
      totalPaid: 80,
      transactions: [
        { type: 'expense', amount: 50, date: tenDaysAgo },
        { type: 'payment', amount: 80, date: tenDaysAgo },
      ],
    });
    expect(result.debtAgeDays).toBeNull();
  });

  it('computes lastActivityDate from most recent transaction', () => {
    const expenseDate = new Date('2026-01-15');
    const paymentDate = new Date('2026-03-20');
    const result = computeDetailMetrics({
      ...baseInput,
      lastExpenseDate: expenseDate,
      lastPaymentDate: paymentDate,
    });
    expect(result.lastActivityDate).toEqual(paymentDate);
  });

  it('uses expense date when no payments', () => {
    const expenseDate = new Date('2026-02-10');
    const result = computeDetailMetrics({
      ...baseInput,
      lastExpenseDate: expenseDate,
      lastPaymentDate: null,
    });
    expect(result.lastActivityDate).toEqual(expenseDate);
  });

  it('uses payment date when no expenses', () => {
    const paymentDate = new Date('2026-03-01');
    const result = computeDetailMetrics({
      ...baseInput,
      lastExpenseDate: null,
      lastPaymentDate: paymentDate,
    });
    expect(result.lastActivityDate).toEqual(paymentDate);
  });

  it('returns correct expense and payment counts', () => {
    const result = computeDetailMetrics({
      ...baseInput,
      expenseCount: 7,
      paymentCount: 3,
    });
    expect(result.expenseCount).toBe(7);
    expect(result.paymentCount).toBe(3);
  });

  // DEBTM-117: AR aging buckets
  describe('aging buckets', () => {
    it('returns agingBuckets with all required fields', () => {
      const result = computeDetailMetrics({
        ...baseInput,
        totalOwed: 100,
        totalPaid: 0,
      });
      expect(result.agingBuckets).toBeDefined();
      expect(result.agingBuckets).toHaveProperty('current');
      expect(result.agingBuckets).toHaveProperty('days1to30');
      expect(result.agingBuckets).toHaveProperty('days31to60');
      expect(result.agingBuckets).toHaveProperty('days61to90');
      expect(result.agingBuckets).toHaveProperty('days90plus');
    });

    it('categorizes expense from 10 days ago into 1-30 bucket', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const result = computeDetailMetrics({
        ...baseInput,
        totalOwed: 50,
        totalPaid: 0,
        transactions: [{ type: 'expense', amount: 50, date: tenDaysAgo }],
      });
      expect(result.agingBuckets.days1to30).toBe(50);
      expect(result.agingBuckets.current).toBe(0);
      expect(result.agingBuckets.days31to60).toBe(0);
    });

    it('categorizes expense from 45 days ago into 31-60 bucket', () => {
      const fortyFiveDaysAgo = new Date();
      fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
      const result = computeDetailMetrics({
        ...baseInput,
        totalOwed: 80,
        totalPaid: 0,
        transactions: [{ type: 'expense', amount: 80, date: fortyFiveDaysAgo }],
      });
      expect(result.agingBuckets.days31to60).toBe(80);
    });

    it('categorizes expense from 75 days ago into 61-90 bucket', () => {
      const seventyFiveDaysAgo = new Date();
      seventyFiveDaysAgo.setDate(seventyFiveDaysAgo.getDate() - 75);
      const result = computeDetailMetrics({
        ...baseInput,
        totalOwed: 120,
        totalPaid: 0,
        transactions: [{ type: 'expense', amount: 120, date: seventyFiveDaysAgo }],
      });
      expect(result.agingBuckets.days61to90).toBe(120);
    });

    it('categorizes expense from 120 days ago into 90+ bucket', () => {
      const hundredTwentyDaysAgo = new Date();
      hundredTwentyDaysAgo.setDate(hundredTwentyDaysAgo.getDate() - 120);
      const result = computeDetailMetrics({
        ...baseInput,
        totalOwed: 200,
        totalPaid: 0,
        transactions: [{ type: 'expense', amount: 200, date: hundredTwentyDaysAgo }],
      });
      expect(result.agingBuckets.days90plus).toBe(200);
    });

    it('puts today expense into current bucket', () => {
      const result = computeDetailMetrics({
        ...baseInput,
        totalOwed: 30,
        totalPaid: 0,
        transactions: [{ type: 'expense', amount: 30, date: new Date() }],
      });
      expect(result.agingBuckets.current).toBe(30);
    });

    it('sums amounts across multiple expenses in same bucket', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      const result = computeDetailMetrics({
        ...baseInput,
        totalOwed: 90,
        totalPaid: 0,
        transactions: [
          { type: 'expense', amount: 40, date: tenDaysAgo },
          { type: 'expense', amount: 50, date: twentyDaysAgo },
        ],
      });
      expect(result.agingBuckets.days1to30).toBe(90);
    });

    it('returns all zeros for no transactions', () => {
      const result = computeDetailMetrics(baseInput);
      expect(result.agingBuckets).toEqual({
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
      });
    });
  });
});
