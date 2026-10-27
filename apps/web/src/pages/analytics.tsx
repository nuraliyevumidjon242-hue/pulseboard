import {
  ArrowUpRight,
  Award,
  BadgePercent,
  BarChart3,
  CalendarDays,
  Clock,
  Download,
  Repeat2,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/feedback';
import { Select } from '../components/ui/form';
import { SegmentedControl, Tabs } from '../components/ui/tabs';
import { RevenueAreaChart } from '../components/charts/revenue-area-chart';
import { HourlyBarChart } from '../components/charts/hourly-bar-chart';
import { PaymentDonut } from '../components/charts/payment-donut';
import {
  useCustomers,
  useDashboard,
  usePeakHours,
  useProductPerformance,
  useRevenue,
} from '../hooks/api';
import { useStoreContext } from '../hooks/use-store-context';
import { usePageTitle } from '../hooks/use-utils';
import { exportReport, getErrorMessage } from '../lib/api';
import { can } from '../lib/permissions';
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  titleCase,
} from '../lib/utils';
import { toast } from '../stores/toast-store';

const PERIODS = ['7', '30', '90', '365'] as const;

export default function AnalyticsPage() {
  usePageTitle('Analytics');
  const { storeId, currency, timezone, role } = useStoreContext();
  const [tab, setTab] = useState('revenue');
  const [days, setDays] = useState<'7' | '30' | '90' | '365'>('30');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [productSort, setProductSort] = useState<'revenue' | 'quantity' | 'profit'>('revenue');
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  const daysNumber = Number(days);
  const revenueParams = useMemo(() => ({ days: daysNumber, period }), [daysNumber, period]);
  const productParams = useMemo(
    () => ({ days: daysNumber, limit: 8, sortBy: productSort }),
    [daysNumber, productSort],
  );

  const revenueQuery = useRevenue(storeId, revenueParams);
  const productQuery = useProductPerformance(storeId, productParams);
  const customerQuery = useCustomers(storeId, daysNumber);
  const peakQuery = usePeakHours(storeId, daysNumber);
  const dashboardQuery = useDashboard(storeId, 30);

  const revenue = revenueQuery.data;
  const products = productQuery.data;
  const customers = customerQuery.data;
  const peak = peakQuery.data;
  const payments = dashboardQuery.data?.paymentBreakdown ?? [];

  const onExport = async (format: 'pdf' | 'csv') => {
    if (!storeId) return;
    setExporting(format);
    try {
      await exportReport(storeId, format, period);
      toast.success(`${format.toUpperCase()} report exported`, 'The download should start now.');
    } catch (error) {
      toast.error('Export failed', getErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  const maxWeekday = Math.max(...(peak?.weekdays.map((day) => Number(day.revenue)) ?? [0]), 1);
  const maxCategory = Math.max(
    ...(products?.categories.map((category) => Number(category.revenue)) ?? [0]),
    1,
  );

  const loading = revenueQuery.isLoading;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business intelligence"
        title="Analytics"
        description="Revenue, product and customer intelligence — built from every transaction, not samples."
        actions={
          <>
            <SegmentedControl
              options={[...PERIODS].map((value) => ({
                value,
                label: value === '365' ? '1 year' : `${value}d`,
              }))}
              value={days}
              onChange={setDays}
              ariaLabel="Analytics period"
            />
            {can(role, 'analytics:export') ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={exporting === 'csv'}
                  onClick={() => void onExport('csv')}
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                >
                  CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={exporting === 'pdf'}
                  onClick={() => void onExport('pdf')}
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                >
                  PDF
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {revenueQuery.isError ? (
        <Card>
          <ErrorState
            message={getErrorMessage(revenueQuery.error)}
            onRetry={() => void revenueQuery.refetch()}
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label={`Revenue · ${days}d`}
            value={formatCurrency(revenue?.totals.revenue, currency)}
            change={revenue?.totals.revenueChange}
            icon={<Wallet className="h-4 w-4" />}
            loading={loading}
          />
          <SummaryCard
            label="Transactions"
            value={formatNumber(revenue?.totals.transactions ?? 0)}
            change={revenue?.totals.transactionsChange}
            icon={<ShoppingBag className="h-4 w-4" />}
            loading={loading}
          />
          <SummaryCard
            label="Average basket"
            value={formatCurrency(revenue?.totals.avgTransaction, currency)}
            change={revenue?.totals.avgTransactionChange}
            icon={<BadgePercent className="h-4 w-4" />}
            loading={loading}
          />
          <SummaryCard
            label="Items sold"
            value={formatNumber(revenue?.totals.itemsSold ?? 0)}
            icon={<BarChart3 className="h-4 w-4" />}
            hint={revenue ? `${revenue.range.from} → ${revenue.range.to}` : undefined}
            loading={loading}
          />
        </div>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'revenue', label: 'Revenue', icon: <TrendingUp className="h-4 w-4" /> },
          { id: 'products', label: 'Products', icon: <Award className="h-4 w-4" /> },
          { id: 'customers', label: 'Customers', icon: <Users className="h-4 w-4" /> },
          { id: 'peak', label: 'Peak hours', icon: <Clock className="h-4 w-4" /> },
        ]}
      />

      {tab === 'revenue' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Revenue over time"
              description={`${titleCase(period)} aggregation · last ${days} days`}
              action={
                <SegmentedControl
                  size="sm"
                  options={[
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                  value={period}
                  onChange={setPeriod}
                  ariaLabel="Revenue aggregation"
                />
              }
            />
            <CardContent>
              {revenueQuery.isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : revenue && revenue.data.length > 0 ? (
                <RevenueAreaChart
                  data={revenue.data}
                  currency={currency}
                  height={300}
                  showTransactions
                />
              ) : (
                <EmptyState
                  title="No revenue in this period"
                  description="Sales recorded in this date range will appear here."
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Payment methods"
                description="How customers prefer to pay (last 30 days)"
              />
              <CardContent>
                <PaymentDonut data={payments} currency={currency} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader
                title="Period comparison"
                description={`${days} days vs previous ${days} days`}
              />
              <CardContent className="space-y-3">
                <CompareRow
                  label="Revenue"
                  current={formatCurrency(revenue?.totals.revenue, currency, { compact: true })}
                  previous={formatCurrency(revenue?.previous.revenue, currency, { compact: true })}
                  change={revenue?.totals.revenueChange ?? null}
                />
                <CompareRow
                  label="Transactions"
                  current={formatNumber(revenue?.totals.transactions ?? 0)}
                  previous={formatNumber(revenue?.previous.transactions ?? 0)}
                  change={revenue?.totals.transactionsChange ?? null}
                />
                <CompareRow
                  label="Avg. basket"
                  current={formatCurrency(revenue?.totals.avgTransaction, currency)}
                  previous={formatCurrency(revenue?.previous.avgTransaction, currency)}
                  change={revenue?.totals.avgTransactionChange ?? null}
                />
                <CompareRow
                  label="Items sold"
                  current={formatNumber(revenue?.totals.itemsSold ?? 0)}
                  previous={formatNumber(revenue?.previous.itemsSold ?? 0)}
                  change={null}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'products' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-500 dark:text-ink-400">
              Ranked across the last {days} days.
            </p>
            <Select
              value={productSort}
              onChange={(event) => setProductSort(event.target.value as typeof productSort)}
              className="w-auto min-w-[10rem] py-2 text-xs"
              aria-label="Rank products by"
            >
              <option value="revenue">By revenue</option>
              <option value="quantity">By quantity</option>
              <option value="profit">By profit</option>
            </Select>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Top performers"
                description={`Best ${products?.top.length ?? 0} products by ${productSort}`}
                action={
                  <Badge tone="success">
                    <TrendingUp className="h-3 w-3" /> Winners
                  </Badge>
                }
              />
              <CardContent className="space-y-3">
                {productQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))
                ) : products && products.top.length > 0 ? (
                  products.top.map((product, index) => {
                    const max = Number(products.top[0]?.revenue ?? 1);
                    const share = max > 0 ? (Number(product.revenue) / max) * 100 : 0;
                    return (
                      <div key={`${product.productId ?? product.name}-${index}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                                index === 0
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                                  : index === 1
                                    ? 'bg-ink-200 text-ink-600 dark:bg-ink-700 dark:text-ink-200'
                                    : index === 2
                                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
                                      : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300',
                              )}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                                {product.name}
                              </p>
                              <p className="text-[10px] text-ink-400">
                                {formatNumber(product.quantity)} sold · {product.margin.toFixed(1)}%
                                margin
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-bold text-ink-900 dark:text-white">
                              {formatCurrency(product.revenue, currency)}
                            </p>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(product.profit, currency)} profit
                            </p>
                          </div>
                        </div>
                        <div className="ml-9 mt-1.5 h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400"
                            style={{ width: `${Math.max(3, share)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="No product sales yet"
                    description="Start selling to unlock product intelligence."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Category mix" description="Revenue share by category" />
              <CardContent className="space-y-3.5">
                {productQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-8 w-full" />
                  ))
                ) : products && products.categories.length > 0 ? (
                  products.categories.map((category, index) => (
                    <div key={category.category}>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate font-medium text-ink-700 dark:text-ink-200">
                          {category.category}
                        </span>
                        <span className="shrink-0 font-bold text-ink-900 dark:text-white">
                          {formatCurrency(category.revenue, currency, { compact: true })}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              index % 4 === 0
                                ? 'bg-brand-500'
                                : index % 4 === 1
                                  ? 'bg-cyan-500'
                                  : index % 4 === 2
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-500',
                            )}
                            style={{
                              width: `${Math.max(3, (Number(category.revenue) / maxCategory) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-[10px] font-semibold text-ink-400">
                          {category.share.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-xs text-ink-400">No category data yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Needs attention"
              description="Slowest sellers in this period"
              action={
                <Badge tone="warning">
                  <TrendingDown className="h-3 w-3" /> Slow movers
                </Badge>
              }
            />
            <div className="divide-y divide-ink-100 dark:divide-ink-800">
              {products && products.bottom.length > 0 ? (
                products.bottom.map((product) => (
                  <div
                    key={product.productId ?? product.name}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500">
                        <ShoppingBag className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                          {product.name}
                        </p>
                        <p className="text-[10px] text-ink-400">
                          {formatNumber(product.quantity)} sold ·{' '}
                          {formatCurrency(product.revenue, currency)}
                        </p>
                      </div>
                    </div>
                    <Badge tone={product.quantity === 0 ? 'danger' : 'warning'}>
                      {product.quantity === 0 ? 'No sales' : 'Low velocity'}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="px-5 py-6 text-center text-xs text-ink-400">No products to review.</p>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'customers' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Named customers"
              value={formatNumber(customers?.totalCustomers ?? 0)}
              icon={<Users className="h-4 w-4" />}
              hint={`${formatPercent(customers?.repeatRate ?? 0, 1, false)} repeat rate`}
              loading={customerQuery.isLoading}
            />
            <SummaryCard
              label="Returning"
              value={formatNumber(customers?.returningCustomers ?? 0)}
              icon={<Repeat2 className="h-4 w-4" />}
              hint={`${formatNumber(customers?.loyalCustomers ?? 0)} loyal (3+ orders)`}
              loading={customerQuery.isLoading}
            />
            <SummaryCard
              label="Named revenue"
              value={formatCurrency(customers?.namedRevenue, currency, { compact: true })}
              icon={<Wallet className="h-4 w-4" />}
              hint="Attributed to known customers"
              loading={customerQuery.isLoading}
            />
            <SummaryCard
              label="Walk-in share"
              value={`${customers?.walkIn.share.toFixed(0) ?? 0}%`}
              icon={<UserRound className="h-4 w-4" />}
              hint={`${formatNumber(customers?.walkIn.transactions ?? 0)} anonymous transactions`}
              loading={customerQuery.isLoading}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Customer segments" description="By number of orders" />
              <CardContent className="space-y-3.5">
                {customerQuery.isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-8 w-full" />
                  ))
                ) : customers && customers.segments.length > 0 ? (
                  customers.segments.map((segment, index) => (
                    <div key={segment.label}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-ink-700 dark:text-ink-200">
                          {segment.label}
                        </span>
                        <span className="text-ink-500 dark:text-ink-400">
                          {formatNumber(segment.customers)} · {segment.percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            index === 0
                              ? 'bg-rose-400'
                              : index === 1
                                ? 'bg-amber-400'
                                : index === 2
                                  ? 'bg-cyan-500'
                                  : 'bg-emerald-500',
                          )}
                          style={{ width: `${Math.max(2, segment.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-xs text-ink-400">No named customers yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title="Top customers"
                description={`Last ${days} days`}
                action={
                  <Badge tone="brand">
                    <Award className="h-3 w-3" /> VIPs
                  </Badge>
                }
              />
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {customers && customers.topCustomers.length > 0 ? (
                  customers.topCustomers.slice(0, 8).map((customer, index) => (
                    <div key={customer.name} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-100 text-[10px] font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                          {customer.name}
                        </p>
                        <p className="text-[10px] text-ink-400">
                          {customer.orders} orders · avg{' '}
                          {formatCurrency(customer.avgOrder, currency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-ink-900 dark:text-white">
                          {formatCurrency(customer.spend, currency)}
                        </p>
                        <p className="text-[10px] text-ink-400">
                          last{' '}
                          {formatDate(customer.lastVisit, timezone, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No customer names captured"
                    description="Add a customer name at checkout to unlock retention analytics."
                  />
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'peak' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                Busiest hour
              </p>
              <p className="mt-1 text-2xl font-bold text-ink-900 dark:text-white">
                {peak?.busiestHour !== null && peak?.busiestHour !== undefined
                  ? `${String(peak.busiestHour).padStart(2, '0')}:00`
                  : '—'}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-400">Peak revenue window</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                Busiest day
              </p>
              <p className="mt-1 text-2xl font-bold text-ink-900 dark:text-white">
                {peak?.busiestWeekday ?? '—'}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-400">Best performing weekday</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                Staffing hint
              </p>
              <p className="mt-1 text-sm font-semibold leading-snug text-ink-900 dark:text-white">
                {peak?.busiestHour !== null && peak?.busiestHour !== undefined
                  ? `Add a second cashier around ${String(peak.busiestHour).padStart(2, '0')}:00.`
                  : 'Collect more sales to see a recommendation.'}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-400">Based on the last {days} days</p>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Revenue by hour of day"
              description="Aggregated across the selected period"
            />
            <CardContent>
              {peakQuery.isLoading ? (
                <Skeleton className="h-[240px] w-full" />
              ) : (
                <HourlyBarChart
                  data={
                    peak?.hours.map((hour) => ({
                      hour: hour.hour,
                      revenue: hour.revenue,
                      transactions: hour.transactions,
                    })) ?? []
                  }
                  currency={currency}
                  height={240}
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Revenue by weekday" description="Where the week makes its money" />
              <CardContent className="space-y-3">
                {peakQuery.isLoading
                  ? Array.from({ length: 7 }).map((_, index) => (
                      <Skeleton key={index} className="h-7 w-full" />
                    ))
                  : peak?.weekdays.map((day) => (
                      <div key={day.weekday} className="flex items-center gap-3">
                        <span className="w-8 shrink-0 text-[11px] font-semibold text-ink-500 dark:text-ink-400">
                          {day.label}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              day.label === peak.busiestWeekday
                                ? 'bg-gradient-to-r from-brand-500 to-cyan-400'
                                : 'bg-brand-400/60',
                            )}
                            style={{
                              width: `${Math.max(2, (Number(day.revenue) / maxWeekday) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right text-[11px] font-semibold text-ink-800 dark:text-ink-100">
                          {formatCurrency(day.revenue, currency, { compact: true })}
                        </span>
                      </div>
                    ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Peak-hour insights"
                description="Three signals worth acting on"
                action={
                  <Badge tone="brand">
                    <CalendarDays className="h-3 w-3" /> {days}d
                  </Badge>
                }
              />
              <CardContent className="space-y-3">
                {peak?.hours
                  .slice()
                  .sort((a, b) => Number(b.revenue) - Number(a.revenue))
                  .slice(0, 3)
                  .map((hour, index) => (
                    <div
                      key={hour.hour}
                      className="flex items-start gap-3 rounded-xl border border-ink-200 p-3 dark:border-ink-700"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-ink-800 dark:text-ink-100">
                          {String(hour.hour).padStart(2, '0')}:00 –{' '}
                          {String((hour.hour + 1) % 24).padStart(2, '0')}:00
                        </p>
                        <p className="text-[11px] text-ink-500 dark:text-ink-400">
                          {formatCurrency(hour.revenue, currency)} ·{' '}
                          {formatNumber(hour.transactions)} transactions · {hour.share.toFixed(1)}%
                          of revenue
                        </p>
                      </div>
                    </div>
                  ))}
                {peak && peak.hours.every((hour) => hour.transactions === 0) ? (
                  <p className="py-6 text-center text-xs text-ink-400">
                    No transactions in this period yet.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink-200 bg-white px-4 py-3 text-[11px] text-ink-500 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
        <span className="flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5" />
          All metrics are recomputed from raw transactions in {timezone}.
        </span>
        <span>Need a custom range? Export CSV and pivot in your spreadsheet.</span>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  change,
  icon,
  hint,
  loading,
}: {
  label: string;
  value: string;
  change?: number | null;
  icon: React.ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
            {label}
          </p>
          {loading ? (
            <div className="skeleton mt-2 h-6 w-24" />
          ) : (
            <p className="mt-1.5 truncate text-xl font-bold tracking-tight text-ink-900 dark:text-white">
              {value}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-ink-400">
            {hint ??
              (change !== undefined && change !== null
                ? formatPercent(change)
                : 'vs previous period')}
          </p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          {icon}
        </span>
      </div>
    </Card>
  );
}

function CompareRow({
  label,
  current,
  previous,
  change,
}: {
  label: string;
  current: string;
  previous: string;
  change: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-ink-500 dark:text-ink-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-bold text-ink-900 dark:text-white">{current}</span>
        <span className="text-[10px] text-ink-400">vs {previous}</span>
        {change !== null ? (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              change >= 0
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
            )}
          >
            {formatPercent(change)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
