import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  MapPin,
  Plus,
  Settings2,
  Store as StoreIcon,
  Users,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/feedback';
import { CreateStoreModal } from '../features/stores/create-store-modal';
import { useStoreComparison, useStores } from '../hooks/api';
import { usePageTitle } from '../hooks/use-utils';
import { useAuthStore, useActiveStore } from '../stores/auth-store';
import { cn, formatCurrency, formatNumber } from '../lib/utils';
import { ROLE_LABELS } from '../lib/permissions';
import { toast } from '../stores/toast-store';
import type { Store } from '../types';

export default function StoresPage() {
  usePageTitle('Stores');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const setActiveStore = useAuthStore((state) => state.setActiveStore);
  const activeStore = useActiveStore();
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');

  const storesQuery = useStores(true);
  const comparisonQuery = useStoreComparison();

  const canCreate = user?.role === 'business_owner' || user?.role === 'super_admin';
  const stores = storesQuery.data?.data ?? [];
  const totalRevenue = stores.reduce((sum, store) => sum + Number(store.metrics.monthRevenue), 0);
  const maxComparison = Math.max(
    ...(comparisonQuery.data?.map((row) => Number(row.revenue30d)) ?? [0]),
    1,
  );

  const openStore = (store: Store) => {
    setActiveStore(store.id);
    toast.success('Store switched', `You are now viewing ${store.name}.`);
    navigate('/dashboard');
  };

  const closeModal = () => {
    setModalOpen(false);
    if (searchParams.get('new')) {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Multi-store"
        title="Stores"
        description="A portfolio view of every location — compare revenue, stock health and team size."
        actions={
          canCreate ? (
            <Button
              onClick={() => {
                setModalOpen(true);
                const next = new URLSearchParams(searchParams);
                next.set('new', '1');
                setSearchParams(next, { replace: true });
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add store
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
            Locations
          </p>
          <p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">{stores.length}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">Across your workspace</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
            30-day revenue
          </p>
          <p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">
            {formatCurrency(totalRevenue, stores[0]?.currency ?? 'EUR', { compact: true })}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">Combined across stores</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
            Team members
          </p>
          <p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">
            {formatNumber(stores.reduce((sum, store) => sum + store.memberCount, 0))}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">With access across locations</p>
        </Card>
      </div>

      {storesQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : storesQuery.isError ? (
        <Card>
          <ErrorState
            message="Could not load your stores."
            onRetry={() => void storesQuery.refetch()}
          />
        </Card>
      ) : stores.length === 0 ? (
        <Card>
          <EmptyState
            title="No stores yet"
            description={
              canCreate
                ? 'Create your first store to start recording sales and tracking stock.'
                : 'Ask a business owner to invite you to their store.'
            }
            icon={<StoreIcon className="h-6 w-6" />}
            action={
              canCreate ? (
                <Button
                  size="sm"
                  onClick={() => setModalOpen(true)}
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add store
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => {
            const active = store.id === activeStore?.id;
            return (
              <Card
                key={store.id}
                className={cn(
                  'relative overflow-hidden p-5 transition',
                  active && 'ring-2 ring-brand-500/60',
                )}
              >
                {active ? (
                  <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Active
                  </span>
                ) : null}
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-glow">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 pr-16">
                    <p className="truncate text-sm font-bold text-ink-900 dark:text-white">
                      {store.name}
                    </p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-ink-500 dark:text-ink-400">
                      <MapPin className="h-3 w-3" /> {store.city ?? '—'}
                      {store.country ? `, ${store.country}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge tone={store.role === 'admin' ? 'purple' : 'brand'}>
                        {ROLE_LABELS[store.role]}
                      </Badge>
                      <Badge tone={store.isActive ? 'success' : 'neutral'}>
                        {store.isActive ? 'Open' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-ink-50 px-3 py-2 dark:bg-ink-950/40">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-ink-400">
                      Today
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-ink-900 dark:text-white">
                      {formatCurrency(store.metrics.todayRevenue, store.currency, {
                        compact: true,
                      })}
                    </p>
                    <p className="text-[10px] text-ink-400">
                      {formatNumber(store.metrics.todayTransactions)} transactions
                    </p>
                  </div>
                  <div className="rounded-xl bg-ink-50 px-3 py-2 dark:bg-ink-950/40">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-ink-400">
                      30 days
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-ink-900 dark:text-white">
                      {formatCurrency(store.metrics.monthRevenue, store.currency, {
                        compact: true,
                      })}
                    </p>
                    <p className="text-[10px] text-ink-400">{store.currency}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-ink-500 dark:text-ink-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {store.memberCount}{' '}
                    {store.memberCount === 1 ? 'member' : 'members'}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1 font-semibold',
                      store.metrics.lowStockCount > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    {store.metrics.lowStockCount > 0
                      ? `${store.metrics.lowStockCount} low stock`
                      : 'Stock healthy'}
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant={active ? 'secondary' : 'primary'}
                    className="flex-1"
                    onClick={() => openStore(store)}
                    rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                  >
                    {active ? 'View dashboard' : 'Switch store'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setActiveStore(store.id);
                      navigate('/settings');
                    }}
                    aria-label={`Settings for ${store.name}`}
                    leftIcon={<Settings2 className="h-3.5 w-3.5" />}
                  >
                    Settings
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader
          title="Store comparison"
          description="30-day revenue, transactions and basket size side by side"
          action={
            <Badge tone="brand">
              <ArrowUpRight className="h-3 w-3" /> Live
            </Badge>
          }
        />
        <CardContent>
          {comparisonQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : comparisonQuery.data && comparisonQuery.data.length > 0 ? (
            <div className="space-y-4">
              {comparisonQuery.data.map((row) => (
                <div key={row.storeId}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-ink-800 dark:text-ink-100">
                        {row.name}
                      </span>
                      <span className="text-[10px] text-ink-400">{row.city ?? '—'}</span>
                    </span>
                    <span className="flex items-center gap-3 text-[11px] text-ink-500 dark:text-ink-400">
                      <span>{formatNumber(row.transactions30d)} tx</span>
                      <span>avg {formatCurrency(row.avgTransaction30d, row.currency)}</span>
                      <span className="w-20 text-right font-bold text-ink-900 dark:text-white">
                        {formatCurrency(row.revenue30d, row.currency, { compact: true })}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400 transition-all"
                      style={{
                        width: `${Math.max(2, (Number(row.revenue30d) / maxComparison) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-ink-400">
              No comparison data available yet.
            </p>
          )}
        </CardContent>
      </Card>

      <CreateStoreModal
        open={modalOpen}
        onClose={closeModal}
        onCreated={(store) => {
          setActiveStore(store.id);
          navigate('/dashboard');
        }}
      />
    </div>
  );
}
