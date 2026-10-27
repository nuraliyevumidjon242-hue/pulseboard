import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Download,
  Package,
  RefreshCw,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/feedback';
import { SegmentedControl } from '../components/ui/tabs';
import { KpiCard } from '../components/dashboard/kpi-card';
import { RevenueAreaChart } from '../components/charts/revenue-area-chart';
import { PaymentDonut } from '../components/charts/payment-donut';
import { HourlyBarChart } from '../components/charts/hourly-bar-chart';
import { useDashboard } from '../hooks/api';
import { useStoreContext } from '../hooks/use-store-context';
import { usePageTitle } from '../hooks/use-utils';
import { exportReport, getErrorMessage } from '../lib/api';
import { can } from '../lib/permissions';
import {
  computeStockTone,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatTime,
  greeting,
  paymentLabel,
  toNumber,
} from '../lib/utils';
import { toast } from '../stores/toast-store';
import { useAuthStore } from '../stores/auth-store';
import { cn } from '../lib/utils';

const PERIODS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
] as const;

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { storeId, store, currency, timezone, role, preferences } = useStoreContext();
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const [exporting, setExporting] = useState(false);

  const autoRefresh = preferences?.autoRefreshInterval
    ? preferences.autoRefreshInterval * 1_000
    : undefined;

  const { data, isLoading, isError, error, refetch, isFetching } = useDashboard(
    storeId,
    Number(days),
    autoRefresh,
  );

  const spark = data?.trend.map((point) => toNumber(point.revenue)) ?? [];
  const transactionSpark = data?.trend.map((point) => point.transactions) ?? [];
  const basketSpark =
    data?.trend.map((point) =>
      point.transactions > 0 ? toNumber(point.revenue) / point.transactions : 0,
    ) ?? [];

  const onExport = async () => {
    if (!storeId) return;
    setExporting(true);
    try {
      await exportReport(storeId, 'pdf', 'monthly');
      toast.success('Report exported', 'Your PDF report has been downloaded.');
    } catch (exportError) {
      toast.error('Export failed', getErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  };

  if (isError) {
    return (
      <Card>
        <ErrorState
          title="Dashboard unavailable"
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={store ? `${store.name} · ${store.city ?? store.country ?? 'Store'}` : 'Overview'}
        title={`${greeting(new Date(), timezone)}, ${user?.firstName ?? 'there'}`}
        description={
          data
            ? `${formatDate(new Date(), timezone, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })} · live overview of sales, stock and customers.`
            : 'Loading your live business snapshot…'
        }
        actions={
          <>
            <SegmentedControl
              options={[...PERIODS]}
              value={days}
              onChange={setDays}
              ariaLabel="Dashboard period"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refetch()}
              leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />}
            >
              Refresh
            </Button>
            {can(role, 'analytics:export') ? (
              <Button
                variant="secondary"
                size="sm"
                loading={exporting}
                onClick={() => void onExport()}
                leftIcon={<Download className="h-3.5 w-3.5" />}
              >
                Export
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Revenue today"
          value={formatCurrency(data?.today.revenue, currency)}
          change={data?.today.revenueChange}
          hint={
            data
              ? `vs ${formatCurrency(data.yesterday.revenue, currency, { compact: true })} yesterday`
              : '—'
          }
          icon={<Wallet className="h-4 w-4" />}
          accent="brand"
          spark={spark}
          loading={isLoading}
        />
        <KpiCard
          label="Transactions"
          value={formatNumber(data?.today.transactions ?? 0)}
          change={data?.today.transactionsChange}
          hint={data ? `${formatNumber(data.today.itemsSold)} items sold today` : '—'}
          icon={<ReceiptText className="h-4 w-4" />}
          accent="cyan"
          spark={transactionSpark}
          loading={isLoading}
        />
        <KpiCard
          label="Average basket"
          value={formatCurrency(data?.today.avgTransaction, currency)}
          change={data?.today.avgTransactionChange}
          hint="Average value per transaction"
          icon={<ShoppingBag className="h-4 w-4" />}
          accent="emerald"
          spark={basketSpark}
          loading={isLoading}
        />
        <KpiCard
          label="Last 30 days"
          value={formatCurrency(data?.last30Days.revenue, currency, { compact: true })}
          change={data?.last30Days.revenueChange}
          hint={data ? `${formatNumber(data.last30Days.transactions)} transactions in total` : '—'}
          icon={<TrendingUp className="h-4 w-4" />}
          accent="amber"
          spark={spark}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue trend"
            description={`Daily revenue for the last ${days} days`}
            action={
              <Badge tone="brand" className="gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Live
              </Badge>
            }
          />
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : data && data.trend.length > 0 ? (
              <RevenueAreaChart data={data.trend} currency={currency} />
            ) : (
              <EmptyState
                title="No sales yet"
                description="Record your first sale and your revenue curve will appear here in realtime."
                action={
                  <Button size="sm" onClick={() => navigate('/sales?new=1')}>
                    Record a sale
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Payment mix"
            description="Last 30 days by method"
            action={
              <Badge tone="neutral">
                <CreditCard className="h-3 w-3" /> {data?.paymentBreakdown.length ?? 0} methods
              </Badge>
            }
          />
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <PaymentDonut data={data?.paymentBreakdown ?? []} currency={currency} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Today by hour"
            description="When your store is busiest"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/analytics')}>
                Peak hours <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <HourlyBarChart data={data?.hourly ?? []} currency={currency} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Top products"
            description="By revenue · last 30 days"
            action={
              <Link
                to="/analytics"
                className="text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                Details
              </Link>
            }
          />
          <CardContent className="space-y-3.5">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))
            ) : data && data.topProducts.length > 0 ? (
              data.topProducts.map((product, index) => {
                const top = toNumber(data.topProducts[0]?.revenue ?? 0);
                const share = top > 0 ? (toNumber(product.revenue) / top) * 100 : 0;
                return (
                  <div key={`${product.productId ?? product.name}-${index}`}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ink-100 text-[10px] font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium text-ink-700 dark:text-ink-200">
                          {product.name}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-ink-900 dark:text-white">
                        {formatCurrency(product.revenue, currency, { compact: true })}
                      </span>
                    </div>
                    <div className="ml-7 mt-1.5 h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400"
                        style={{ width: `${Math.max(4, share)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="No product sales yet"
                description="Top sellers will appear here."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent sales"
            description="Streaming in from the register"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/sales')}>
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))}
              </div>
            ) : data && data.recentSales.length > 0 ? (
              data.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                    {sale.paymentMethod === 'cash' ? (
                      <Banknote className="h-4 w-4" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                      {sale.transactionId}
                      <span className="ml-2 font-normal text-ink-400">
                        {sale.items.length} item{sale.items.length === 1 ? '' : 's'}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">
                      {sale.cashierName ?? 'Store team'} · {paymentLabel(sale.paymentMethod)} ·{' '}
                      {formatTime(sale.createdAt, timezone)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-ink-900 dark:text-white">
                    {formatCurrency(sale.finalAmount, currency)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState
                title="No sales recorded"
                description="Sales made at the register will show up here instantly."
                action={
                  <Button size="sm" onClick={() => navigate('/sales?new=1')}>
                    Record a sale
                  </Button>
                }
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Low stock"
            description={
              data
                ? `${data.lowStock.count} product${data.lowStock.count === 1 ? '' : 's'} need attention`
                : 'Checking inventory'
            }
            action={
              data && data.lowStock.count > 0 ? (
                <Badge tone="warning">
                  <TriangleAlert className="h-3 w-3" /> {data.lowStock.count}
                </Badge>
              ) : (
                <Badge tone="success">Healthy</Badge>
              )
            }
          />
          <CardContent className="space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))
            ) : data && data.lowStock.items.length > 0 ? (
              data.lowStock.items.map((item) => {
                const tone = computeStockTone(item.currentStock, item.minStock);
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        tone === 'out'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
                      )}
                    >
                      <Package className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-ink-500 dark:text-ink-400">
                        {item.currentStock} {item.unit} left · min {item.minStock}
                      </p>
                    </div>
                    <Badge tone={tone === 'out' ? 'danger' : 'warning'}>
                      {tone === 'out' ? 'Out' : 'Low'}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl bg-emerald-50 px-3 py-6 text-center text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                Every product is above its minimum stock level.
              </div>
            )}

            <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-950/50">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-ink-500 dark:text-ink-400">Inventory value</span>
                <span className="font-bold text-ink-900 dark:text-white">
                  {formatCurrency(data?.inventory.inventoryValue, currency, { compact: true })}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="font-medium text-ink-500 dark:text-ink-400">Active products</span>
                <span className="font-bold text-ink-900 dark:text-white">
                  {formatNumber(data?.inventory.totalProducts ?? 0)}
                </span>
              </div>
            </div>

            <Button variant="secondary" size="sm" fullWidth onClick={() => navigate('/inventory')}>
              Review inventory
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
            Today items sold
          </p>
          <p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">
            {formatNumber(data?.today.itemsSold ?? 0)}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            across {formatNumber(data?.today.transactions ?? 0)} transactions
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
            Best seller
          </p>
          <p className="mt-1 truncate text-xl font-bold text-ink-900 dark:text-white">
            {data?.topProducts[0]?.name ?? '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {data?.topProducts[0]
              ? `${formatNumber(data.topProducts[0].quantity)} sold · ${data.topProducts[0].margin.toFixed(
                  1,
                )}% margin`
              : 'No sales yet'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
            Last 7 days
          </p>
          <p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">
            {formatCurrency(data?.last7Days.revenue, currency, { compact: true })}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {formatPercent(data?.last7Days.revenueChange)} vs previous week
          </p>
        </Card>
      </div>
    </div>
  );
}
