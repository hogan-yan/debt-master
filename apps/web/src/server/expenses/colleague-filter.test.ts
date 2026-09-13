import { describe, expect, it } from 'vitest';

import { buildExpenseWhereClause } from '@/server/expenses/queries';

describe('expense where-clause building', () => {
  describe('AC1: Colleague filter builds correct where clause', () => {
    it('should include colleague filter in where clause when colleagueIds provided', () => {
      const where = buildExpenseWhereClause({ colleagueIds: [1, 2] });

      expect(where.participants).toEqual({
        some: {
          colleagueId: {
            in: [1, 2],
          },
        },
      });
    });

    it('should not include colleague filter when colleagueIds is empty', () => {
      const where = buildExpenseWhereClause({ colleagueIds: [] });

      expect(where.participants).toBeUndefined();
    });

    it('should not include colleague filter when colleagueIds is undefined', () => {
      const where = buildExpenseWhereClause({});

      expect(where.participants).toBeUndefined();
    });

    it('should combine colleague filter with search filter using AND logic', () => {
      const where = buildExpenseWhereClause({ search: 'pizza', colleagueIds: [1] });

      // Should have both search OR conditions AND colleague filter
      expect(where.OR).toBeDefined();
      expect(where.participants).toEqual({
        some: {
          colleagueId: {
            in: [1],
          },
        },
      });
    });
  });

  describe('AC2: Colleague filter uses OR logic for multiple colleagues', () => {
    it('should use IN operator when multiple colleagueIds provided', () => {
      const where = buildExpenseWhereClause({ colleagueIds: [1, 2, 3] });

      expect(where.participants).toEqual({
        some: {
          colleagueId: {
            in: [1, 2, 3],
          },
        },
      });
    });
  });

  describe('AC3: Input validation', () => {
    it('should accept valid colleagueIds array', () => {
      const where = buildExpenseWhereClause({ colleagueIds: [1, 2] });

      expect(where.participants).toEqual({
        some: {
          colleagueId: {
            in: [1, 2],
          },
        },
      });
    });

    it('should handle single colleagueId', () => {
      const where = buildExpenseWhereClause({ colleagueIds: [1] });

      expect(where.participants).toEqual({
        some: {
          colleagueId: {
            in: [1],
          },
        },
      });
    });
  });

  describe('AC4: Same filter applied to count query', () => {
    it('should build a where clause reusable for both findMany and count', () => {
      const findWhere = buildExpenseWhereClause({ colleagueIds: [1, 2] });
      const countWhere = buildExpenseWhereClause({ colleagueIds: [1, 2] });

      expect(countWhere).toEqual(findWhere);
      expect(countWhere.participants).toEqual({
        some: {
          colleagueId: {
            in: [1, 2],
          },
        },
      });
    });
  });
});
