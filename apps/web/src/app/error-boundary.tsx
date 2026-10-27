import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence for unexpected render failures. Chunk-load errors are
 * usually fixed by a reload, so the fallback makes that the primary action.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the console breadcrumb for local debugging; production logging can
    // be wired in here without changing the fallback UI.
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 text-center dark:bg-ink-950">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-ink-900 dark:text-white">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500 dark:text-ink-400">
          PulseBoard hit an unexpected error while rendering this view. Reloading usually fixes it;
          if it keeps happening, contact support with the details below.
        </p>
        <pre className="mt-4 max-h-32 w-full max-w-lg overflow-auto rounded-xl border border-ink-200 bg-white p-3 text-left text-[11px] text-ink-500 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
          {this.state.error.message}
        </pre>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-500"
          >
            <RefreshCw className="h-4 w-4" /> Reload app
          </button>
          <a
            href="/"
            className="inline-flex h-10 items-center rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            Go home
          </a>
        </div>
      </div>
    );
  }
}
