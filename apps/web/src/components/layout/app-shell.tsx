import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useStoreContext } from '../../hooks/use-store-context';
import { useUiStore } from '../../stores/ui-store';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const location = useLocation();
  const { store } = useStoreContext();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950">
      <Sidebar />
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          collapsed ? 'lg:pl-20' : 'lg:pl-64',
        )}
      >
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1500px] animate-fade-in">
            {!store ? <NoStoreBanner /> : null}
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-ink-200/70 px-4 py-4 text-[11px] text-ink-400 dark:border-ink-800 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2">
            <span>PulseBoard · real-time analytics for small business</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              All systems operational
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function NoStoreBanner() {
  return (
    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
      You do not have access to a store yet. Ask an owner to invite you, or create your own store
      from the Stores page.
    </div>
  );
}
