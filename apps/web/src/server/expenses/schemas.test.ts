import { describe, expect, it } from 'vitest';
import { paginationSchema } from './schemas';

describe('paginationSchema', () => {
  describe('paymentStatus', () => {
    it('should accept "all" as paymentStatus', () => {
      const result = paginationSchema.parse({ page: 1, paymentStatus: 'all' });
      expect(result.paymentStatus).toBe('all');
    });

    it('should accept "paid" as paymentStatus', () => {
      const result = paginationSchema.parse({ page: 1, paymentStatus: 'paid' });
      expect(result.paymentStatus).toBe('paid');
    });

    it('should accept "unpaid" as paymentStatus', () => {
      const result = paginationSchema.parse({ page: 1, paymentStatus: 'unpaid' });
      expect(result.paymentStatus).toBe('unpaid');
    });

    it('should accept "partial" as paymentStatus', () => {
      const result = paginationSchema.parse({ page: 1, paymentStatus: 'partial' });
      expect(result.paymentStatus).toBe('partial');
    });

    it('should default paymentStatus to "all" when not provided', () => {
      const result = paginationSchema.parse({ page: 1 });
      expect(result.paymentStatus).toBe('all');
    });

    it('should reject invalid paymentStatus values', () => {
      expect(() => paginationSchema.parse({ page: 1, paymentStatus: 'invalid' })).toThrow();
    });
  });
});
