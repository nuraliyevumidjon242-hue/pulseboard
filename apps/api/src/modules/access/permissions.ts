export const STORE_ROLES = ['viewer', 'cashier', 'manager', 'admin'] as const;
export type StoreRole = (typeof STORE_ROLES)[number];

export const GLOBAL_ROLES = [
  'super_admin',
  'business_owner',
  'manager',
  'cashier',
  'viewer',
] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export type Permission =
  | 'store:read'
  | 'store:update'
  | 'store:delete'
  | 'sales:read'
  | 'sales:write'
  | 'products:read'
  | 'products:write'
  | 'inventory:write'
  | 'analytics:read'
  | 'analytics:export'
  | 'team:read'
  | 'team:manage'
  | 'activity:read'
  | 'settings:write';

const rank: Record<StoreRole, number> = { viewer: 1, cashier: 2, manager: 3, admin: 4 };

const permissionsByRole: Record<StoreRole, readonly Permission[]> = {
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

export function globalRoleToStoreRole(role: GlobalRole): StoreRole {
  switch (role) {
    case 'super_admin':
    case 'business_owner':
      return 'admin';
    case 'manager':
      return 'manager';
    case 'cashier':
      return 'cashier';
    default:
      return 'viewer';
  }
}

export function isAtLeast(role: StoreRole, minimum: StoreRole): boolean {
  return rank[role] >= rank[minimum];
}

export function can(role: StoreRole, permission: Permission): boolean {
  return permissionsByRole[role].includes(permission);
}

export function permissionsFor(role: StoreRole): Permission[] {
  return [...permissionsByRole[role]];
}

export function highestRole(roles: StoreRole[]): StoreRole {
  return roles.reduce<StoreRole>(
    (highest, role) => (rank[role] > rank[highest] ? role : highest),
    'viewer',
  );
}
