import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, formatPercent } from '../../lib/utils';
import { Button } from './button';
import { t } from '../../lib/i18n';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-brand-600', className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonTable({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((__, column) => (
            <Skeleton key={column} className={cn('h-4', column === 0 && 'w-3/4')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LoadingBlock({
  label = t('Loading data'),
  className,
  rows = 4,
}: {
  label?: string;
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn('space-y-4 p-5', className)} role="status" aria-label={label}>
      <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
        <Spinner />
        <span>{label}…</span>
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className={cn('h-4', index % 3 === 2 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({
  title = t('Could not load this view'),
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
      role="alert"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-900 dark:text-white">{title}</p>
        {message ? (
          <p className="mt-1 max-w-md text-sm text-ink-500 dark:text-ink-400">{message}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          {t('Try again')}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-900 dark:text-white">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
  className,
  label,
}: {
  value: number;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  className?: string;
  label?: string;
}) {
  const tones = {
    brand: 'bg-brand-600',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
  };
  return (
    <div
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800',
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', tones[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function DeltaPill({
  value,
  className,
  inverse = false,
}: {
  value: number | null | undefined;
  className?: string;
  inverse?: boolean;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={cn('text-xs text-ink-400', className)}>—</span>;
  }
  const positive = value >= 0;
  const good = inverse ? !positive : positive;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold',
        good
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
        className,
      )}
    >
      {positive ? '▲' : '▼'} {formatPercent(Math.abs(value), 1, false)}
    </span>
  );
}
