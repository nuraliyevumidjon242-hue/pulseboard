import { describe, expect, it } from 'vitest';
import {
  STORE_ROLES,
  can,
  globalRoleToStoreRole,
  highestRole,
  isAtLeast,
  permissionsFor,
  type Permission,
} from './permissions';

describe('role permissions', () => {
  it('maps each store role to a coherent capability set', () => {
    expect(can('viewer', 'sales:read')).toBe(true);
    expect(can('viewer', 'analytics:read')).toBe(true);
    expect(can('viewer', 'sales:write')).toBe(false);
    expect(can('viewer', 'products:write')).toBe(false);
    expect(can('viewer', 'settings:write')).toBe(false);

    expect(can('cashier', 'sales:write')).toBe(true);
    expect(can('cashier', 'sales:read')).toBe(true);
    expect(can('cashier', 'products:write')).toBe(false);
    expect(can('cashier', 'inventory:write')).toBe(false);
    expect(can('cashier', 'analytics:export')).toBe(false);

    expect(can('manager', 'products:write')).toBe(true);
    expect(can('manager', 'inventory:write')).toBe(true);
    expect(can('manager', 'analytics:export')).toBe(true);
    expect(can('manager', 'team:read')).toBe(true);
    expect(can('manager', 'team:manage')).toBe(false);
    expect(can('manager', 'settings:write')).toBe(false);
    expect(can('manager', 'store:delete')).toBe(false);

    const adminPermissions: Permission[] = [
      'store:read',
      'store:update',
      'sales:read',
      'sales:write',
      'products:read',
      'products:write',
      'inventory:write',
      'analytics:read',
      'analytics:export',
      'team:read',
      'team:manage',
      'activity:read',
      'settings:write',
    ];
    for (const permission of adminPermissions) {
      expect(can('admin', permission)).toBe(true);
    }
  });

  it('orders roles from viewer to admin', () => {
    expect(isAtLeast('admin', 'manager')).toBe(true);
    expect(isAtLeast('manager', 'manager')).toBe(true);
    expect(isAtLeast('cashier', 'manager')).toBe(false);
    expect(isAtLeast('viewer', 'cashier')).toBe(false);
  });

  it('picks the highest role from a list', () => {
    expect(highestRole(['viewer', 'cashier'])).toBe('cashier');
    expect(highestRole(['viewer', 'manager', 'cashier'])).toBe('manager');
    expect(highestRole(['viewer'])).toBe('viewer');
    expect(highestRole([])).toBe('viewer');
  });

  it('maps global roles to their store equivalent', () => {
    expect(globalRoleToStoreRole('super_admin')).toBe('admin');
    expect(globalRoleToStoreRole('business_owner')).toBe('admin');
    expect(globalRoleToStoreRole('manager')).toBe('manager');
    expect(globalRoleToStoreRole('cashier')).toBe('cashier');
    expect(globalRoleToStoreRole('viewer')).toBe('viewer');
  });

  it('returns a defensive copy of the permission list', () => {
    const permissions = permissionsFor('viewer');
    permissions.push('store:delete');
    expect(permissionsFor('viewer')).not.toContain('store:delete');
    expect(permissionsFor('viewer')).toHaveLength(4);
  });

  it('knows every store role', () => {
    expect(STORE_ROLES).toEqual(['viewer', 'cashier', 'manager', 'admin']);
    expect(new Set(STORE_ROLES).size).toBe(4);
  });

  it('never grants unknown capabilities', () => {
    expect(can('admin', 'billing:write' as Permission)).toBe(false);
    expect(can('viewer', 'store:delete')).toBe(false);
    expect(can('manager', 'store:delete')).toBe(false);
    expect(can('admin', 'store:delete')).toBe(false);
  });
});
