import type { TooltipProps } from 'recharts';
import { formatCurrency, formatNumber } from '../../lib/utils';

export function ChartTooltip({
  active,
  payload,
  label,
  currency,
  valueType = 'currency',
  labelSuffix,
}: TooltipProps<number, string> & {
  currency?: string;
  valueType?: 'currency' | 'number';
  labelSuffix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const format = (value: number | string) =>
    valueType === 'currency' ? formatCurrency(value, currency ?? 'EUR') : formatNumber(value);

  return (
    <div className="rounded-xl border border-ink-200 bg-white/95 px-3 py-2.5 shadow-pop backdrop-blur dark:border-ink-700 dark:bg-ink-900/95">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
        {String(label ?? '')}
        {labelSuffix ? ` ${labelSuffix}` : ''}
      </p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div
            key={`${entry.dataKey ?? index}`}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-500 dark:text-ink-400">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color ?? '#6366f1' }}
              />
              {entry.name ?? 'Value'}
            </span>
            <span className="text-xs font-bold text-ink-900 dark:text-white">
              {format(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
