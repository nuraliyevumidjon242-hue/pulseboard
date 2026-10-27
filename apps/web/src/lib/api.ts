import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, AuthResponse } from '../types';
import { downloadBlob, filenameFromDisposition } from './utils';
import { tokenStore } from './token';
import { t } from './i18n';

const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 25_000,
  headers: { Accept: 'application/json' },
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20_000,
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Uses the httpOnly refresh cookie to mint a new access token. Safe to call on
 * boot — a rejected cookie simply means there is no session to restore.
 */
export async function refreshSession(): Promise<AuthResponse | null> {
  try {
    const response = await refreshClient.post<{ data: AuthResponse }>('/auth/refresh');
    tokenStore.set(response.data.data.accessToken);
    return response.data.data;
  } catch {
    tokenStore.clear();
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const config = error.config as RetryableConfig | undefined;
    const isAuthRoute = config?.url?.startsWith('/auth/') ?? false;

    if (error.response?.status !== 401 || !config || config._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    config._retry = true;
    refreshPromise ??= refreshSession()
      .then((session) => session?.accessToken ?? null)
      .finally(() => {
        refreshPromise = null;
      });

    const token = await refreshPromise;
    if (!token) {
      tokenStore.notifyUnauthorized();
      return Promise.reject(error);
    }

    config.headers.Authorization = `Bearer ${token}`;
    return api.request(config);
  },
);

const SERVER_MESSAGE_PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [
    /^Insufficient stock: product currently has (\d+) units$/,
    (match) => t('Insufficient stock: only {{count}} units left.', { count: Number(match[1]) }),
  ],
  [
    /^Stock changed while completing the sale for (.+)$/,
    (match) => t('Stock changed while completing the sale for {{name}}.', { name: match[1] }),
  ],
  [
    /^Your role \((.+)\) cannot perform this action$/,
    (match) => t('Your role ({{role}}) cannot perform this action.', { role: t(match[1]) }),
  ],
];

/**
 * The API answers with English messages. Translating them on the client keeps
 * error states consistent with the rest of the interface.
 */
function translateServerMessage(message: string): string {
  for (const [pattern, build] of SERVER_MESSAGE_PATTERNS) {
    const match = message.match(pattern);
    if (match) return build(match);
  }
  return t(message);
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return translateServerMessage(body.error.message);
    if (error.code === 'ECONNABORTED') return t('The request timed out. Please try again.');
    if (!error.response) return t('Cannot reach the PulseBoard API. Is it running?');
    return t('Request failed with status {{status}}.', { status: error.response.status });
  }
  if (error instanceof Error && error.message) return error.message;
  return t('Something went wrong. Please try again.');
}

export function getErrorFields(error: unknown): Record<string, string[]> {
  if (!axios.isAxiosError(error)) return {};
  const body = error.response?.data as ApiErrorBody | undefined;
  const details = body?.error?.details as { fields?: Record<string, string[]> } | undefined;
  return details?.fields ?? {};
}

export async function downloadExport(path: string, fallbackFilename: string): Promise<void> {
  const response = await api.get<Blob>(path, { responseType: 'blob' });
  const filename = filenameFromDisposition(
    response.headers['content-disposition'] as string | undefined,
    fallbackFilename,
  );
  downloadBlob(response.data, filename);
}

export async function exportReport(
  storeId: string,
  format: 'pdf' | 'csv',
  type: 'daily' | 'weekly' | 'monthly',
): Promise<void> {
  const path = `/stores/${storeId}/analytics/export?format=${format}&type=${type}`;
  await downloadExport(path, `pulseboard-${type}.${format}`);
}

export async function downloadInventoryCsv(storeId: string): Promise<void> {
  await downloadExport(`/stores/${storeId}/inventory/export`, 'products.csv');
}
