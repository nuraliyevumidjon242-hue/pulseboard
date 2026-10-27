import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToastStore, type ToastVariant } from '../../stores/toast-store';
import { t } from '../../lib/i18n';

const icons: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles: Record<ToastVariant, string> = {
  success:
    'border-emerald-200 bg-white text-emerald-700 dark:border-emerald-500/25 dark:bg-ink-900 dark:text-emerald-300',
  error:
    'border-rose-200 bg-white text-rose-700 dark:border-rose-500/25 dark:bg-ink-900 dark:text-rose-300',
  warning:
    'border-amber-200 bg-white text-amber-700 dark:border-amber-500/25 dark:bg-ink-900 dark:text-amber-300',
  info: 'border-cyan-200 bg-white text-cyan-700 dark:border-cyan-500/25 dark:bg-ink-900 dark:text-cyan-300',
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:items-end sm:p-6"
    >
      {toasts.map((item) => {
        const Icon = icons[item.variant];
        return (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-3.5 shadow-pop animate-slide-up',
              styles[item.variant],
            )}
            role="status"
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 break-words text-xs text-ink-500 dark:text-ink-400">
                  {item.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label={t('Dismiss notification')}
              className="rounded-md p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
