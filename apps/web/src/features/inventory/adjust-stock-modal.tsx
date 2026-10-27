import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Boxes } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../../lib/api';
import { useStoreContext } from '../../hooks/use-store-context';
import { cn } from '../../lib/utils';
import { toast } from '../../stores/toast-store';
import type { Product } from '../../types';
import { Button } from '../../components/ui/button';
import { Field, Input, Select, Textarea } from '../../components/ui/form';
import { FormAlert } from '../../components/auth/auth-layout';
import { Modal } from '../../components/ui/modal';
import { t } from '../../lib/i18n';

const REASONS = [
  { value: 'purchase', label: 'New delivery / purchase' },
  { value: 'return', label: 'Customer return' },
  { value: 'loss', label: 'Loss / shrinkage' },
  { value: 'damage', label: 'Damage / breakage' },
  { value: 'correction', label: 'Stock count correction' },
];

export function AdjustStockModal({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
}) {
  const { storeId } = useStoreContext();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('purchase');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDirection('add');
    setQuantity('1');
    setReason('purchase');
    setNotes('');
    setError(null);
  }, [open, product]);

  const change = Math.abs(Number(quantity) || 0) * (direction === 'add' ? 1 : -1);
  const projected = (product?.currentStock ?? 0) + change;

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{
        data: { product: Product; newStock: number; adjustmentId: string };
      }>(`/stores/${storeId}/inventory/adjust`, {
        productId: product?.id,
        quantityChange: change,
        reason,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      return response.data.data;
    },
    onSuccess: (result) => {
      toast.success(
        t('Stock updated'),
        t('{{name}} now has {{count}} units on hand.', {
          name: result.product.name,
          count: result.newStock,
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (mutationError) => setError(getErrorMessage(mutationError)),
  });

  const submit = () => {
    setError(null);
    if (!product) return;
    if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
      setError(t('Enter a whole number greater than zero.'));
      return;
    }
    if (projected < 0) {
      setError(t('Only {{count}} units are available to remove.', { count: product.currentStock }));
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Adjust stock')}
      description={product ? `${product.name} · ${product.sku}` : t('Select a product')}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t('Cancel')}
          </Button>
          <Button onClick={submit} loading={mutation.isPending} disabled={!product}>
            {t('Apply adjustment')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-ink-50/60 p-4 dark:border-ink-700 dark:bg-ink-950/40">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
              {t('Current stock')}
            </p>
            <p className="text-2xl font-bold tracking-tight text-ink-900 dark:text-white">
              {product?.currentStock ?? 0}
              <span className="ml-1 text-xs font-medium text-ink-400">
                {t(product?.unit ?? '')}
              </span>
            </p>
          </div>
          <Boxes className="h-8 w-8 text-ink-300 dark:text-ink-600" />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
              {t('After adjustment')}
            </p>
            <p
              className={cn(
                'text-2xl font-bold tracking-tight',
                projected < 0
                  ? 'text-rose-600'
                  : projected === 0
                    ? 'text-amber-600'
                    : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {projected}
              <span className="ml-1 text-xs font-medium text-ink-400">
                {t(product?.unit ?? '')}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setDirection('add');
              if (reason === 'loss' || reason === 'damage') setReason('purchase');
            }}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition',
              direction === 'add'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-ink-200 text-ink-500 hover:border-ink-300 dark:border-ink-700 dark:text-ink-400',
            )}
          >
            <ArrowUpRight className="h-4 w-4" /> {t('Add stock')}
          </button>
          <button
            type="button"
            onClick={() => {
              setDirection('remove');
              if (reason === 'purchase' || reason === 'return') setReason('loss');
            }}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition',
              direction === 'remove'
                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
                : 'border-ink-200 text-ink-500 hover:border-ink-300 dark:border-ink-700 dark:text-ink-400',
            )}
          >
            <ArrowDownRight className="h-4 w-4" /> {t('Remove stock')}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Quantity')} htmlFor="adjust-quantity">
            <Input
              id="adjust-quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Field label={t('Reason')} htmlFor="adjust-reason">
            <Select
              id="adjust-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(item.label)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label={t('Notes')}
          htmlFor="adjust-notes"
          hint={t('Visible in the adjustment audit trail')}
        >
          <Textarea
            id="adjust-notes"
            rows={2}
            placeholder={t('e.g. Delivery from supplier, invoice #2044')}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
