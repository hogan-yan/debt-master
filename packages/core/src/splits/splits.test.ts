import { describe, expect, it } from 'vitest';
import { asMoneyMinor } from '../money/parse';
import { type MoneyMinor } from '../money/types';
import {
  bpsToPercentString,
  PERCENT_SCALE,
  SplitError,
  splitEqual,
  splitExact,
  splitItemized,
  splitPercent,
  splitShares,
  withinThreshold,
} from './index';

type MemberId = string & { readonly __brand: 'MemberId' };
const m = (s: string): MemberId => s as MemberId;
const money = (n: bigint): MoneyMinor => asMoneyMinor(n);

const sum = (map: Map<unknown, MoneyMinor>): bigint =>
  [...map.values()].reduce((acc, v) => acc + BigInt(v), 0n);

describe('bpsToPercentString', () => {
  it('renders whole percents without a fraction (frac === 0)', () => {
    expect(bpsToPercentString(10_000n)).toBe('100');
    expect(bpsToPercentString(0n)).toBe('0');
    expect(bpsToPercentString(5_000n)).toBe('50');
  });

  it('drops a single trailing zero (frac ends in 0)', () => {
    expect(bpsToPercentString(3_350n)).toBe('33.5'); // frac 50 → "33.5"
    expect(bpsToPercentString(5_050n)).toBe('50.5'); // frac 50 → "50.5"
  });

  it('keeps two digits when frac has no trailing zero', () => {
    expect(bpsToPercentString(3_333n)).toBe('33.33');
    expect(bpsToPercentString(3_337n)).toBe('33.37');
  });

  it('left-pads a single-digit frac (frac < 10)', () => {
    expect(bpsToPercentString(3_001n)).toBe('30.01'); // frac 1 → "01"
  });
});

describe('splitEqual', () => {
  it('splits evenly with remainder to participant[0]', () => {
    const total = money(100n); // 1.00 USD
    const result = splitEqual(total, [m('a'), m('b'), m('c')]);
    // 100 / 3 = 33 each, remainder 1 → a gets 34
    expect(BigInt(result.get(m('a')) ?? 0n)).toBe(34n);
    expect(BigInt(result.get(m('b')) ?? 0n)).toBe(33n);
    expect(BigInt(result.get(m('c')) ?? 0n)).toBe(33n);
    expect(sum(result)).toBe(100n);
  });

  it('single participant gets everything', () => {
    const result = splitEqual(money(99n), [m('a')]);
    expect(BigInt(result.get(m('a')) ?? 0n)).toBe(99n);
    expect(sum(result)).toBe(99n);
  });

  it('property: sums exactly to total over a range', () => {
    for (let n = 1n; n <= 6n; n++) {
      const ids = Array.from({ length: Number(n) }, (_, i) => m(`p${i}`));
      for (let total = 0; total <= 5000; total += 7) {
        const result = splitEqual(money(BigInt(total)), ids);
        expect(sum(result)).toBe(BigInt(total));
      }
    }
  });

  it('throws on zero participants', () => {
    expect(() => splitEqual(money(100n), [])).toThrow(SplitError);
  });
});

describe('splitPercent', () => {
  it('splits by basis points with remainder to [0]', () => {
    // 50% / 50% of 1.00 = 50/50
    const result = splitPercent(money(100n), [
      { id: m('a'), percentBasisPoints: 5_000n },
      { id: m('b'), percentBasisPoints: 5_000n },
    ]);
    expect(BigInt(result.get(m('a')) ?? 0n)).toBe(50n);
    expect(BigInt(result.get(m('b')) ?? 0n)).toBe(50n);
    expect(sum(result)).toBe(100n);
  });

  it('handles uneven percentages exactly', () => {
    // 33.33% / 33.33% / 33.34% of 1.00
    const result = splitPercent(money(100n), [
      { id: m('a'), percentBasisPoints: 3_333n },
      { id: m('b'), percentBasisPoints: 3_333n },
      { id: m('c'), percentBasisPoints: 3_334n },
    ]);
    expect(sum(result)).toBe(100n);
  });

  it('property: sums exactly to total over a range', () => {
    for (let total = 0; total <= 5000; total += 11) {
      const result = splitPercent(money(BigInt(total)), [
        { id: m('a'), percentBasisPoints: 3_333n },
        { id: m('b'), percentBasisPoints: 3_333n },
        { id: m('c'), percentBasisPoints: 3_334n },
      ]);
      expect(sum(result)).toBe(BigInt(total));
    }
  });

  it('throws when bps do not sum to PERCENT_SCALE', () => {
    expect(() => splitPercent(money(100n), [{ id: m('a'), percentBasisPoints: 5_000n }])).toThrow(
      SplitError
    );
  });

  it('throws on negative percent', () => {
    expect(() =>
      splitPercent(money(100n), [
        { id: m('a'), percentBasisPoints: 12_000n },
        { id: m('b'), percentBasisPoints: -2_000n },
      ])
    ).toThrow(SplitError);
  });

  it('throws on zero participants', () => {
    expect(() => splitPercent(money(100n), [])).toThrow(SplitError);
  });

  it('rejects duplicate participant ids (assertUniqueIds)', () => {
    // Valid percent sum (100%), but the same id twice → must throw before any
    // math, else a Map keyed by id would silently drop one share.
    expect(() =>
      splitPercent(money(100n), [
        { id: m('a'), percentBasisPoints: 5_000n },
        { id: m('a'), percentBasisPoints: 5_000n },
      ])
    ).toThrow(SplitError);
  });

  it('exports PERCENT_SCALE constant', () => {
    expect(PERCENT_SCALE).toBe(10_000n);
  });
});

