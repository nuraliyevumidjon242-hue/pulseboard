import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import type { PaginationMeta } from '../../types';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { t } from '../../lib/i18n';

export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('scrollbar-thin w-full overflow-x-auto rounded-2xl', className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full min-w-[42rem] border-collapse', className)} {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn('table-head', className)} {...props} />;
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('table-cell', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('table-row', className)} {...props} />;
}

export function Pagination({
  meta,
  onPageChange,
  onLimitChange,
  className,
}: {
  meta?: PaginationMeta | null;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  className?: string;
}) {
  if (!meta) return null;
  const start = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 dark:border-ink-800',
        className,
      )}
    >
      <p className="text-xs text-ink-500 dark:text-ink-400">
        {t('Showing {{from}}–{{to}} of {{total}}', {
          from: start,
          to: end,
          total: meta.total,
        })}
      </p>
      <div className="flex items-center gap-2">
        {onLimitChange ? (
          <select
            aria-label={t('Rows per page')}
            value={meta.limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
          >
            {[10, 20, 50, 100].map((value) => (
              <option key={value} value={value}>
                {t('{{count}} per page', { count: value })}
              </option>
            ))}
          </select>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          disabled={!meta.hasPrevious}
          onClick={() => onPageChange(meta.page - 1)}
          aria-label={t('Previous page')}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('Prev')}
        </Button>
        <span className="px-1 text-xs font-semibold text-ink-600 dark:text-ink-300">
          {meta.page} / {Math.max(1, meta.totalPages)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={!meta.hasNext}
          onClick={() => onPageChange(meta.page + 1)}
          aria-label={t('Next page')}
        >
          {t('Next')}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function DataCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('surface overflow-hidden', className)}>{children}</div>;
}
