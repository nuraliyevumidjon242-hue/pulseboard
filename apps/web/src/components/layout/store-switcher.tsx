import { Check, ChevronDown, Plus, Store as StoreIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { ROLE_LABELS } from '../../lib/permissions';
import { useAuthStore, useActiveStore } from '../../stores/auth-store';
import { Dropdown, DropdownDivider, DropdownItem, DropdownLabel } from '../ui/dropdown';

export function StoreSwitcher({ compact = false }: { compact?: boolean }) {
  const store = useActiveStore();
  const stores = useAuthStore((state) => state.stores);
  const setActiveStore = useAuthStore((state) => state.setActiveStore);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const canCreate = user?.role === 'business_owner' || user?.role === 'super_admin';

  return (
    <Dropdown
      label="Switch store"
      panelClassName="w-72"
      trigger={
        <span
          className={cn(
            'flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-2.5 py-1.5 text-left shadow-sm transition hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-ink-600',
            compact ? 'w-auto' : 'w-full max-w-[15rem]',
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <StoreIcon className="h-4 w-4" />
          </span>
          <span className={cn('min-w-0 flex-1', compact && 'hidden sm:block')}>
            <span className="block truncate text-xs font-semibold text-ink-900 dark:text-white">
              {store?.name ?? 'No store yet'}
            </span>
            <span className="block truncate text-[10px] font-medium text-ink-500 dark:text-ink-400">
              {store
                ? `${store.city ?? '—'} · ${ROLE_LABELS[store.role]}`
                : 'Create your first store'}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-400" />
        </span>
      }
    >
      {(close) => (
        <>
          <DropdownLabel>Your stores</DropdownLabel>
          {stores.length === 0 ? (
            <p className="px-3 py-4 text-xs text-ink-500 dark:text-ink-400">
              You do not have access to a store yet.
            </p>
          ) : null}
          {stores.map((item) => (
            <DropdownItem
              key={item.id}
              active={item.id === store?.id}
              icon={
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-100 text-[10px] font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                  {item.name.slice(0, 1).toUpperCase()}
                </span>
              }
              onClick={() => {
                setActiveStore(item.id);
                close();
              }}
            >
              <span className="block truncate">{item.name}</span>
              <span className="block text-[10px] font-normal text-ink-400">
                {ROLE_LABELS[item.role]} · {item.currency}
              </span>
              {item.id === store?.id ? (
                <Check className="absolute right-3 h-3.5 w-3.5 text-brand-600" />
              ) : null}
            </DropdownItem>
          ))}
          <DropdownDivider />
          <DropdownItem
            icon={<StoreIcon className="h-4 w-4" />}
            onClick={() => {
              close();
              navigate('/stores');
            }}
          >
            Manage stores
          </DropdownItem>
          {canCreate ? (
            <DropdownItem
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                close();
                navigate('/stores?new=1');
              }}
            >
              Add a new store
            </DropdownItem>
          ) : null}
        </>
      )}
    </Dropdown>
  );
}
