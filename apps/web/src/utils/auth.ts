/**
 * Types for user permissions
 */
export type UserRole = 'admin' | 'regular';
export type Permission = 'view' | 'create' | 'edit' | 'delete';

/**
 * User permission interface
 */
export interface UserPermissions {
  role: UserRole;
  permissions: Permission[];
}

/**
 * Get permissions for a user based on their role
 * @param role User role (admin or regular)
 * @returns Permissions object
 */
export const getUserPermissions = (role: UserRole): UserPermissions => {
  if (role === 'admin') {
    return {
      role: 'admin',
      permissions: ['view', 'create', 'edit', 'delete'],
    };
  }

  // Regular users only have view permission
  return {
    role: 'regular',
    permissions: ['view'],
  };
};
