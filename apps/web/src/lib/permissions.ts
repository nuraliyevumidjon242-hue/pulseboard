import type { Permission, StoreRole } from '../types';

const PERMISSIONS_BY_ROLE: Record<StoreRole, readonly Permission[]> = {
  viewer: ['store:read', 'sales:read', 'products:read', 'analytics:read'],
  cashier: ['store:read', 'sales:read', 'sales:write', 'products:read', 'analytics:read'],
  manager: [
    'store:read',
    'sales:read',
    'sales:write',
    'products:read',
    'products:write',
    'inventory:write',
    'analytics:read',
    'analytics:export',
    'team:read',
    'activity:read',
  ],
  admin: [
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
  ],
};

export function can(role: StoreRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS_BY_ROLE[role].includes(permission);
}

export const ROLE_LABELS: Record<StoreRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  cashier: 'Cashier',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<StoreRole, string> = {
  admin: 'Full control over the store, team and settings.',
  manager: 'Runs sales, inventory and reports. Cannot manage the team.',
  cashier: 'Records sales and looks up products.',
  viewer: 'Read-only access to dashboards and reports.',
};
