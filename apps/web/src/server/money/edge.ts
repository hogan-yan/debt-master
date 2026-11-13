/**
 * Money edge helpers — the ONLY places where Prisma values, JS numbers and
 * core minor units meet.
 *
 * All workflow arithmetic happens on exact bigint minor units (cents, from
 * @debtmaster/core). Conversion rules:
 *   - Prisma Decimal / decimal string / number → `toMinor` (exact: the string
 *     form of a Decimal(10,2) column is its cents)
 *   - minor units → Prisma.Decimal on write → `minorToDecimal`
 *   - minor units → JS number for serialized results → `minorToNumber`
 * The only float step in any chain is the final minor→major division, exact
 * for cent-scale values far beyond this app's magnitude.
 */

import { asMoneyMinor, MoneyMinor, toDecimalString } from '@debtmaster/core';
import { Prisma } from '@prisma/client';

/** Prisma Decimal | decimal string | number | bigint → exact minor units. */
export function toMinor(
  amount: Prisma.Decimal | bigint | number | string | null | undefined
): MoneyMinor {
  if (amount == null) return asMoneyMinor(0n);
  if (typeof amount === 'bigint') return asMoneyMinor(amount);
  if (typeof amount === 'number') return asMoneyMinor(BigInt(Math.round(amount * 100)));
  return asMoneyMinor(BigInt(new Prisma.Decimal(amount).toFixed(2).replace('.', '')));
}

/** Exact minor units → Prisma.Decimal for typed column writes. */
export function minorToDecimal(minor: bigint): Prisma.Decimal {
  return new Prisma.Decimal(toDecimalString(asMoneyMinor(minor), 'USD'));
}

/** Exact minor units → number for serialized results. */
export function minorToNumber(minor: bigint): number {
  return Number(minor) / 100;
}
