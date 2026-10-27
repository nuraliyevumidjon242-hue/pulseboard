import { Area, AreaChart, ResponsiveContainer } from 'recharts';

export function Sparkline({
  data,
  color = '#6366f1',
  height = 40,
}: {
  data: Array<{ value: number }>;
  color?: string;
  height?: number;
}) {
  if (data.length === 0) return <div style={{ height }} />;
  const id = `spark-${color.replace('#', '')}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#${id})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
