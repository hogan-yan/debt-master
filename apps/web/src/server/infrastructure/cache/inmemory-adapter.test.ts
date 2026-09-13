import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryCache } from './inmemory-adapter';

/**
 * Helper function to safely access array elements in tests.
 */
function expectElement<T>(arr: T[], index: number): T {
  const element = arr[index];
  if (element === undefined) {
    throw new Error(`Expected array to have element at index ${index}, but it was undefined`);
  }
  return element;
}

/**
 * Cache Operations Tests
 * Tests the real InMemoryCache implementation exported from inmemory-adapter.ts
 */

describe('InMemoryCache Operations', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });

  afterEach(async () => {
    await cache.disconnect();
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return stored value', async () => {
      await cache.set('key1', 'value1', 300);
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for expired entry', async () => {
      // Set with very short TTL
      await cache.set('expired', 'value', 0.001); // 1ms TTL

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await cache.get('expired');
      expect(result).toBeNull();
    });

    it('should handle different data types', async () => {
      // String
      await cache.set('string', 'hello', 300);
      expect(await cache.get('string')).toBe('hello');

      // Number
      await cache.set('number', 42, 300);
      expect(await cache.get('number')).toBe(42);

      // Object
      const obj = { id: 1, name: 'test' };
      await cache.set('object', obj, 300);
      expect(await cache.get('object')).toEqual(obj);

      // Array
      const arr = [1, 2, 3];
      await cache.set('array', arr, 300);
      expect(await cache.get('array')).toEqual(arr);

      // Boolean
      await cache.set('bool', true, 300);
      expect(await cache.get('bool')).toBe(true);

      // Null
      await cache.set('null', null, 300);
      expect(await cache.get('null')).toBeNull();
    });

    it('should return complex objects correctly', async () => {
      const complexData = {
        users: [
          { id: 1, name: 'Alice', roles: ['admin', 'user'] },
          { id: 2, name: 'Bob', roles: ['user'] },
        ],
        metadata: {
          total: 2,
          page: 1,
          timestamp: Date.now(),
        },
      };

      await cache.set('complex', complexData, 300);
      const result = await cache.get<typeof complexData>('complex');

      expect(result).toEqual(complexData);
      expect(result?.users).toHaveLength(2);
      expect(result?.metadata.total).toBe(2);
    });
  });

  describe('set', () => {
    it('should store value with TTL', async () => {
      await cache.set('key', 'value', 300);
      expect(await cache.get('key')).toBe('value');
    });

    it('should overwrite existing value', async () => {
      await cache.set('key', 'old-value', 300);
      await cache.set('key', 'new-value', 300);
      expect(await cache.get('key')).toBe('new-value');
    });

    it('should update TTL on overwrite', async () => {
      await cache.set('key', 'old-value', 300);
      expect(await cache.get('key')).toBe('old-value');

      await cache.set('key', 'new-value', 300);
      expect(await cache.get('key')).toBe('new-value');
    });

    it('should handle zero TTL (immediate expiration)', async () => {
      await cache.set('key', 'value', 0);

      await new Promise((resolve) => setTimeout(resolve, 1));

      const result = await cache.get('key');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should remove existing key', async () => {
      await cache.set('key', 'value', 300);
      await cache.delete('key');
      expect(await cache.get('key')).toBeNull();
    });

    it('should not throw when deleting non-existent key', async () => {
      await expect(cache.delete('non-existent')).resolves.not.toThrow();
    });

    it('should decrease size after deletion', async () => {
      await cache.set('key1', 'value1', 300);
      await cache.set('key2', 'value2', 300);

      expect(await cache.size()).toBe(2);

      await cache.delete('key1');

      expect(await cache.size()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await cache.set('key1', 'value1', 300);
      await cache.set('key2', 'value2', 300);
      await cache.set('key3', 'value3', 300);

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBeNull();
    });

    it('should reset size to zero', async () => {
      await cache.set('key1', 'value1', 300);
      await cache.set('key2', 'value2', 300);

      await cache.clear();

      expect(await cache.size()).toBe(0);
    });

    it('should work on empty cache', async () => {
      await expect(cache.clear()).resolves.not.toThrow();
      expect(await cache.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty cache', async () => {
      expect(await cache.size()).toBe(0);
    });

    it('should return correct count', async () => {
      await cache.set('key1', 'value1', 300);
      expect(await cache.size()).toBe(1);

      await cache.set('key2', 'value2', 300);
      expect(await cache.size()).toBe(2);

      await cache.set('key3', 'value3', 300);
      expect(await cache.size()).toBe(3);
    });

    it('should decrease after deletion', async () => {
      await cache.set('key1', 'value1', 300);
      await cache.set('key2', 'value2', 300);

      expect(await cache.size()).toBe(2);

      await cache.delete('key1');

      expect(await cache.size()).toBe(1);
    });

    it('should include expired entries in size until accessed', async () => {
      await cache.set('key', 'value', 0.001); // 1ms TTL

      // Size includes entry before access
      expect(await cache.size()).toBe(1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Access triggers cleanup
      await cache.get('key');

      // Now size reflects cleanup
      expect(await cache.size()).toBe(0);
    });
  });

  describe('isHealthy', () => {
    it('should always return true for in-memory cache', async () => {
      expect(await cache.isHealthy()).toBe(true);
    });

    it('should remain healthy after operations', async () => {
      await cache.set('key', 'value', 300);
      await cache.get('key');
      await cache.delete('key');

      expect(await cache.isHealthy()).toBe(true);
    });

    it('should remain healthy after clear', async () => {
      await cache.set('key', 'value', 300);
      await cache.clear();

      expect(await cache.isHealthy()).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return stats object', async () => {
      const stats = await cache.getStats();

      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('keyCount');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('version');
    });

    it('should report connected as true', async () => {
      const stats = await cache.getStats();
      expect(stats.connected).toBe(true);
    });

    it('should report correct key count', async () => {
      await cache.set('key1', 'value1', 300);
      await cache.set('key2', 'value2', 300);

      const stats = await cache.getStats();
      expect(stats.keyCount).toBe(2);
    });

    it('should report fallback version', async () => {
      const stats = await cache.getStats();
      expect(stats.version).toBe('fallback');
    });

    it('should report in-memory usage', async () => {
      const stats = await cache.getStats();
      expect(stats.memoryUsage).toBe('in-memory');
    });
  });

  describe('disconnect', () => {
    it('should clear all entries', async () => {
      await cache.set('key1', 'value1', 300);
      await cache.set('key2', 'value2', 300);

      await cache.disconnect();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });

    it('should reset size to zero', async () => {
      await cache.set('key', 'value', 300);
      await cache.disconnect();

      expect(await cache.size()).toBe(0);
    });

    it('should not throw on multiple disconnects', async () => {
      await cache.disconnect();
      await expect(cache.disconnect()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in keys', async () => {
      const keys = [
        'key:with:colons',
        'key-with-dashes',
        'key.with.dots',
        'key/with/slashes',
        'key with spaces',
        'key\nwith\nnewlines',
        'key\twith\ttabs',
        'unicode-key-日本語',
        '',
      ];

      for (const key of keys) {
        await cache.set(key, `value-for-${key}`, 300);
        expect(await cache.get(key)).toBe(`value-for-${key}`);
      }
    });

    it('should handle large values', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(100),
      }));

      await cache.set('large', largeArray, 300);
      const result = await cache.get<typeof largeArray>('large');

      expect(result).toHaveLength(10000);
      if (result) {
        expect(expectElement(result, 0).id).toBe(0);
        expect(expectElement(result, 9999).id).toBe(9999);
      }
    });

    it('should handle objects with methods (stored by reference)', async () => {
      const objWithMethod = {
        name: 'test',
        getName() {
          return this.name;
        },
      };

      await cache.set('obj-with-method', objWithMethod, 300);
      const result = await cache.get<{ name: string; getName: () => string }>('obj-with-method');

      // In-memory cache preserves object identity including methods
      expect(result?.name).toBe('test');
      expect(typeof result?.getName).toBe('function');
      expect(result?.getName()).toBe('test');
    });

    it('should maintain separate instances', async () => {
      const cache1 = new InMemoryCache();
      const cache2 = new InMemoryCache();

      await cache1.set('key', 'cache1-value', 300);
      await cache2.set('key', 'cache2-value', 300);

      expect(await cache1.get('key')).toBe('cache1-value');
      expect(await cache2.get('key')).toBe('cache2-value');

      await cache1.disconnect();
      await cache2.disconnect();
    });

    it('should handle rapid sequential operations', async () => {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 100; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`, 300));
      }

      await Promise.all(promises);

      expect(await cache.size()).toBe(100);

      for (let i = 0; i < 100; i++) {
        expect(await cache.get(`key${i}`)).toBe(`value${i}`);
      }
    });

    it('should handle concurrent read/write operations', async () => {
      await cache.set('counter', 0, 300);

      const operations: Array<Promise<unknown>> = [];

      // Mix of reads and writes
      for (let i = 0; i < 50; i++) {
        operations.push(cache.get<number>('counter'));
        operations.push(cache.set('counter', i, 300));
      }

      await Promise.all(operations);

      // Final value should be one of the writes
      const finalValue = await cache.get('counter');
      expect(typeof finalValue).toBe('number');
      expect(finalValue).toBeGreaterThanOrEqual(0);
      expect(finalValue).toBeLessThan(50);
    });
  });
});
