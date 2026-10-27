import {
  Activity,
  BarChart3,
  ChevronLeft,
  LayoutDashboard,
  Package,
  Settings as SettingsIcon,
  ShoppingCart,
  Store,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { ComponentType } from 'react';
import { cn } from '../../lib/utils';
import { can } from '../../lib/permissions';
import type { Permission } from '../../types';
import { useStoreContext } from '../../hooks/use-store-context';
import { useLowStock } from '../../hooks/api';
import { useUiStore } from '../../stores/ui-store';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface NavEntry {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  permission?: Permission;
  badge?: number;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { role, store } = useStoreContext();
  const { data: lowStock } = useLowStock(store?.id ?? null);
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const navigate = useNavigate();

  const workspace: NavEntry[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/sales', label: 'Sales', icon: ShoppingCart, permission: 'sales:read' },
    {
      to: '/inventory',
      label: 'Inventory',
      icon: Package,
      permission: 'products:read',
      badge: lowStock?.length,
    },
    { to: '/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics:read' },
  ];

  const manage: NavEntry[] = [
    { to: '/team', label: 'Team', icon: Users, permission: 'team:read' },
    { to: '/stores', label: 'Stores', icon: Store },
    { to: '/settings', label: 'Settings', icon: SettingsIcon, permission: 'store:read' },
  ];

  const renderGroup = (label: string, entries: NavEntry[]) => {
    const visible = entries.filter((entry) => !entry.permission || can(role, entry.permission));
    if (visible.length === 0) return null;
    return (
      <div className="space-y-1">
        {!collapsed ? (
          <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500">
            {label}
          </p>
        ) : (
          <div className="mx-3 my-2 h-px bg-white/10" />
        )}
        {visible.map((entry) => {
          const Icon = entry.icon;
          return (
            <NavLink
              key={entry.to}
              to={entry.to}
              onClick={onNavigate}
              title={collapsed ? entry.label : undefined}
              className={({ isActive }) =>
                cn(
                  'nav-item relative',
                  isActive && 'nav-item-active',
                  collapsed && 'justify-center px-2',
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed ? (
                <>
                  <span className="flex-1">{entry.label}</span>
                  {entry.badge ? (
                    <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                      {entry.badge}
                    </span>
                  ) : null}
                </>
              ) : entry.badge ? (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-400" />
              ) : null}
            </NavLink>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div
        className={cn(
          'flex h-16 items-center gap-2.5 border-b border-white/10 px-4',
          collapsed && 'justify-center px-2',
        )}
      >
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-brand shadow-glow">
          <Activity className="h-5 w-5 text-white" strokeWidth={2.4} />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight tracking-tight text-white">PulseBoard</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
              Business intelligence
            </p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-2">
        {renderGroup('Workspace', workspace)}
        {renderGroup('Manage', manage)}

        {!collapsed ? (
          <div className="mx-1 mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <p className="text-xs font-semibold text-white">Live sync active</p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
              Sales and stock updates stream in across every device.
            </p>
            {!store ? (
              <Button
                size="sm"
                variant="soft"
                className="mt-3 w-full"
                onClick={() => navigate('/stores')}
              >
                Connect a store
              </Button>
            ) : null}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-white/10 p-2.5">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-ink-400 transition hover:bg-white/[0.06] hover:text-white',
            collapsed && 'justify-center px-2',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed ? <span>Collapse</span> : null}
        </button>
        {!collapsed ? (
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              <Zap className="h-3 w-3" /> v1.0.0
            </span>
            <Badge tone="brand" className="bg-brand-500/15 text-brand-300 ring-brand-500/20">
              Pro
            </Badge>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/5 bg-ink-950 text-white transition-[width] duration-200 lg:flex',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand-600/20 to-transparent" />
        <div className="relative flex h-full flex-col">
          <SidebarContent />
        </div>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <aside className="relative flex h-full w-72 flex-col bg-ink-950 text-white shadow-pop animate-slide-in-right">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-ink-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
