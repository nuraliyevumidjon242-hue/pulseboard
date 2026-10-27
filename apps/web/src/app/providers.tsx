import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { htmlLang, t } from '../lib/i18n';
import { queryClient } from '../lib/query-client';
import { tokenStore } from '../lib/token';
import { useAuthStore } from '../stores/auth-store';
import { toast } from '../stores/toast-store';
import { useUiStore } from '../stores/ui-store';
import { useSocketBridge } from '../hooks/use-socket-bridge';
import { Toaster } from '../components/ui/toaster';

let bootstrapPromise: Promise<void> | null = null;

function ThemeSync() {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return null;
}

function LanguageSync() {
  const language = useUiStore((state) => state.language);

  useEffect(() => {
    document.documentElement.lang = htmlLang(language);
  }, [language]);

  return null;
}

function AuthBootstrap() {
  const expire = useAuthStore((state) => state.expire);

  useEffect(() => {
    tokenStore.onUnauthorized(() => {
      expire();
      toast.warning(t('Session expired'), t('Please sign in again to continue.'));
    });

    bootstrapPromise ??= useAuthStore
      .getState()
      .bootstrap()
      .finally(() => {
        bootstrapPromise = null;
      });

    return () => tokenStore.onUnauthorized(null);
  }, [expire]);

  return null;
}

function SocketBridge() {
  useSocketBridge();
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <LanguageSync />
      <AuthBootstrap />
      <SocketBridge />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
