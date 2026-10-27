import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import type {
  ActivityEntry,
  CustomerAnalytics,
  DashboardData,
  Invitation,
  InventoryAdjustment,
  InventorySummary,
  NotificationItem,
  Paginated,
  PeakHours,
  Product,
  ProductPerformance,
  RevenueResponse,
  Sale,
  StoreComparison,
  StoreDetails,
  StoreSettings,
  StoreWithMetrics,
  TeamMember,
} from '../types';

export type QueryParams = Record<string, string | number | boolean | undefined>;

export async function fetchData<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.get<{ data: T }>(url, config);
  return response.data.data;
}

export async function fetchPaginated<T>(url: string, params?: QueryParams): Promise<Paginated<T>> {
  const response = await api.get<Paginated<T>>(url, { params });
  return response.data;
}

function useStoreQuery<T>(
  key: readonly unknown[],
  storeId: string | null,
  path: string,
  params?: QueryParams,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => fetchData<T>(path, { params }),
    enabled: Boolean(storeId),
    ...options,
  });
}

export function useDashboard(storeId: string | null, days = 30, refetchInterval?: number) {
  return useStoreQuery<DashboardData>(
    queryKeys.dashboard(storeId ?? 'none', days),
    storeId,
    `/stores/${storeId}/analytics/dashboard`,
    { days },
    refetchInterval ? { refetchInterval } : undefined,
  );
}

export function useSales(storeId: string | null, params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.sales(storeId ?? 'none', params),
    queryFn: () => fetchPaginated<Sale>(`/stores/${storeId}/sales`, params),
    enabled: Boolean(storeId),
  });
}

export function useSale(storeId: string | null, saleId: string | null) {
  return useQuery({
    queryKey: queryKeys.sale(storeId ?? 'none', saleId ?? 'none'),
    queryFn: () => fetchData<{ sale: Sale }>(`/stores/${storeId}/sales/${saleId}`),
    enabled: Boolean(storeId && saleId),
  });
}

export function useProducts(storeId: string | null, params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.products(storeId ?? 'none', params),
    queryFn: () => fetchPaginated<Product>(`/stores/${storeId}/products`, params),
    enabled: Boolean(storeId),
  });
}

export function useCategories(storeId: string | null) {
  return useStoreQuery<string[]>(
    queryKeys.categories(storeId ?? 'none'),
    storeId,
    `/stores/${storeId}/products/categories`,
  );
}

export function useInventorySummary(storeId: string | null) {
  return useStoreQuery<InventorySummary>(
    queryKeys.inventory(storeId ?? 'none'),
    storeId,
    `/stores/${storeId}/inventory/summary`,
  );
}

export function useLowStock(storeId: string | null) {
  return useQuery({
    queryKey: queryKeys.lowStock(storeId ?? 'none'),
    queryFn: () => fetchData<Product[]>(`/stores/${storeId}/inventory/low-stock`),
    enabled: Boolean(storeId),
  });
}

export function useAdjustments(storeId: string | null, params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.adjustments(storeId ?? 'none', params),
    queryFn: () =>
      fetchPaginated<InventoryAdjustment>(`/stores/${storeId}/inventory/adjustments`, params),
    enabled: Boolean(storeId),
  });
}

export function useRevenue(storeId: string | null, params: QueryParams) {
  return useStoreQuery<RevenueResponse>(
    queryKeys.revenue(storeId ?? 'none', params),
    storeId,
    `/stores/${storeId}/analytics/revenue`,
    params,
  );
}

export function useProductPerformance(storeId: string | null, params: QueryParams) {
  return useStoreQuery<ProductPerformance>(
    queryKeys.productPerformance(storeId ?? 'none', params),
    storeId,
    `/stores/${storeId}/analytics/products`,
    params,
  );
}

export function useCustomers(storeId: string | null, days: number) {
  return useStoreQuery<CustomerAnalytics>(
    queryKeys.customers(storeId ?? 'none', days),
    storeId,
    `/stores/${storeId}/analytics/customers`,
    { days },
  );
}

export function usePeakHours(storeId: string | null, days: number) {
  return useStoreQuery<PeakHours>(
    queryKeys.peakHours(storeId ?? 'none', days),
    storeId,
    `/stores/${storeId}/analytics/peak-hours`,
    { days },
  );
}

export function useTeam(storeId: string | null) {
  return useQuery({
    queryKey: queryKeys.team(storeId ?? 'none'),
    queryFn: () => fetchPaginated<TeamMember>(`/stores/${storeId}/team`),
    enabled: Boolean(storeId),
  });
}

export function useInvitations(storeId: string | null) {
  return useQuery({
    queryKey: queryKeys.invitations(storeId ?? 'none'),
    queryFn: () => fetchPaginated<Invitation>(`/stores/${storeId}/team/invitations`),
    enabled: Boolean(storeId),
  });
}

export function useActivity(storeId: string | null, params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.activity(storeId ?? 'none', params),
    queryFn: () => fetchPaginated<ActivityEntry>(`/stores/${storeId}/activity-log`, params),
    enabled: Boolean(storeId),
  });
}

export function useStores(includeInactive = true) {
  return useQuery({
    queryKey: [...queryKeys.stores, { includeInactive }] as const,
    queryFn: () => fetchPaginated<StoreWithMetrics>('/stores', { limit: 50, includeInactive }),
  });
}

export function useStoreComparison() {
  return useQuery({
    queryKey: queryKeys.storeComparison,
    queryFn: () => fetchData<StoreComparison[]>('/stores/compare'),
  });
}

export function useStoreDetails(storeId: string | null) {
  return useStoreQuery<StoreDetails>(
    queryKeys.store(storeId ?? 'none'),
    storeId,
    `/stores/${storeId}`,
  );
}

export interface StoreSettingsPayload extends StoreSettings {
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  currency: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  logoUrl: string | null;
}

export function useStoreSettings(storeId: string | null, enabled = true) {
  return useStoreQuery<{ settings: StoreSettingsPayload }>(
    queryKeys.storeSettings(storeId ?? 'none'),
    storeId,
    `/stores/${storeId}/settings`,
    undefined,
    { enabled: enabled && Boolean(storeId) },
  );
}

export interface NotificationPage extends Paginated<NotificationItem> {
  meta: Paginated<NotificationItem>['meta'] & { unread: number };
}

export function useNotifications(limit = 10) {
  return useQuery({
    queryKey: [...queryKeys.notifications(), { limit }] as const,
    queryFn: () => fetchPaginated<NotificationItem>('/notifications', { limit }),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: () => fetchData<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });
}
