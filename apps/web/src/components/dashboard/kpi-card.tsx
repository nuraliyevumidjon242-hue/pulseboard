import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Sparkline } from '../charts/sparkline';
import { DeltaPill } from '../ui/feedback';

const accents = {
  brand: {
    icon: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
    line: '#6366f1',
    glow: 'from-brand-500/10',
  },
  cyan: {
    icon: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300',
    line: '#22d3ee',
    glow: 'from-cyan-500/10',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    line: '#10b981',
    glow: 'from-emerald-500/10',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    line: '#f59e0b',
    glow: 'from-amber-500/10',
  },
};

export function KpiCard({
  label,
  value,
  change,
  hint,
  icon,
  accent = 'brand',
  spark,
  loading = false,
  inverseDelta = false,
  footer,
}: {
  label: string;
  value: ReactNode;
  change?: number | null;
  hint?: ReactNode;
  icon: ReactNode;
  accent?: keyof typeof accents;
  spark?: number[];
  loading?: boolean;
  inverseDelta?: boolean;
  footer?: ReactNode;
}) {
  const tone = accents[accent];
  const sparkData = (spark ?? []).map((value) => ({ value }));

  return (
    <div className="surface group relative overflow-hidden p-5">
      <div
        className={cn(
          'pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br to-transparent blur-2xl',
          tone.glow,
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
          {label}
        </p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl', tone.icon)}>
          {icon}
        </span>
      </div>

      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="skeleton h-7 w-24" />
          <div className="skeleton h-3 w-16" />
        </div>
      ) : (
        <>
          <div className="mt-2.5 flex items-end justify-between gap-2">
            <p className="text-[26px] font-bold leading-none tracking-tight text-ink-900 dark:text-white">
              {value}
            </p>
            {change !== undefined ? <DeltaPill value={change} inverse={inverseDelta} /> : null}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-ink-500 dark:text-ink-400">{hint}</p>
            {sparkData.length > 1 ? (
              <div className="w-20 shrink-0 opacity-80 transition group-hover:opacity-100">
                <Sparkline data={sparkData} color={tone.line} height={28} />
              </div>
            ) : null}
          </div>
        </>
      )}
      {footer ? (
        <div className="mt-3 border-t border-ink-100 pt-2.5 dark:border-ink-800">{footer}</div>
      ) : null}
    </div>
  );
}
