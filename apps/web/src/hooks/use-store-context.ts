import { useAuthStore, useActiveStore } from '../stores/auth-store';
import { can } from '../lib/permissions';
import type { Permission, StoreRole } from '../types';

export function useStoreContext() {
  const store = useActiveStore();
  const preferences = useAuthStore((state) => state.preferences);

  return {
    store,
    storeId: store?.id ?? null,
    currency: store?.currency ?? 'EUR',
    timezone: store?.timezone ?? 'UTC',
    role: (store?.role ?? 'viewer') as StoreRole,
    preferences,
  };
}

export function useCan(permission: Permission): boolean {
  const { role } = useStoreContext();
  return can(role, permission);
}

export function usePermissions(): (permission: Permission) => boolean {
  const { role } = useStoreContext();
  return (permission) => can(role, permission);
}
