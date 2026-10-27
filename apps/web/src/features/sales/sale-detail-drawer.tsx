import { Printer, ReceiptText } from 'lucide-react';
import { useSale } from '../../hooks/api';
import { useStoreContext } from '../../hooks/use-store-context';
import { formatCurrency, formatDateTime, paymentLabel } from '../../lib/utils';
import type { CreateSaleResponse } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorState, LoadingBlock } from '../../components/ui/feedback';
import { Drawer } from '../../components/ui/drawer';
import { printReceipt } from './receipt-print';

export function SaleDetailDrawer({
  saleId,
  onClose,
}: {
  saleId: string | null;
  onClose: () => void;
}) {
  const { storeId, store, currency, timezone } = useStoreContext();
  const { data, isLoading, isError, error, refetch } = useSale(storeId, saleId);
  const sale = data?.sale;

  const onPrint = () => {
    if (!sale || !store) return;
    const payload: CreateSaleResponse = {
      sale,
      totals: {
        totalAmount: sale.totalAmount,
        discount: sale.discount,
        finalAmount: sale.finalAmount,
      },
      receipt: {
        storeName: store.name,
        address: null,
        currency,
        transactionId: sale.transactionId,
        cashierName: sale.cashierName,
        createdAt: sale.createdAt,
      },
    };
    printReceipt(payload);
  };

  return (
    <Drawer
      open={Boolean(saleId)}
      onClose={onClose}
      title={sale ? sale.transactionId : 'Sale details'}
      description={sale ? formatDateTime(sale.createdAt, timezone) : 'Loading transaction…'}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-ink-500 dark:text-ink-400">Recorded at the register</span>
          <Button
            variant="secondary"
            onClick={onPrint}
            disabled={!sale}
            leftIcon={<Printer className="h-4 w-4" />}
          >
            Print receipt
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <LoadingBlock label="Loading sale" />
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : sale ? (
        <div className="space-y-5">
          <div className="rounded-2xl gradient-brand p-5 text-white shadow-glow">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Total paid
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {formatCurrency(sale.finalAmount, currency)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge className="bg-white/15 text-white ring-white/20">
                {paymentLabel(sale.paymentMethod)}
              </Badge>
              <Badge className="bg-white/15 text-white ring-white/20">
                {sale.items.reduce((sum, item) => sum + item.quantity, 0)} items
              </Badge>
              {sale.discount !== '0.00' ? (
                <Badge className="bg-white/15 text-white ring-white/20">
                  −{formatCurrency(sale.discount, currency)} discount
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Cashier</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                {sale.cashierName ?? 'Store team'}
              </p>
            </div>
            <div className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Customer</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                {sale.customerName || 'Walk-in'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              <ReceiptText className="h-3.5 w-3.5" /> Line items
            </h3>
            <div className="overflow-hidden rounded-xl border border-ink-200 dark:border-ink-700">
              <table className="w-full">
                <thead className="bg-ink-50 dark:bg-ink-950/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-ink-500">
                      Item
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-ink-500">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-ink-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item) => (
                    <tr key={item.id} className="border-t border-ink-100 dark:border-ink-800">
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium text-ink-800 dark:text-ink-100">
                          {item.productName}
                        </p>
                        <p className="text-[10px] text-ink-400">
                          {formatCurrency(item.unitPrice, currency)} each
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-ink-600 dark:text-ink-300">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-ink-900 dark:text-white">
                        {formatCurrency(item.subtotal, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-1.5 rounded-xl bg-ink-50 p-4 text-xs dark:bg-ink-950/40">
            <div className="flex justify-between text-ink-500 dark:text-ink-400">
              <span>Subtotal</span>
              <span>{formatCurrency(sale.totalAmount, currency)}</span>
            </div>
            {Number(sale.discount) > 0 ? (
              <div className="flex justify-between text-ink-500 dark:text-ink-400">
                <span>Discount</span>
                <span>−{formatCurrency(sale.discount, currency)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-ink-200 pt-2 text-sm font-bold text-ink-900 dark:border-ink-700 dark:text-white">
              <span>Total</span>
              <span>{formatCurrency(sale.finalAmount, currency)}</span>
            </div>
          </div>

          {sale.notes ? (
            <div className="rounded-xl border border-dashed border-ink-200 p-3 text-xs text-ink-600 dark:border-ink-700 dark:text-ink-300">
              <span className="font-semibold">Note: </span>
              {sale.notes}
            </div>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
