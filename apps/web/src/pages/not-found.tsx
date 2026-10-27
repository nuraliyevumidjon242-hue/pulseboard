import {
  ArrowLeft,
  BarChart3,
  Compass,
  LayoutDashboard,
  Package,
  ShoppingCart,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { usePageTitle } from '../hooks/use-utils';
import { t } from '../lib/i18n';

const QUICK_LINKS = [
  {
    label: 'Dashboard',
    description: 'Your live revenue pulse',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  { label: 'Sales', description: 'Transactions and receipts', to: '/sales', icon: ShoppingCart },
  {
    label: 'Inventory',
    description: 'Stock, products and adjustments',
    to: '/inventory',
    icon: Package,
  },
  {
    label: 'Analytics',
    description: 'Trends, customers and exports',
    to: '/analytics',
    icon: BarChart3,
  },
];

export default function NotFoundPage() {
  usePageTitle(t('Page not found'));
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[72vh] flex-col items-center justify-center py-6 text-center">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 mx-auto h-40 w-40 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl gradient-brand shadow-glow">
          <Compass className="h-9 w-9 text-white" strokeWidth={1.8} />
        </div>
      </div>

      <Badge tone="brand" className="mt-6">
        {t('404 · Off the map')}
      </Badge>
      <h1 className="mt-3 max-w-xl text-3xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-4xl">
        {t('This page slipped off the shelf.')}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-500 dark:text-ink-400">
        {t(
          'The link may be outdated, the store may have moved, or the page never existed. Your live data is safe — let’s get you back to solid ground.',
        )}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button
          onClick={() => navigate('/dashboard', { replace: true })}
          leftIcon={<LayoutDashboard className="h-4 w-4" />}
        >
          {t('Back to dashboard')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate(-1)}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          {t('Previous page')}
        </Button>
      </div>

      <div className="mt-10 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-2">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.to}
              type="button"
              onClick={() => navigate(link.to)}
              className="group flex items-center gap-3 rounded-2xl border border-ink-200/80 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card dark:border-ink-800 dark:bg-ink-900 dark:hover:border-brand-500/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-500/10 dark:text-brand-300">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink-900 dark:text-white">
                  {t(link.label)}
                </span>
                <span className="block truncate text-[11px] text-ink-500 dark:text-ink-400">
                  {t(link.description)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