describe('splitShares', () => {
  it('splits by integer weight', () => {
    // weights 1:2:3 of 60 → 10/20/30
    const result = splitShares(money(60n), [
      { id: m('a'), weight: 1n },
      { id: m('b'), weight: 2n },
      { id: m('c'), weight: 3n },
    ]);
    expect(BigInt(result.get(m('a')) ?? 0n)).toBe(10n);
    expect(BigInt(result.get(m('b')) ?? 0n)).toBe(20n);
    expect(BigInt(result.get(m('c')) ?? 0n)).toBe(30n);
    expect(sum(result)).toBe(60n);
  });

  it('property: sums exactly to total over a range', () => {
    for (let total = 0; total <= 5000; total += 13) {
      const result = splitShares(money(BigInt(total)), [
        { id: m('a'), weight: 2n },
        { id: m('b'), weight: 3n },
      ]);
      expect(sum(result)).toBe(BigInt(total));
    }
  });

  it('allows zero-weight members', () => {
    const result = splitShares(money(100n), [
      { id: m('a'), weight: 1n },
      { id: m('b'), weight: 0n },
    ]);
    expect(BigInt(result.get(m('a')) ?? 0n)).toBe(100n);
    expect(BigInt(result.get(m('b')) ?? 0n)).toBe(0n);
  });

  it('throws when total weight is zero', () => {
    expect(() =>
      splitShares(money(100n), [
        { id: m('a'), weight: 0n },
        { id: m('b'), weight: 0n },
      ])
    ).toThrow(SplitError);
  });

  it('throws on negative weight', () => {
    expect(() =>
      splitShares(money(100n), [
        { id: m('a'), weight: 2n },
        { id: m('b'), weight: -1n },
      ])
    ).toThrow(SplitError);
  });

  it('throws on zero participants', () => {
    expect(() => splitShares(money(100n), [])).toThrow(SplitError);
  });
});

describe('splitItemized', () => {
  it('groups items by member and sums', () => {
    const result = splitItemized(money(100n), [
      { id: m('a'), amount: money(30n) },
      { id: m('b'), amount: money(70n) },
      { id: m('a'), amount: money(0n) },
    ]);
    expect(BigInt(result.get(m('a')) ?? 0n)).toBe(30n);
    expect(BigInt(result.get(m('b')) ?? 0n)).toBe(70n);
  });

  it('throws when item sum ≠ total', () => {
    expect(() => splitItemized(money(100n), [{ id: m('a'), amount: money(50n) }])).toThrow(
      SplitError
    );
  });

  it('throws on zero items', () => {
    expect(() => splitItemized(money(100n), [])).toThrow(SplitError);
  });
});

describe('splitExact', () => {
  it('assigns exact amounts', () => {
    const result = splitExact(money(100n), [
      { id: m('a'), amount: money(40n) },
      { id: m('b'), amount: money(60n) },
    ]);
    expect(BigInt(result.get(m('a')) ?? 0n)).toBe(40n);
    expect(BigInt(result.get(m('b')) ?? 0n)).toBe(60n);
  });

  it('throws when sum ≠ total', () => {
    expect(() =>
      splitExact(money(100n), [
        { id: m('a'), amount: money(40n) },
        { id: m('b'), amount: money(50n) },
      ])
    ).toThrow(SplitError);
  });

  it('throws on zero shares', () => {
    expect(() => splitExact(money(100n), [])).toThrow(SplitError);
  });
});

describe('withinThreshold', () => {
  it('true when equal', () => {
    expect(withinThreshold(money(100n), money(100n))).toBe(true);
  });

  it('true within threshold', () => {
    expect(withinThreshold(money(100n), money(101n))).toBe(true);
    expect(withinThreshold(money(101n), money(100n))).toBe(true);
  });

  it('false beyond threshold', () => {
    expect(withinThreshold(money(100n), money(102n))).toBe(false);
    expect(withinThreshold(money(102n), money(100n))).toBe(false);
  });
});
