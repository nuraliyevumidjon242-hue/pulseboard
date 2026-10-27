import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, AuthResponse } from '../types';
import { downloadBlob, filenameFromDisposition } from './utils';
import { tokenStore } from './token';

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

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    if (!error.response) return 'Cannot reach the PulseBoard API. Is it running?';
    return `Request failed with status ${error.response.status}.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
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
