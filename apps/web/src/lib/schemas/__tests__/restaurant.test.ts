import { describe, expect, it } from 'vitest';
import {
  CUISINE_VALUES,
  createRestaurantSchema,
  getCuisineLabel,
  getCuisineSelectOptions,
  isCuisine,
  updateRestaurantSchema,
} from '../restaurant';

describe('restaurant schema utilities', () => {
  describe('isCuisine', () => {
    it('returns true for valid cuisine values', () => {
      expect(isCuisine('japanese')).toBe(true);
      expect(isCuisine('italian')).toBe(true);
      expect(isCuisine('other')).toBe(true);
    });

    it('returns false for invalid cuisine values', () => {
      expect(isCuisine('french')).toBe(false);
      expect(isCuisine('')).toBe(false);
    });
  });

  describe('getCuisineLabel', () => {
    it('returns translated label for valid cuisine', () => {
      const result = getCuisineLabel('japanese');
      expect(typeof result).toBe('string');
    });

    it('returns input unchanged for invalid cuisine', () => {
      expect(getCuisineLabel('french')).toBe('french');
    });
  });

  describe('getCuisineSelectOptions', () => {
    it('returns options for all cuisine values', () => {
      const options = getCuisineSelectOptions();
      expect(options.length).toBe(CUISINE_VALUES.length);
      expect(options[0]).toHaveProperty('value');
      expect(options[0]).toHaveProperty('label');
    });
  });

  describe('createRestaurantSchema', () => {
    it('validates valid restaurant data', () => {
      const result = createRestaurantSchema.safeParse({
        name: 'Sushi Bar',
        address: '123 Main St',
        cuisine: 'japanese',
      });
      expect(result.success).toBe(true);
    });

    it('rejects short name', () => {
      const result = createRestaurantSchema.safeParse({
        name: 'A',
        address: '123 Main St',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short address', () => {
      const result = createRestaurantSchema.safeParse({
        name: 'Sushi Bar',
        address: '1',
      });
      expect(result.success).toBe(false);
    });

    it('allows empty cuisine', () => {
      const result = createRestaurantSchema.safeParse({
        name: 'Sushi Bar',
        address: '123 Main St',
        cuisine: '',
      });
      expect(result.success).toBe(true);
    });

    it('transforms empty notes to undefined', () => {
      const result = createRestaurantSchema.safeParse({
        name: 'Sushi Bar',
        address: '123 Main St',
        notes: '',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notes).toBeUndefined();
      }
    });
  });

  describe('updateRestaurantSchema', () => {
    it('validates partial update', () => {
      const result = updateRestaurantSchema.safeParse({
        id: 1,
        name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid id', () => {
      const result = updateRestaurantSchema.safeParse({
        id: -1,
        name: 'Updated',
      });
      expect(result.success).toBe(false);
    });

    it('allows empty cuisine transformation', () => {
      const result = updateRestaurantSchema.safeParse({
        id: 1,
        cuisine: '',
      });
      expect(result.success).toBe(true);
    });
  });
});
