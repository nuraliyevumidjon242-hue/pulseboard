import { Activity, ArrowLeft, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const highlights = [
  'Real-time sales, streamed the moment a transaction lands',
  'Inventory alerts before you run out of your best sellers',
  'Multi-store performance in one calm, shared workspace',
];

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-white dark:bg-ink-950 lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:22px_22px]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-brand shadow-glow">
            <Activity className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">PulseBoard</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-400">
              Business intelligence
            </p>
          </div>
        </div>

        <div className="relative my-auto max-w-md py-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
            <Zap className="h-3 w-3" /> Built for independent retailers
          </span>
          <h1 className="mt-5 text-[2.6rem] font-bold leading-[1.08] tracking-tight">
            Every sale.
            <br />
            Every shelf.
            <br />
            <span className="bg-gradient-to-r from-brand-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
              One live pulse.
            </span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-300">
            PulseBoard turns your point-of-sale into a live control room — revenue, stock and
            customer behaviour, without spreadsheets.
          </p>

          <ul className="mt-7 space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-ink-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-9 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
            <div className="flex items-center justify-between text-[11px] font-medium text-ink-400">
              <span>Revenue today</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> live
              </span>
            </div>
            <div className="mt-1 flex items-end justify-between">
              <p className="text-2xl font-bold tracking-tight text-white">€4,286.50</p>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                ▲ 18.4%
              </span>
            </div>
            <div className="mt-4 flex h-20 items-end gap-1.5">
              {[38, 52, 44, 66, 58, 74, 63, 82, 71, 90, 78, 96].map((height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t bg-gradient-to-t from-brand-600/40 to-cyan-400/80"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure by design · JWT + rotating refresh
          </span>
          <span>© {new Date().getFullYear()} PulseBoard</span>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/login" className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
              <Activity className="h-4 w-4 text-white" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-bold text-ink-900 dark:text-white">PulseBoard</span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 transition hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="animate-slide-up">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
                {subtitle}
              </p>
            ) : null}
            <div className="mt-7">{children}</div>
          </div>
          {footer ? (
            <div className="mt-8 text-center text-xs text-ink-500 dark:text-ink-400">{footer}</div>
          ) : null}
        </div>

        <div className="text-center text-[10px] text-ink-400 lg:hidden">
          © {new Date().getFullYear()} PulseBoard · Real-time business analytics
        </div>
      </main>
    </div>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
    >
      {children}
    </div>
  );
}
