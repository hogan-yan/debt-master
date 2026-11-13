import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { serializeDecimal } from './decimal';

describe('serializeDecimal', () => {
  it('returns 0 for null', () => {
    expect(serializeDecimal(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(serializeDecimal(undefined)).toBe(0);
  });

  it('serializes Prisma Decimal to number', () => {
    expect(serializeDecimal(new Prisma.Decimal('99.99'))).toBe(99.99);
  });

  it('passes through numbers unchanged', () => {
    expect(serializeDecimal(42)).toBe(42);
  });
});
