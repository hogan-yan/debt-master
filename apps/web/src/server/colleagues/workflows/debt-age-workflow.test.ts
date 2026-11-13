import { describe, expect, it } from 'vitest';
import { type ColleagueDebtTransaction, calculateDebtAge } from './debt-age-workflow';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function tx(
  type: 'expense' | 'payment',
  amount: number,
  daysAgoN: number
): ColleagueDebtTransaction {
  return { type, amount, date: daysAgo(daysAgoN) };
}

describe('calculateDebtAge', () => {
  it('returns null for empty transactions', () => {
    const result = calculateDebtAge([]);
    expect(result.debtAgeDays).toBeNull();
  });

  it('returns null when balance has never been negative', () => {
    const result = calculateDebtAge([tx('payment', 100, 10), tx('payment', 50, 5)]);
    expect(result.debtAgeDays).toBeNull();
  });

  it('returns days since first expense when only expenses exist', () => {
    const result = calculateDebtAge([tx('expense', 50, 30)]);
    expect(result.debtAgeDays).toBe(30);
  });

  it('returns null when payment fully covers expenses', () => {
    const result = calculateDebtAge([tx('expense', 50, 10), tx('payment', 50, 5)]);
    expect(result.debtAgeDays).toBeNull();
  });

  it('returns days since balance went negative after multiple transactions', () => {
    const result = calculateDebtAge([
      tx('payment', 20, 20),
      tx('expense', 50, 15),
      tx('expense', 30, 10),
    ]);
    // After payment +20, then expense -50 → balance -30 at day 15, then -60 at day 10
    // Balance never recovered, debt since day 15
    expect(result.debtAgeDays).toBe(15);
  });

  it('resets debt age when balance recovers to zero', () => {
    const result = calculateDebtAge([tx('expense', 50, 20), tx('payment', 50, 10)]);
    // -50 at day 20, then +50 at day 10 → balance 0, recovered
    expect(result.debtAgeDays).toBeNull();
  });

  it('resets debt age when balance recovers to positive', () => {
    const result = calculateDebtAge([tx('expense', 50, 20), tx('payment', 80, 10)]);
    // -50 at day 20, then +80 at day 10 → balance +30, recovered
    expect(result.debtAgeDays).toBeNull();
  });

  it('tracks debt age from most recent negative period', () => {
    const result = calculateDebtAge([
      tx('expense', 50, 30), // balance: -50
      tx('payment', 60, 25), // balance: +10 (recovered)
      tx('expense', 40, 10), // balance: -30 (new debt period)
    ]);
    // First debt period recovered, second started at day 10
    expect(result.debtAgeDays).toBe(10);
  });

  it('handles single payment (positive balance, returns null)', () => {
    const result = calculateDebtAge([tx('payment', 100, 5)]);
    expect(result.debtAgeDays).toBeNull();
  });

  it('handles floating point near-zero correctly', () => {
    const result = calculateDebtAge([tx('expense', 33.33, 5), tx('payment', 33.33, 3)]);
    // balance: -33.33 + 33.33 = 0.0 → recovered
    expect(result.debtAgeDays).toBeNull();
  });

  it('handles floating point slightly negative (still in debt)', () => {
    const result = calculateDebtAge([tx('expense', 33.34, 5), tx('payment', 33.33, 3)]);
    // balance: -33.34 + 33.33 = -0.01 → still in debt
    expect(result.debtAgeDays).toBe(5);
  });

  it('returns correct debt age for same-day transactions', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const result = calculateDebtAge([
      { type: 'expense', amount: 50, date: new Date(today) },
      { type: 'expense', amount: 30, date: new Date(today) },
    ]);
    // Both same day, balance went negative today
    expect(result.debtAgeDays).toBe(0);
  });

  // DEBTM-114: Historical pattern data
  describe('historical patterns', () => {
    it('returns longestDebtPeriod in days', () => {
      // Debt from day 30 to day 10 (20 days), then recovered, then debt from day 5 to now (5 days)
      const result = calculateDebtAge([
        tx('expense', 50, 30), // debt starts day 30
        tx('payment', 50, 10), // recovered at day 10 → 20-day debt period
        tx('expense', 30, 5), // new debt at day 5 → ongoing
      ]);
      expect(result.longestDebtPeriod).toBe(20);
    });

    it('returns timesInDebt count', () => {
      const result = calculateDebtAge([
        tx('expense', 50, 30), // debt period 1
        tx('payment', 60, 20), // recovered → period 1 ends
        tx('expense', 40, 10), // debt period 2
        tx('payment', 50, 5), // recovered → period 2 ends
      ]);
      expect(result.timesInDebt).toBe(2);
    });

    it('returns averageDebtDuration across all debt periods', () => {
      // Period 1: day 30 → day 20 = 10 days
      // Period 2: day 10 → day 5 = 5 days
      // Average = (10 + 5) / 2 = 7.5
      const result = calculateDebtAge([
        tx('expense', 50, 30),
        tx('payment', 50, 20), // recovered
        tx('expense', 30, 10),
        tx('payment', 30, 5), // recovered
      ]);
      expect(result.averageDebtDuration).toBe(7.5);
    });

    it('returns null for historical fields when never in debt', () => {
      const result = calculateDebtAge([tx('payment', 100, 10)]);
      expect(result.longestDebtPeriod).toBeNull();
      expect(result.timesInDebt).toBe(0);
      expect(result.averageDebtDuration).toBeNull();
    });

    it('counts ongoing debt period in timesInDebt but not in averageDebtDuration', () => {
      // Period 1: day 20 → day 10 = 10 days (ended)
      // Period 2: day 5 → now (ongoing, not counted in average)
      const result = calculateDebtAge([
        tx('expense', 50, 20),
        tx('payment', 50, 10), // recovered
        tx('expense', 30, 5), // ongoing debt
      ]);
      expect(result.timesInDebt).toBe(2);
      expect(result.averageDebtDuration).toBe(10);
    });
  });
});
