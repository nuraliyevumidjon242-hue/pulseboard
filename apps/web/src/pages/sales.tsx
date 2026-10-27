import {
  ArrowDownUp,
  Banknote,
  CalendarDays,
  CreditCard,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/card';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ErrorState, SkeletonTable } from '../components/ui/feedback';
import { EmptyState } from '../components/ui/feedback';
import { Input, Select } from '../components/ui/form';
import { DataCard, Pagination, Table, TableRow, Td, Th } from '../components/ui/table';
import { NewSaleModal } from '../features/sales/new-sale-modal';
import { SaleDetailDrawer } from '../features/sales/sale-detail-drawer';
import { useDashboard, useSales } from '../hooks/api';
import { useStoreContext } from '../hooks/use-store-context';
import { usePageTitle, useDebouncedValue } from '../hooks/use-utils';
import { can } from '../lib/permissions';
import { formatCurrency, formatDateTime, formatNumber, paymentLabel, toNumber } from '../lib/utils';
import { useQueryClient } from '@tanstack/react-query';

export default function SalesPage() {
  usePageTitle('Sales');
  const queryClient = useQueryClient();
  const { storeId, currency, timezone, role } = useStoreContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedSale, setSelectedSale] = useState<string | null>(null);

  const modalOpen = searchParams.get('new') === '1';

  const params = useMemo(
    () => ({
      page,
      limit,
      sortOrder,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
    [page, limit, sortOrder, debouncedSearch, paymentMethod, from, to],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useSales(storeId, params);
  const { data: dashboard } = useDashboard(storeId, 30);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, paymentMethod, from, to, limit, sortOrder]);

  const openModal = () => {
    const next = new URLSearchParams(searchParams);
    next.set('new', '1');
    setSearchParams(next, { replace: true });
  };

  const closeModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
    void queryClient.invalidateQueries({ queryKey: ['sales'] });
  };

  const clearFilters = () => {
    setSearch('');
    setPaymentMethod('');
    setFrom('');
    setTo('');
  };

  const hasFilters = Boolean(search || paymentMethod || from || to);

  const stats = [
    {
      label: 'Revenue today',
      value: formatCurrency(dashboard?.today.revenue, currency),
      hint: `${formatNumber(dashboard?.today.transactions ?? 0)} transactions`,
      icon: Wallet,
      tone: 'text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10',
    },
    {
      label: 'Items sold',
      value: formatNumber(dashboard?.today.itemsSold ?? 0),
      hint: 'Units across all sales today',
      icon: ShoppingBag,
      tone: 'text-cyan-600 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-500/10',
    },
    {
      label: 'Average basket',
      value: formatCurrency(dashboard?.today.avgTransaction, currency),
      hint: 'Per transaction today',
      icon: ReceiptText,
      tone: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: '30-day revenue',
      value: formatCurrency(dashboard?.last30Days.revenue, currency, { compact: true }),
      hint: `${formatNumber(dashboard?.last30Days.transactions ?? 0)} transactions`,
      icon: Banknote,
      tone: 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10',
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Point of sale"
        title="Sales"
        description="Every transaction, with live totals, payment mix and cashier attribution."
        actions={
          can(role, 'sales:write') ? (
            <Button onClick={openModal} leftIcon={<Plus className="h-4 w-4" />}>
              Record sale
              <span className="kbd ml-1 border-white/25 bg-white/10 text-white/80">N</span>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                    {stat.label}
                  </p>
                  <p className="mt-1.5 text-xl font-bold tracking-tight text-ink-900 dark:text-white">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-400">{stat.hint}</p>
                </div>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${stat.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <DataCard>
        <div className="flex flex-wrap items-end gap-2 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="min-w-[12rem] flex-1">
            <Input
              placeholder="Search transaction ID or customer…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              aria-label="Search sales"
            />
          </div>
          <Select
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            aria-label="Filter by payment method"
            className="w-auto min-w-[8.5rem]"
          >
            <option value="">All payments</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="mobile">Mobile pay</option>
            <option value="cheque">Cheque</option>
          </Select>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              aria-label="From date"
              className="w-[9.5rem] py-2 text-xs"
            />
            <span className="text-xs text-ink-400">→</span>
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              aria-label="To date"
              className="w-[9.5rem] py-2 text-xs"
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setSortOrder((value) => (value === 'desc' ? 'asc' : 'desc'))}
            leftIcon={<ArrowDownUp className="h-3.5 w-3.5" />}
            title="Toggle sort order"
          >
            {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          </Button>
          {hasFilters ? (
            <Button variant="ghost" size="md" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <SkeletonTable rows={8} columns={6} />
        ) : isError ? (
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
            onRetry={() => void refetch()}
          />
        ) : data && data.data.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No sales match those filters' : 'No sales yet'}
            description={
              hasFilters
                ? 'Try widening the date range or clearing the search.'
                : 'Record your first sale to see revenue, items and payment methods here.'
            }
            action={
              can(role, 'sales:write') ? (
                <Button size="sm" onClick={openModal} leftIcon={<Plus className="h-3.5 w-3.5" />}>
                  Record a sale
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Transaction</Th>
                  <Th>Date</Th>
                  <Th>Cashier</Th>
                  <Th className="text-center">Items</Th>
                  <Th>Payment</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((sale) => (
                  <TableRow
                    key={sale.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedSale(sale.id)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') setSelectedSale(sale.id);
                    }}
                  >
                    <Td>
                      <span className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                          {sale.paymentMethod === 'cash' ? (
                            <Banknote className="h-3.5 w-3.5" />
                          ) : sale.paymentMethod === 'mobile' ? (
                            <Smartphone className="h-3.5 w-3.5" />
                          ) : (
                            <CreditCard className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span>
                          <span className="block font-mono text-[11px] font-semibold text-ink-800 dark:text-ink-100">
                            {sale.transactionId}
                          </span>
                          <span className="block text-[10px] text-ink-400">
                            {sale.items.length} line{sale.items.length === 1 ? '' : 's'}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                        <CalendarDays className="h-3.5 w-3.5 text-ink-400" />
                        {formatDateTime(sale.createdAt, timezone)}
                      </span>
                    </Td>
                    <Td className="text-xs">{sale.cashierName ?? 'Store team'}</Td>
                    <Td className="text-center text-xs">
                      {sale.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </Td>
                    <Td>
                      <Badge tone={sale.paymentMethod === 'cash' ? 'success' : 'brand'}>
                        {paymentLabel(sale.paymentMethod)}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <span className="font-semibold text-ink-900 dark:text-white">
                        {formatCurrency(sale.finalAmount, currency)}
                      </span>
                      {toNumber(sale.discount) > 0 ? (
                        <span className="ml-1 block text-[10px] text-ink-400 line-through">
                          {formatCurrency(sale.totalAmount, currency)}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-right">
                      <Badge tone="success">Completed</Badge>
                    </Td>
                  </TableRow>
                ))}
              </tbody>
            </Table>
            <Pagination meta={data?.meta} onPageChange={setPage} onLimitChange={setLimit} />
          </>
        )}
        {isFetching && !isLoading ? (
          <div className="border-t border-ink-100 px-4 py-1.5 text-[10px] font-medium text-ink-400 dark:border-ink-800">
            Syncing latest sales…
          </div>
        ) : null}
      </DataCard>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
          <span className="flex items-center gap-1.5">
            <ReceiptText className="h-3.5 w-3.5" /> Click any row to inspect line items and reprint
            the receipt.
          </span>
          <span className="text-ink-300 dark:text-ink-700">•</span>
          <span>Discounts are included in reported revenue.</span>
        </CardContent>
      </Card>

      <NewSaleModal open={modalOpen} onClose={closeModal} />
      <SaleDetailDrawer saleId={selectedSale} onClose={() => setSelectedSale(null)} />
    </div>
  );
}
