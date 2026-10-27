import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeftRight,
  Download,
  Layers,
  Package,
  PackageCheck,
  PackagePlus,
  PackageX,
  Pencil,
  Search,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState, ErrorState, SkeletonTable } from '../components/ui/feedback';
import { Checkbox, Input, Select } from '../components/ui/form';
import { Tabs } from '../components/ui/tabs';
import { DataCard, Pagination, Table, TableRow, Td, Th } from '../components/ui/table';
import { ConfirmDialog } from '../components/ui/modal';
import { ProductModal } from '../features/inventory/product-modal';
import { AdjustStockModal } from '../features/inventory/adjust-stock-modal';
import { ImportProductsModal } from '../features/inventory/import-products-modal';
import {
  useAdjustments,
  useCategories,
  useInventorySummary,
  useLowStock,
  useProducts,
} from '../hooks/api';
import { useStoreContext } from '../hooks/use-store-context';
import { useDebouncedValue, usePageTitle } from '../hooks/use-utils';
import { api, downloadInventoryCsv, getErrorMessage } from '../lib/api';
import { can } from '../lib/permissions';
import {
  cn,
  computeStockTone,
  formatCurrency,
  formatDateTime,
  formatNumber,
  titleCase,
} from '../lib/utils';
import { toast } from '../stores/toast-store';
import type { InventoryAdjustment, Product } from '../types';

