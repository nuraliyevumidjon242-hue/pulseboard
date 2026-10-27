export const queryKeys = {
  me: ['me'] as const,
  stores: ['stores'] as const,
  store: (storeId: string) => ['store', storeId] as const,
  storeSettings: (storeId: string) => ['store', storeId, 'settings'] as const,
  storeComparison: ['stores', 'compare'] as const,
  dashboard: (storeId: string, days: number) => ['dashboard', storeId, days] as const,
  sales: (storeId: string, filters: Record<string, unknown>) =>
    ['sales', storeId, filters] as const,
  sale: (storeId: string, saleId: string) => ['sale', storeId, saleId] as const,
  dailyStats: (storeId: string, days: number) => ['sales', storeId, 'daily', days] as const,
  hourlyStats: (storeId: string, date?: string) =>
    ['sales', storeId, 'hourly', date ?? 'today'] as const,
  paymentStats: (storeId: string) => ['sales', storeId, 'payments'] as const,
  products: (storeId: string, filters: Record<string, unknown>) =>
    ['products', storeId, filters] as const,
  product: (storeId: string, productId: string) => ['product', storeId, productId] as const,
  categories: (storeId: string) => ['products', storeId, 'categories'] as const,
  inventory: (storeId: string) => ['inventory', storeId] as const,
  lowStock: (storeId: string) => ['inventory', storeId, 'low-stock'] as const,
  adjustments: (storeId: string, filters: Record<string, unknown>) =>
    ['inventory', storeId, 'adjustments', filters] as const,
  revenue: (storeId: string, params: Record<string, unknown>) =>
    ['analytics', storeId, 'revenue', params] as const,
  productPerformance: (storeId: string, params: Record<string, unknown>) =>
    ['analytics', storeId, 'products', params] as const,
  customers: (storeId: string, days: number) => ['analytics', storeId, 'customers', days] as const,
  peakHours: (storeId: string, days: number) => ['analytics', storeId, 'peak-hours', days] as const,
  team: (storeId: string) => ['team', storeId] as const,
  invitations: (storeId: string) => ['invitations', storeId] as const,
  activity: (storeId: string, filters: Record<string, unknown>) =>
    ['activity', storeId, filters] as const,
  notifications: (unreadOnly = false) => ['notifications', { unreadOnly }] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};
