import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompact, formatDate } from '../../lib/utils';
import type { TrendPoint } from '../../types';
import { ChartTooltip } from './chart-tooltip';

export function RevenueAreaChart({
  data,
  currency,
  height = 280,
  showTransactions = false,
  timeZone = 'UTC',
}: {
  data: TrendPoint[];
  currency: string;
  height?: number;
  showTransactions?: boolean;
  timeZone?: string;
}) {
  // The API formats dates for English. Re-derive axis labels from the ISO date
  // so the chart follows the active language.
  const points = data.map((point) => ({
    ...point,
    label: point.date
      ? formatDate(`${point.date}T12:00:00Z`, timeZone, { month: 'short', day: 'numeric' })
      : point.label,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
            <stop offset="60%" stopColor="#6366f1" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 4" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={24}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={58}
          tickFormatter={(value: number) => formatCompact(value)}
        />
        <Tooltip
          content={<ChartTooltip currency={currency} />}
          cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#6366f1"
          strokeWidth={2.4}
          fill="url(#revenueFill)"
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
        />
        {showTransactions ? (
          <Area
            type="monotone"
            dataKey="transactions"
            name="Transactions"
            stroke="#22d3ee"
            strokeWidth={1.8}
            strokeDasharray="5 4"
            fill="transparent"
            dot={false}
          />
        ) : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}
