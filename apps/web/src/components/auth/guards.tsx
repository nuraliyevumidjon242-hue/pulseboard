import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { useStoreContext } from '../../hooks/use-store-context';
import { can } from '../../lib/permissions';
import type { Permission } from '../../types';
import { Button } from '../ui/button';
import { ShieldX } from 'lucide-react';

export function BootSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50 dark:bg-ink-950">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand shadow-glow">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-brand-500/25" />
        <svg viewBox="0 0 24 24" className="relative h-7 w-7" fill="none" aria-hidden>
          <path
            d="M3 12h4l2.5-7 4 14L16 12h5"
            stroke="white"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-ink-900 dark:text-white">PulseBoard</p>
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">Restoring your session…</p>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'booting') return <BootSplash />;
  if (status === 'guest') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }
  return <>{children}</>;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { store, role } = useStoreContext();

  if (!store) {
    return <Navigate to="/stores" replace />;
  }

  if (!can(role, permission)) {
    return (
      <div className="surface mx-auto mt-10 max-w-lg p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          <ShieldX className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink-900 dark:text-white">
          You need additional access
        </h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Your role in <span className="font-semibold">{store.name}</span> does not include this
          area. Ask a store administrator to upgrade your role.
        </p>
        <Button className="mt-5" variant="secondary" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
