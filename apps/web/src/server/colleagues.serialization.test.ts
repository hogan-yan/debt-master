import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { serializeDecimal } from '@/server/utils/decimal';

/**
 * Colleague Serialization Logic Tests
 */

describe('Colleague Serialization Logic', () => {
  describe('Decimal Amount Conversion', () => {
    it('should convert Prisma Decimal to number', () => {
      const decimal = new Prisma.Decimal('99.99');
      const amount =
        typeof decimal === 'object' && decimal !== null && 'toString' in decimal
          ? serializeDecimal(decimal)
          : decimal;

      expect(amount).toBe(99.99);
    });

    it('should handle zero Decimal', () => {
      const decimal = new Prisma.Decimal('0');
      const amount =
        typeof decimal === 'object' && decimal !== null && 'toString' in decimal
          ? serializeDecimal(decimal)
          : decimal;

      expect(amount).toBe(0);
    });

    it('should pass through non-Decimal numbers', () => {
      const amount = 50.5;
      const result =
        typeof amount === 'number' ? amount : serializeDecimal(amount as Prisma.Decimal);

      expect(result).toBe(50.5);
    });
  });

  describe('Basic Serialization', () => {
    it('should serialize colleague data with spread operator', () => {
      const colleague = {
        id: 1,
        name: 'John Doe',
        createdAt: new Date('2024-01-15'),
      };

      const serialized = { ...colleague };

      expect(serialized.id).toBe(1);
      expect(serialized.name).toBe('John Doe');
    });

    it('should convert nested Decimal amounts', () => {
      const data = {
        amount: new Prisma.Decimal('25.50'),
        expense: {
          amount: new Prisma.Decimal('100.00'),
        },
      };

      const serialized = {
        amount:
          typeof data.amount === 'object' && data.amount !== null && 'toString' in data.amount
            ? serializeDecimal(data.amount as Prisma.Decimal)
            : (data.amount as number),
        expense: {
          ...data.expense,
          amount:
            typeof data.expense.amount === 'object' &&
            data.expense.amount !== null &&
            'toString' in data.expense.amount
              ? serializeDecimal(data.expense.amount as Prisma.Decimal)
              : (data.expense.amount as number),
        },
      };

      expect(serialized.amount).toBe(25.5);
      expect(serialized.expense.amount).toBe(100.0);
    });
  });
});
