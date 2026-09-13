import { describe, expect, it } from 'vitest';
import { getUserPermissions } from './auth';

describe('getUserPermissions', () => {
  it('returns all permissions for admin role', () => {
    const result = getUserPermissions('admin');

    expect(result).toEqual({
      role: 'admin',
      permissions: ['view', 'create', 'edit', 'delete'],
    });
  });

  it('returns view-only permissions for regular role', () => {
    const result = getUserPermissions('regular');

    expect(result).toEqual({
      role: 'regular',
      permissions: ['view'],
    });
  });
});
