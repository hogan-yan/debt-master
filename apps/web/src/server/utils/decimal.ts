import { Prisma } from '@prisma/client';

/**
 * Serialize a Prisma Decimal to a JavaScript number.
 * Passes through numbers unchanged. Returns 0 for null/undefined.
 */
export function serializeDecimal(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (value instanceof Prisma.Decimal) return Number.parseFloat(value.toString());
  return value;
}
