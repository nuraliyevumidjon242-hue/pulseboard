import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileSpreadsheet, Download, UploadCloud, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, downloadExport, getErrorMessage } from '../../lib/api';
import { useStoreContext } from '../../hooks/use-store-context';
import { cn } from '../../lib/utils';
import { toast } from '../../stores/toast-store';
import { Button } from '../../components/ui/button';
import { FormAlert } from '../../components/auth/auth-layout';
import { Modal } from '../../components/ui/modal';

interface ImportResult {
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export function ImportProductsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { storeId } = useStoreContext();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setResult(null);
    setError(null);
    setDragging(false);
  }, [open]);

  const mutation = useMutation({
    mutationFn: async (upload: File) => {
      const formData = new FormData();
      formData.append('file', upload);
      const response = await api.post<{ data: ImportResult }>(
        `/stores/${storeId}/inventory/import`,
        formData,
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(
        'Import finished',
        `${data.imported} added, ${data.updated} updated, ${data.failed} failed.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (mutationError) => setError(getErrorMessage(mutationError)),
  });

  const pick = (next: File | null) => {
    setError(null);
    setResult(null);
    if (!next) return;
    if (!next.name.toLowerCase().endsWith('.csv')) {
      setError('Please choose a .csv file.');
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setError('The file is larger than 5 MB.');
      return;
    }
    setFile(next);
  };

  const downloadTemplate = async () => {
    try {
      await downloadExport(`/stores/${storeId}/inventory/template`, 'product-import-template.csv');
    } catch (downloadError) {
      toast.error('Could not download template', getErrorMessage(downloadError));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import products"
      description="Bulk add or update products from a CSV file. Existing SKUs are updated."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={() => file && mutation.mutate(file)}
            loading={mutation.isPending}
            disabled={!file}
            leftIcon={<UploadCloud className="h-4 w-4" />}
          >
            Import {file ? 'file' : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files.item(0));
          }}
          className={cn(
            'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition',
            dragging
              ? 'border-brand-400 bg-brand-50/60 dark:border-brand-500/60 dark:bg-brand-500/10'
              : 'border-ink-200 bg-ink-50/50 dark:border-ink-700 dark:bg-ink-950/30',
          )}
        >
          <FileSpreadsheet className="h-8 w-8 text-ink-300 dark:text-ink-600" />
          <p className="mt-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
            {file ? file.name : 'Drop your CSV here'}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
            {file
              ? `${(file.size / 1024).toFixed(1)} KB · ready to import`
              : 'or choose a file below · max 5 MB · up to 5,000 rows'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              Choose file
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void downloadTemplate()}
              leftIcon={<Download className="h-3.5 w-3.5" />}
            >
              Download template
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-ink-200 p-3.5 dark:border-ink-700">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
            Expected columns
          </p>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-500 dark:text-ink-400">
            sku, name, category, price, cost, stock, min_stock, max_stock, unit, barcode,
            expiry_date
          </p>
        </div>

        {result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10">
                <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {result.imported}
                </p>
                <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  Added
                </p>
              </div>
              <div className="rounded-xl bg-brand-50 p-3 text-center dark:bg-brand-500/10">
                <UploadCloud className="mx-auto h-4 w-4 text-brand-600 dark:text-brand-300" />
                <p className="mt-1 text-lg font-bold text-brand-700 dark:text-brand-300">
                  {result.updated}
                </p>
                <p className="text-[10px] font-medium text-brand-600 dark:text-brand-400">
                  Updated
                </p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 text-center dark:bg-rose-500/10">
                <XCircle className="mx-auto h-4 w-4 text-rose-600 dark:text-rose-400" />
                <p className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">
                  {result.failed}
                </p>
                <p className="text-[10px] font-medium text-rose-600 dark:text-rose-400">Failed</p>
              </div>
            </div>
            {result.errors.length > 0 ? (
              <div className="scrollbar-thin max-h-32 space-y-1 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
                {result.errors.slice(0, 10).map((item) => (
                  <p
                    key={`${item.row}-${item.message}`}
                    className="text-[11px] text-rose-700 dark:text-rose-300"
                  >
                    <span className="font-bold">Row {item.row}:</span> {item.message}
                  </p>
                ))}
                {result.errors.length > 10 ? (
                  <p className="text-[10px] font-semibold text-rose-600">
                    +{result.errors.length - 10} more issues
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
