import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompact } from '../../lib/utils';
import { ChartTooltip } from './chart-tooltip';

export function HourlyBarChart({
  data,
  currency,
  height = 220,
}: {
  data: Array<{ hour: number; revenue: string; transactions: number }>;
  currency: string;
  height?: number;
}) {
  const chartData = data.map((row) => ({
    ...row,
    label: `${String(row.hour).padStart(2, '0')}:00`,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={2} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={52}
          tickFormatter={(value: number) => formatCompact(value)}
        />
        <Tooltip
          content={<ChartTooltip currency={currency} />}
          cursor={{ fill: 'rgba(99,102,241,0.08)' }}
        />
        <Bar
          dataKey="revenue"
          name="Revenue"
          fill="url(#hourFill)"
          radius={[5, 5, 0, 0]}
          maxBarSize={26}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
