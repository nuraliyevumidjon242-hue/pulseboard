import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  Printer,
  ScanLine,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '../../hooks/use-utils';
import { useProducts } from '../../hooks/api';
import { useStoreContext } from '../../hooks/use-store-context';
import { api, getErrorMessage } from '../../lib/api';
import { cn, formatCurrency, formatNumber, paymentLabel, toNumber } from '../../lib/utils';
import { toast } from '../../stores/toast-store';
import type { CreateSaleResponse, PaymentMethod, Product } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Field, Input, Textarea } from '../../components/ui/form';
import { Spinner } from '../../components/ui/feedback';
import { Modal } from '../../components/ui/modal';
import { printReceipt } from './receipt-print';
import { t } from '../../lib/i18n';

interface CartLine {
  product: Product;
  quantity: number;
}

const PAYMENT_METHODS: Array<{
  value: PaymentMethod;
  label: string;
  icon: typeof Banknote;
}> = [
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'mobile', label: 'Mobile pay', icon: Smartphone },
  { value: 'cheque', label: 'Cheque', icon: Wallet },
];

export function NewSaleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { storeId, store, currency } = useStoreContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [discount, setDiscount] = useState('0');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [receipt, setReceipt] = useState<CreateSaleResponse | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const { data: products, isLoading } = useProducts(storeId, {
    search: debouncedSearch || undefined,
    limit: 12,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + toNumber(line.product.price) * line.quantity, 0),
    [cart],
  );
  const discountValue = Math.min(Math.max(toNumber(discount), 0), subtotal);
  const total = Math.max(0, Math.round((subtotal - discountValue) * 100) / 100);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const reset = () => {
    setCart([]);
    setDiscount('0');
    setCustomerName('');
    setNotes('');
    setPaymentMethod('card');
    setSearch('');
    setBarcode('');
    setShowDetails(false);
  };

  const addProduct = (product: Product, quantity = 1) => {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        if (existing.quantity + quantity > product.currentStock) {
          toast.warning(
            t('Not enough stock'),
            t('Only {{count}} {{unit}} available.', {
              count: product.currentStock,
              unit: t(product.unit),
            }),
          );
          return current;
        }
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + quantity } : line,
        );
      }
      if (product.currentStock < quantity) {
        toast.warning(
          t('Out of stock'),
          t('{{name}} is not available right now.', { name: product.name }),
        );
        return current;
      }
      return [...current, { product, quantity }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) => {
          if (line.product.id !== productId) return line;
          const next = line.quantity + delta;
          if (next > line.product.currentStock) {
            toast.warning(
              t('Stock limit reached'),
              t('Only {{count}} available.', { count: line.product.currentStock }),
            );
            return line;
          }
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0),
    );
  };

  const saleMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ data: CreateSaleResponse }>(`/stores/${storeId}/sales`, {
        items: cart.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
        paymentMethod,
        discount: discountValue,
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      return response.data.data;
    },
    onSuccess: (result) => {
      setReceipt(result);
      toast.success(
        t('Sale completed'),
        t('{{amount}} recorded.', {
          amount: formatCurrency(result.sale.finalAmount, currency),
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => toast.error(t('Could not record sale'), getErrorMessage(error)),
  });

  const lookupBarcode = async () => {
    if (!storeId || !barcode.trim()) return;
    setLookingUp(true);
    try {
      const response = await api.get<{ data: { product: Product } }>(
        `/stores/${storeId}/products/barcode/${encodeURIComponent(barcode.trim())}`,
      );
      addProduct(response.data.data.product);
      setBarcode('');
      barcodeRef.current?.focus();
    } catch (error) {
      toast.error(t('Product not found'), getErrorMessage(error));
    } finally {
      setLookingUp(false);
    }
  };

  const close = () => {
    if (saleMutation.isPending) return;
    if (receipt) {
      setReceipt(null);
      reset();
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={receipt ? t('Sale completed') : t('Record a sale')}
      description={
        receipt
          ? `${receipt.receipt.transactionId} · ${t('{{count}} line items', {
              count: receipt.sale.items.length,
            })}`
          : store
            ? t('New transaction for {{store}}', { store: store.name })
            : undefined
      }
      size="xl"
      footer={
        receipt ? (
          <>
            <Button
              variant="secondary"
              onClick={() => printReceipt(receipt)}
              leftIcon={<Printer className="h-4 w-4" />}
            >
              {t('Print receipt')}
            </Button>
            <Button
              onClick={() => {
                setReceipt(null);
                reset();
                window.setTimeout(() => barcodeRef.current?.focus(), 100);
              }}
            >
              {t('Record another sale')}
            </Button>
          </>
        ) : (
          <>
            <div className="mr-auto text-xs text-ink-500 dark:text-ink-400">
              {t('{{count}} items · subtotal', {
                count: formatNumber(itemCount),
              })}{' '}
              <span className="font-semibold text-ink-800 dark:text-ink-100">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>
            <Button variant="secondary" onClick={close} disabled={saleMutation.isPending}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={() => saleMutation.mutate()}
              loading={saleMutation.isPending}
              disabled={cart.length === 0}
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              {t('Complete sale ·')} {formatCurrency(total, currency)}
            </Button>
          </>
        )
      }
    >
      {receipt ? (
        <ReceiptView result={receipt} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-3">
            <Field label={t('Find products')} htmlFor="sale-search">
              <Input
                id="sale-search"
                placeholder={t('Search by name, SKU or barcode…')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
                autoComplete="off"
              />
            </Field>

            <div className="flex gap-2">
              <Input
                ref={barcodeRef}
                placeholder={t('Scan barcode and press Enter')}
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void lookupBarcode();
                  }
                }}
                leftIcon={<ScanLine className="h-4 w-4" />}
                autoComplete="off"
              />
              <Button
                variant="secondary"
                onClick={() => void lookupBarcode()}
                loading={lookingUp}
                disabled={!barcode.trim()}
              >
                {t('Add')}
              </Button>
            </div>

            <div className="scrollbar-thin max-h-[21rem] space-y-1.5 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner className="h-5 w-5" />
                </div>
              ) : products && products.data.length > 0 ? (
                products.data.map((product) => {
                  const out = product.currentStock <= 0;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={out}
                      onClick={() => addProduct(product)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white p-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-55 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/[0.06]',
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-[10px] font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                        {product.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                          {product.name}
                        </span>
                        <span className="block truncate text-[10px] text-ink-500 dark:text-ink-400">
                          {product.sku} · {product.category ?? t('Uncategorised')}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-bold text-ink-900 dark:text-white">
                          {formatCurrency(product.price, currency)}
                        </span>
                        <span
                          className={cn(
                            'block text-[10px] font-medium',
                            out
                              ? 'text-rose-500'
                              : product.currentStock <= product.minStock
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-ink-400',
                          )}
                        >
                          {out ? t('Out of stock') : `${product.currentStock} ${t(product.unit)}`}
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-xs text-ink-500 dark:border-ink-700 dark:text-ink-400">
                  {t('No products match “')}
                  {search}”.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-ink-200 bg-ink-50/60 p-3.5 dark:border-ink-700 dark:bg-ink-950/40">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-600 dark:text-ink-300">
                <ShoppingCart className="h-3.5 w-3.5" /> {t('Cart')}
              </h3>
              {cart.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-[10px] font-semibold text-ink-400 hover:text-rose-500"
                >
                  {t('Clear')}
                </button>
              ) : null}
            </div>

            <div className="scrollbar-thin min-h-[9rem] flex-1 space-y-1.5 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex h-full min-h-[9rem] flex-col items-center justify-center gap-1 text-center">
                  <ShoppingCart className="h-7 w-7 text-ink-300 dark:text-ink-600" />
                  <p className="text-xs font-medium text-ink-500 dark:text-ink-400">
                    {t('Cart is empty')}
                  </p>
                  <p className="max-w-[12rem] text-[10px] text-ink-400">
                    {t('Pick a product on the left or scan a barcode to begin.')}
                  </p>
                </div>
              ) : (
                cart.map((line) => (
                  <div
                    key={line.product.id}
                    className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-2.5 py-2 dark:border-ink-700 dark:bg-ink-900"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-ink-800 dark:text-ink-100">
                        {line.product.name}
                      </p>
                      <p className="text-[10px] text-ink-400">
                        {formatCurrency(line.product.price, currency)} {t('each')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.product.id, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-ink-200 text-ink-500 transition hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-800"
                        aria-label={t('Reduce {{name}}', { name: line.product.name })}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-[11px] font-bold text-ink-900 dark:text-white">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.product.id, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-ink-200 text-ink-500 transition hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-800"
                        aria-label={t('Increase {{name}}', { name: line.product.name })}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="w-16 shrink-0 text-right text-[11px] font-bold text-ink-900 dark:text-white">
                      {formatCurrency(toNumber(line.product.price) * line.quantity, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCart((current) =>
                          current.filter((item) => item.product.id !== line.product.id),
                        )
                      }
                      className="shrink-0 text-ink-300 transition hover:text-rose-500"
                      aria-label={t('Remove {{name}}', { name: line.product.name })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 space-y-2 border-t border-ink-200 pt-3 dark:border-ink-700">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
                {t('Payment method')}
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  const active = paymentMethod === method.value;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-semibold transition',
                        active
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400/60 dark:bg-brand-500/10 dark:text-brand-300'
                          : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t(method.label)}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label={t('Discount')} htmlFor="sale-discount">
                  <Input
                    id="sale-discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                    className="py-1.5 text-xs"
                  />
                </Field>
                <Field label={t('Customer')} htmlFor="sale-customer">
                  <Input
                    id="sale-customer"
                    placeholder={t('Optional name')}
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="py-1.5 text-xs"
                  />
                </Field>
              </div>

              <button
                type="button"
                onClick={() => setShowDetails((value) => !value)}
                className="text-[10px] font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                {showDetails ? t('Hide note') : t('Add a note')}
              </button>
              {showDetails ? (
                <Textarea
                  rows={2}
                  placeholder={t('Internal note for this sale')}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="text-xs"
                />
              ) : null}

              <div className="space-y-1 border-t border-ink-200 pt-2.5 text-xs dark:border-ink-700">
                <div className="flex justify-between text-ink-500 dark:text-ink-400">
                  <span>{t('Subtotal')}</span>
                  <span className="font-medium text-ink-700 dark:text-ink-200">
                    {formatCurrency(subtotal, currency)}
                  </span>
                </div>
                {discountValue > 0 ? (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>{t('Discount')}</span>
                    <span className="font-medium">−{formatCurrency(discountValue, currency)}</span>
                  </div>
                ) : null}
                <div className="flex items-end justify-between pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
                    {t('Total')}
                  </span>
                  <span className="text-xl font-bold tracking-tight text-ink-900 dark:text-white">
                    {formatCurrency(total, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ReceiptView({ result }: { result: CreateSaleResponse }) {
  const { sale, receipt } = result;
  return (
    <div className="mx-auto max-w-md">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <p className="mt-3 text-2xl font-bold tracking-tight text-ink-900 dark:text-white">
          {formatCurrency(sale.finalAmount, receipt.currency)}
        </p>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          {receipt.transactionId} · {paymentLabel(sale.paymentMethod)} ·{' '}
          {receipt.cashierName ?? t('Store team')}
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-ink-200 bg-ink-50/60 p-4 dark:border-ink-700 dark:bg-ink-950/40">
        <div className="space-y-2">
          {sale.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-ink-700 dark:text-ink-200">
                {item.quantity} × {item.productName}
              </span>
              <span className="shrink-0 font-semibold text-ink-900 dark:text-white">
                {formatCurrency(item.subtotal, receipt.currency)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1 border-t border-ink-200 pt-3 text-xs dark:border-ink-700">
          <div className="flex justify-between text-ink-500 dark:text-ink-400">
            <span>{t('Subtotal')}</span>
            <span>{formatCurrency(sale.totalAmount, receipt.currency)}</span>
          </div>
          {Number(sale.discount) > 0 ? (
            <div className="flex justify-between text-ink-500 dark:text-ink-400">
              <span>{t('Discount')}</span>
              <span>−{formatCurrency(sale.discount, receipt.currency)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-sm font-bold text-ink-900 dark:text-white">
            <span>{t('Total paid')}</span>
            <span>{formatCurrency(sale.finalAmount, receipt.currency)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <Badge tone="success">{t('Stock updated')}</Badge>
        <Badge tone="brand">{t('Dashboard synced')}</Badge>
      </div>
    </div>
  );
}
