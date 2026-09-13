import { asMoneyMinor } from '../money/parse';
import { MONEY_THRESHOLD_MINOR, type MoneyMinor } from '../money/types';

export type SplitType = 'EQUAL' | 'ITEMIZED' | 'PERCENT' | 'SHARES' | 'EXACT';

/** Basis points: 100% = 10000. Percent shares are bps to stay integer. */
export const PERCENT_SCALE = 10_000n;

export class SplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SplitError';
  }
}

/** 3350n bps → "33.5", 3333n → "33.33", 10000n → "100". For display + inputs. */
export function bpsToPercentString(bps: bigint): string {
  const whole = bps / 100n;
  const frac = bps % 100n;
  if (frac === 0n) return `${whole}`;
  const fracStr = frac.toString().padStart(2, '0');
  // Drop a single trailing zero so 50 → "33.5", keep 33 → "33.33".
  if (fracStr.endsWith('0')) return `${whole}.${fracStr[0]}`;
  return `${whole}.${fracStr}`;
}

interface WeightedShare<Id> {
  id: Id;
  numerator: bigint;
}

/**
 * Floor each proportional share, then add the rounding remainder to
 * participant [0] (per the locked money decision — ports web's
 * `calculateEqualSplit`). Σ shares === total exactly.
 *
 * Callers must validate: non-empty shares, positive denominator, non-negative
 * numerators. Keeps this helper branch-light for coverage.
 *
 * Ordering contract: the remainder (≤ participants−1 minor units) goes to
 * `shares[0]`, so the input order decides who receives it. Callers MUST pass a
 * stable order for a reproducible distribution — the expense form derives
 * participant order from the server member list (created_at asc) so the same
 * logical split always lands the remainder on the same member.
 */
function floorDistribute<Id>(
  total: MoneyMinor,
  shares: readonly WeightedShare<Id>[],
  denominator: bigint
): Map<Id, MoneyMinor> {
  const floored = shares.map((s) => ({
    id: s.id,
    share: (total * s.numerator) / denominator,
  }));
  const allocated = floored.reduce((acc, f) => acc + f.share, 0n);
  const remainder = total - allocated;

  const result = new Map<Id, MoneyMinor>();
  floored.forEach((f, i) => {
    result.set(f.id, asMoneyMinor(i === 0 ? f.share + remainder : f.share));
  });
  return result;
}

export function splitEqual<Id>(total: MoneyMinor, memberIds: readonly Id[]): Map<Id, MoneyMinor> {
  if (memberIds.length === 0) {
    throw new SplitError('Cannot split among zero participants');
  }
  assertUniqueIds(memberIds, 'splitEqual');
  return floorDistribute(
    total,
    memberIds.map((id) => ({ id, numerator: 1n })),
    BigInt(memberIds.length)
  );
}

export function splitPercent<Id>(
  total: MoneyMinor,
  shares: readonly { id: Id; percentBasisPoints: bigint }[]
): Map<Id, MoneyMinor> {
  if (shares.length === 0) {
    throw new SplitError('Cannot split among zero participants');
  }
  let sumBps = 0n;
  for (const s of shares) {
    if (s.percentBasisPoints < 0n) {
      throw new SplitError('Percent must be non-negative');
    }
    sumBps += s.percentBasisPoints;
  }
  if (sumBps !== PERCENT_SCALE) {
    throw new SplitError(`Percent shares must sum to ${PERCENT_SCALE} bps, got ${sumBps}`);
  }
  assertUniqueIds(
    shares.map((s) => s.id),
    'splitPercent'
  );
  return floorDistribute(
    total,
    shares.map((s) => ({ id: s.id, numerator: s.percentBasisPoints })),
    PERCENT_SCALE
  );
}

export function splitShares<Id>(
  total: MoneyMinor,
  shares: readonly { id: Id; weight: bigint }[]
): Map<Id, MoneyMinor> {
  if (shares.length === 0) {
    throw new SplitError('Cannot split among zero participants');
  }
  let totalWeight = 0n;
  for (const s of shares) {
    if (s.weight < 0n) {
      throw new SplitError('Share weight must be non-negative');
    }
    totalWeight += s.weight;
  }
  if (totalWeight <= 0n) {
    throw new SplitError('Share weights must sum to a positive value');
  }
  assertUniqueIds(
    shares.map((s) => s.id),
    'splitShares'
  );
  return floorDistribute(
    total,
    shares.map((s) => ({ id: s.id, numerator: s.weight })),
    totalWeight
  );
}

export function splitItemized<Id>(
  total: MoneyMinor,
  items: readonly { id: Id; amount: MoneyMinor }[]
): Map<Id, MoneyMinor> {
  if (items.length === 0) {
    throw new SplitError('Itemized split requires at least one item');
  }
  const byMember = new Map<Id, bigint>();
  let sum = 0n;
  for (const item of items) {
    const amt = BigInt(item.amount);
    byMember.set(item.id, (byMember.get(item.id) ?? 0n) + amt);
    sum += amt;
  }
  assertExactSum(sum, total, 'Itemized');
  const result = new Map<Id, MoneyMinor>();
  for (const [id, amt] of byMember) {
    result.set(id, asMoneyMinor(amt));
  }
  return result;
}

export function splitExact<Id>(
  total: MoneyMinor,
  shares: readonly { id: Id; amount: MoneyMinor }[]
): Map<Id, MoneyMinor> {
  if (shares.length === 0) {
    throw new SplitError('Exact split requires at least one share');
  }
  assertUniqueIds(
    shares.map((s) => s.id),
    'splitExact'
  );
  let sum = 0n;
  const result = new Map<Id, MoneyMinor>();
  for (const s of shares) {
    const amt = BigInt(s.amount);
    result.set(s.id, asMoneyMinor(amt));
    sum += amt;
  }
  assertExactSum(sum, total, 'Exact');
  return result;
}

function assertExactSum(sum: bigint, total: MoneyMinor, label: string): void {
  if (sum !== total) {
    throw new SplitError(`${label} shares must sum to ${total}, got ${sum}`);
  }
}

/**
 * Duplicate participant ids would silently corrupt a split (a Map keyed by id
 * overwrites, so the loser's share vanishes and Σ ≠ total). Reject up front.
 * splitItemized intentionally allows repeats (it aggregates by member).
 */
function assertUniqueIds<Id>(ids: readonly Id[], label: string): void {
  const seen = new Set<Id>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new SplitError(`${label} has a duplicate participant id: ${String(id)}`);
    }
    seen.add(id);
  }
}

/** True if |a − b| is within the money threshold (effectively equal). */
export function withinThreshold(a: MoneyMinor, b: MoneyMinor): boolean {
  const diff = a > b ? a - b : b - a;
  return diff <= MONEY_THRESHOLD_MINOR;
}
