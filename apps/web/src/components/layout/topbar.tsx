import { Menu, Moon, Plus, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { t } from '../../lib/i18n';
import { can } from '../../lib/permissions';
import { useAuthStore } from '../../stores/auth-store';
import { useUiStore } from '../../stores/ui-store';
import { useStoreContext } from '../../hooks/use-store-context';
import { Button } from '../ui/button';
import { NotificationsMenu } from './notifications-menu';
import { StoreSwitcher } from './store-switcher';
import { UserMenu } from './user-menu';
import { LanguageMenu } from './language-menu';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  sales: 'Sales',
  inventory: 'Inventory',
  analytics: 'Analytics',
  team: 'Team',
  stores: 'Stores',
  settings: 'Settings',
};

export function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const setPreferences = useAuthStore((state) => state.setPreferences);
  const preferences = useAuthStore((state) => state.preferences);
  const { role } = useStoreContext();
  const status = useAuthStore((state) => state.status);

  const segment = location.pathname.split('/')[1] ?? 'dashboard';
  const label = LABELS[segment] ?? 'PulseBoard';
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === 'n' && can(role, 'sales:write')) {
        event.preventDefault();
        navigate('/sales?new=1');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate, role]);

  return (
    <header className="sticky top-0 z-20 border-b border-ink-200/80 bg-white/85 backdrop-blur-xl dark:border-ink-800 dark:bg-ink-950/85">
      <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileNavOpen(true)}
          aria-label={t('Open navigation')}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <span className="text-xs font-medium text-ink-400">{t('Workspace')}</span>
          <span className="text-xs text-ink-300 dark:text-ink-600">/</span>
          <span className="text-xs font-semibold text-ink-700 dark:text-ink-200">{t(label)}</span>
          {status === 'authenticated' ? (
            <span className="ml-2 hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t('Live')}
            </span>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <StoreSwitcher compact />
          <LanguageMenu />
          <Button
            variant="primary"
            size="sm"
            className={cn('hidden h-9 sm:inline-flex', !can(role, 'sales:write') && 'hidden')}
            onClick={() => navigate('/sales?new=1')}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            {t('New sale')}
            <span className="kbd ml-1 hidden border-white/25 bg-white/10 text-white/80 xl:inline">
              N
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              const next = isDark ? 'light' : 'dark';
              setTheme(next);
              if (!preferences) return;
              try {
                const response = await api.put<{ data: { preferences: typeof preferences } }>(
                  '/user/preferences',
                  { theme: next },
                );
                setPreferences(response.data.data.preferences);
              } catch {
                // The local theme still applies; the preference will retry on the next save.
              }
            }}
            aria-label={t(isDark ? 'Switch to light theme' : 'Switch to dark theme')}
            title={t(isDark ? 'Light theme' : 'Dark theme')}
          >
            {isDark ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </Button>
          <NotificationsMenu />
          <div className="mx-1 hidden h-7 w-px bg-ink-200 dark:bg-ink-800 sm:block" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