export default function InventoryPage() {
  usePageTitle('Inventory');
  const queryClient = useQueryClient();
  const { storeId, currency, timezone, role } = useStoreContext();
  const [tab, setTab] = useState('products');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [category, setCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'price' | 'stock'>('name');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [productModal, setProductModal] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const [exporting, setExporting] = useState(false);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustPage, setAdjustPage] = useState(1);

  const canWriteProducts = can(role, 'products:write');
  const canAdjust = can(role, 'inventory:write');
  const canExport = can(role, 'analytics:export');

  const productsQuery = useProducts(storeId, {
    page,
    limit,
    sortBy,
    sortOrder: sortBy === 'name' ? 'asc' : 'desc',
    search: debouncedSearch || undefined,
    category: category || undefined,
    lowStockOnly: lowStockOnly || undefined,
    includeInactive: includeInactive || undefined,
  });

  const summaryQuery = useInventorySummary(storeId);
  const categoriesQuery = useCategories(storeId);
  const lowStockQuery = useLowStock(storeId);
  const adjustmentsQuery = useAdjustments(canAdjust && tab === 'adjustments' ? storeId : null, {
    page: adjustPage,
    limit: 15,
    reason: adjustReason || undefined,
  });

  const summary = summaryQuery.data;
  const lowStock = lowStockQuery.data ?? [];

  const archiveMutation = useMutation({
    mutationFn: (product: Product) => api.delete(`/stores/${storeId}/products/${product.id}`),
    onSuccess: () => {
      toast.success('Product archived', 'You can restore it by editing archived products.');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setArchiveTarget(null);
    },
    onError: (error) => toast.error('Could not archive product', getErrorMessage(error)),
  });

  const onExport = async () => {
    if (!storeId) return;
    setExporting(true);
    try {
      await downloadInventoryCsv(storeId);
      toast.success('Inventory exported', 'The CSV file has been downloaded.');
    } catch (error) {
      toast.error('Export failed', getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const openCreate = () => setProductModal({ open: true, product: null });
  const openEdit = (product: Product) => setProductModal({ open: true, product });

  const stats = useMemo(
    () => [
      {
        label: 'Active products',
        value: formatNumber(summary?.activeProducts ?? 0),
        hint: `${formatNumber(summary?.totalProducts ?? 0)} in catalogue`,
        icon: PackageCheck,
        tone: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
      },
      {
        label: 'Low stock',
        value: formatNumber(summary?.lowStockCount ?? 0),
        hint: 'At or below min level',
        icon: TriangleAlert,
        tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
      },
      {
        label: 'Out of stock',
        value: formatNumber(summary?.outOfStockCount ?? 0),
        hint: 'Needs restocking now',
        icon: PackageX,
        tone: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
      },
      {
        label: 'Inventory value',
        value: formatCurrency(summary?.inventoryValue, currency, { compact: true }),
        hint: `Potential ${formatCurrency(summary?.potentialRevenue, currency, { compact: true })}`,
        icon: Layers,
        tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
      },
    ],
    [summary, currency],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Stock control"
        title="Inventory"
        description="Catalogue, stock levels and the full audit trail of every adjustment."
        actions={
          <>
            {canExport ? (
              <Button
                variant="secondary"
                loading={exporting}
                onClick={() => void onExport()}
                leftIcon={<Download className="h-4 w-4" />}
              >
                Export
              </Button>
            ) : null}
            {canAdjust ? (
              <Button
                variant="secondary"
                onClick={() => setImportOpen(true)}
                leftIcon={<Upload className="h-4 w-4" />}
              >
                Import
              </Button>
            ) : null}
            {canWriteProducts ? (
              <Button onClick={openCreate} leftIcon={<PackagePlus className="h-4 w-4" />}>
                Add product
              </Button>
            ) : null}
          </>
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
        <Tabs
          active={tab}
          onChange={setTab}
          className="px-3 pt-1"
          tabs={[
            { id: 'products', label: 'Products', icon: <Package className="h-4 w-4" /> },
            ...(canAdjust
              ? [
                  {
                    id: 'adjustments',
                    label: 'Adjustments',
                    icon: <ArrowLeftRight className="h-4 w-4" />,
                  },
                ]
              : []),
            {
              id: 'low-stock',
              label: 'Low stock',
              icon: <TriangleAlert className="h-4 w-4" />,
              badge: lowStock.length,
            },
          ]}
        />

        {tab === 'products' ? (
          <>
            <div className="flex flex-wrap items-end gap-2 border-b border-ink-100 p-4 dark:border-ink-800">
              <div className="min-w-[12rem] flex-1">
                <Input
                  placeholder="Search name, SKU or barcode…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  leftIcon={<Search className="h-4 w-4" />}
                  aria-label="Search products"
                />
              </div>
              <Select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPage(1);
                }}
                className="w-auto min-w-[9rem]"
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {(categoriesQuery.data ?? []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
              <Select
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as typeof sortBy);
                  setPage(1);
                }}
                className="w-auto min-w-[9rem]"
                aria-label="Sort products"
              >
                <option value="name">Name</option>
                <option value="price">Price</option>
                <option value="stock">Stock</option>
                <option value="createdAt">Newest</option>
              </Select>
              <label className="flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-ink-200 px-3 text-xs font-medium text-ink-600 dark:border-ink-700 dark:text-ink-300">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(event) => {
                    setLowStockOnly(event.target.checked);
                    setPage(1);
                  }}
                  className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500/40"
                />
                Low stock
              </label>
              <div className="flex h-10 items-center px-1">
                <Checkbox
                  label="Archived"
                  checked={includeInactive}
                  onChange={(event) => {
                    setIncludeInactive(event.target.checked);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            {productsQuery.isLoading ? (
              <SkeletonTable rows={8} columns={7} />
            ) : productsQuery.isError ? (
              <ErrorState
                message={getErrorMessage(productsQuery.error)}
                onRetry={() => void productsQuery.refetch()}
              />
            ) : productsQuery.data && productsQuery.data.data.length === 0 ? (
              <EmptyState
                title="No products found"
                description={
                  search || category || lowStockOnly
                    ? 'Adjust your filters or add a new product.'
                    : 'Add your first product to start tracking stock.'
                }
                action={
                  canWriteProducts ? (
                    <Button
                      size="sm"
                      onClick={openCreate}
                      leftIcon={<PackagePlus className="h-3.5 w-3.5" />}
                    >
                      Add product
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Product</Th>
                      <Th>Category</Th>
                      <Th className="text-right">Price</Th>
                      <Th className="text-right">Margin</Th>
                      <Th className="text-center">Stock</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsQuery.data?.data.map((product) => {
                      const tone = computeStockTone(product.currentStock, product.minStock);
                      const margin =
                        product.cost && Number(product.price) > 0
                          ? ((Number(product.price) - Number(product.cost)) /
                              Number(product.price)) *
                            100
                          : null;
                      return (
                        <TableRow
                          key={product.id}
                          className={cn(!product.isActive && 'opacity-60')}
                        >
                          <Td>
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-ink-100 to-ink-200 text-[10px] font-bold text-ink-500 dark:from-ink-800 dark:to-ink-700 dark:text-ink-300">
                                {product.name.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                                  {product.name}
                                </span>
                                <span className="block font-mono text-[10px] text-ink-400">
                                  {product.sku}
                                  {product.barcode ? ` · ${product.barcode}` : ''}
                                </span>
                              </span>
                            </div>
                          </Td>
                          <Td className="text-xs">{product.category ?? '—'}</Td>
                          <Td className="text-right text-xs font-semibold">
                            {formatCurrency(product.price, currency)}
                          </Td>
                          <Td className="text-right text-xs">
                            {margin === null ? (
                              <span className="text-ink-400">—</span>
                            ) : (
                              <span
                                className={
                                  margin >= 30
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-ink-500 dark:text-ink-400'
                                }
                              >
                                {margin.toFixed(0)}%
                              </span>
                            )}
                          </Td>
                          <Td className="text-center">
                            <span className="text-xs font-bold text-ink-900 dark:text-white">
                              {product.currentStock}
                            </span>
                            <span className="ml-1 text-[10px] text-ink-400">{product.unit}</span>
                            <span className="mt-0.5 block text-[10px] text-ink-400">
                              min {product.minStock}
                            </span>
                          </Td>
                          <Td>
                            {!product.isActive ? (
                              <Badge tone="neutral">Archived</Badge>
                            ) : tone === 'out' ? (
                              <Badge tone="danger">Out of stock</Badge>
                            ) : tone === 'low' ? (
                              <Badge tone="warning">Low stock</Badge>
                            ) : (
                              <Badge tone="success">Healthy</Badge>
                            )}
                          </Td>
                          <Td>
                            <div className="flex items-center justify-end gap-1">
                              {canAdjust ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Adjust stock"
                                  aria-label={`Adjust stock for ${product.name}`}
                                  onClick={() => setAdjustTarget(product)}
                                >
                                  <ArrowLeftRight className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                              {canWriteProducts ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Edit product"
                                    aria-label={`Edit ${product.name}`}
                                    onClick={() => openEdit(product)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Archive product"
                                    aria-label={`Archive ${product.name}`}
                                    onClick={() => setArchiveTarget(product)}
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </Td>
                        </TableRow>
                      );
                    })}
                  </tbody>
                </Table>
                <Pagination
                  meta={productsQuery.data?.meta}
                  onPageChange={setPage}
                  onLimitChange={setLimit}
                />
              </>
            )}
          </>
        ) : null}

        {tab === 'adjustments' && canAdjust ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-4 dark:border-ink-800">
              <Select
                value={adjustReason}
                onChange={(event) => {
                  setAdjustReason(event.target.value);
                  setAdjustPage(1);
                }}
                className="w-auto min-w-[10rem]"
                aria-label="Filter adjustments by reason"
              >
                <option value="">All reasons</option>
                <option value="purchase">Purchase</option>
                <option value="sale">Sale</option>
                <option value="loss">Loss</option>
                <option value="damage">Damage</option>
                <option value="correction">Correction</option>
                <option value="return">Return</option>
              </Select>
              <p className="text-[11px] text-ink-400">
                Every stock change is recorded with before/after quantities.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto"
                onClick={() => setAdjustTarget(lowStock[0] ?? null)}
                disabled={lowStock.length === 0}
                leftIcon={<ArrowLeftRight className="h-3.5 w-3.5" />}
              >
                Adjust stock
              </Button>
            </div>

            {adjustmentsQuery.isLoading ? (
              <SkeletonTable rows={7} columns={6} />
            ) : adjustmentsQuery.isError ? (
              <ErrorState
                message={getErrorMessage(adjustmentsQuery.error)}
                onRetry={() => void adjustmentsQuery.refetch()}
              />
            ) : adjustmentsQuery.data && adjustmentsQuery.data.data.length === 0 ? (
              <EmptyState
                title="No adjustments yet"
                description="Stock changes from sales, deliveries and corrections will appear here."
              />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Product</Th>
                      <Th className="text-center">Change</Th>
                      <Th className="text-center">Before → After</Th>
                      <Th>Reason</Th>
                      <Th>Notes</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustmentsQuery.data?.data.map((adjustment: InventoryAdjustment) => (
                      <TableRow key={adjustment.id}>
                        <Td className="whitespace-nowrap text-xs">
                          {formatDateTime(adjustment.createdAt, timezone)}
                        </Td>
                        <Td className="text-xs font-medium">
                          {adjustment.productName ?? 'Deleted product'}
                        </Td>
                        <Td className="text-center">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px] font-bold',
                              adjustment.quantityChanged > 0
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
                            )}
                          >
                            {adjustment.quantityChanged > 0 ? '+' : ''}
                            {adjustment.quantityChanged}
                          </span>
                        </Td>
                        <Td className="text-center text-xs text-ink-500 dark:text-ink-400">
                          {adjustment.oldQuantity} →{' '}
                          <span className="font-semibold text-ink-800 dark:text-ink-100">
                            {adjustment.newQuantity}
                          </span>
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              adjustment.reason === 'purchase' || adjustment.reason === 'return'
                                ? 'success'
                                : adjustment.reason === 'sale'
                                  ? 'brand'
                                  : 'warning'
                            }
                          >
                            {titleCase(adjustment.reason)}
                          </Badge>
                        </Td>
                        <Td className="max-w-[14rem] truncate text-xs text-ink-500 dark:text-ink-400">
                          {adjustment.notes ?? '—'}
                        </Td>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
                <Pagination meta={adjustmentsQuery.data?.meta} onPageChange={setAdjustPage} />
              </>
            )}
          </>
        ) : null}

        {tab === 'low-stock' ? (
          <div className="p-4">
            {lowStockQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="skeleton h-32 rounded-2xl" />
                ))}
              </div>
            ) : lowStock.length === 0 ? (
              <EmptyState
                title="All stock is healthy"
                description="No product is at or below its minimum stock level."
                icon={<PackageCheck className="h-6 w-6" />}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {lowStock.map((product) => {
                  const tone = computeStockTone(product.currentStock, product.minStock);
                  const ratio =
                    product.minStock > 0 ? (product.currentStock / product.minStock) * 100 : 0;
                  return (
                    <div
                      key={product.id}
                      className="rounded-2xl border border-ink-200 p-4 transition hover:border-ink-300 dark:border-ink-700 dark:hover:border-ink-600"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                            {product.name}
                          </p>
                          <p className="font-mono text-[10px] text-ink-400">{product.sku}</p>
                        </div>
                        <Badge tone={tone === 'out' ? 'danger' : 'warning'}>
                          {tone === 'out' ? 'Out' : 'Low'}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-ink-900 dark:text-white">
                          {product.currentStock}
                        </span>
                        <span className="text-xs text-ink-400">
                          {product.unit} · min {product.minStock}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            tone === 'out' ? 'bg-rose-500' : 'bg-amber-500',
                          )}
                          style={{ width: `${Math.min(100, Math.max(3, ratio))}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[11px] text-ink-400">
                          {formatCurrency(product.price, currency)} / {product.unit}
                        </span>
                        {canAdjust ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setAdjustTarget(product)}
                            leftIcon={<PackagePlus className="h-3.5 w-3.5" />}
                          >
                            Restock
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </DataCard>

      <Card>
        <CardContent className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
          Stock is deducted automatically at checkout. Use adjustments for deliveries, returns,
          shrinkage and stock counts — PulseBoard keeps an immutable audit trail and alerts your
          team when items fall below their minimum.
        </CardContent>
      </Card>

      <ProductModal
        open={productModal.open}
        product={productModal.product}
        onClose={() => setProductModal({ open: false, product: null })}
      />
      <AdjustStockModal
        open={Boolean(adjustTarget)}
        product={adjustTarget}
        onClose={() => setAdjustTarget(null)}
      />
      <ImportProductsModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget)}
        title={`Archive ${archiveTarget?.name ?? 'product'}?`}
        description="Archived products stay in historical reports but disappear from the register."
        confirmLabel="Archive product"
        destructive
        loading={archiveMutation.isPending}
      />
    </div>
  );
}
