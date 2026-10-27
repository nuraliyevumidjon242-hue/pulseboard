import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency, paymentLabel } from '../../lib/utils';
import type { PaymentBreakdownRow } from '../../types';
import { ChartTooltip } from './chart-tooltip';
import { t } from '../../lib/i18n';

const COLORS = ['#6366f1', '#22d3ee', '#10b981', '#f59e0b', '#f43f5e'];

export function PaymentDonut({
  data,
  currency,
  height = 220,
}: {
  data: PaymentBreakdownRow[];
  currency: string;
  height?: number;
}) {
  const total = data.reduce((sum, row) => sum + Number(row.amount), 0);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-xs text-ink-400">
        {t('No payments in this period.')}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative w-full max-w-[220px] flex-1" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="method"
              innerRadius="63%"
              outerRadius="88%"
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((row, index) => (
                <Cell key={row.method} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {t('Total')}
          </span>
          <span className="text-base font-bold text-ink-900 dark:text-white">
            {formatCurrency(total, currency, { compact: true })}
          </span>
        </div>
      </div>

      <div className="w-full flex-1 space-y-2">
        {data.map((row, index) => (
          <div key={row.method} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-ink-600 dark:text-ink-300">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="truncate">{paymentLabel(row.method)}</span>
            </span>
            <span className="shrink-0 font-semibold text-ink-900 dark:text-white">
              {formatCurrency(row.amount, currency)}
              <span className="ml-1.5 text-[10px] font-medium text-ink-400">
                {row.percentage.toFixed(0)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
