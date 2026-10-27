export type GlobalRole = 'super_admin' | 'business_owner' | 'manager' | 'cashier' | 'viewer';
export type StoreRole = 'viewer' | 'cashier' | 'manager' | 'admin';
export type Theme = 'light' | 'dark' | 'system';
export type Language = 'en' | 'de' | 'uz';
export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'cheque';
export type Money = string;

export type Permission =
  | 'store:read'
  | 'store:update'
  | 'store:delete'
  | 'sales:read'
  | 'sales:write'
  | 'products:read'
  | 'products:write'
  | 'inventory:write'
  | 'analytics:read'
  | 'analytics:export'
  | 'team:read'
  | 'team:manage'
  | 'activity:read'
  | 'settings:write';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: GlobalRole;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: string;
}

export interface StoreSummary {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  currency: string;
  timezone: string;
  logoUrl: string | null;
  isActive: boolean;
  role: StoreRole;
  isOwner: boolean;
}

export interface StoreSettings {
  milestoneAmount: number;
  lowStockEmails: boolean;
  dataRetentionDays: number;
  receiptPrefix: string;
}

export interface Store extends StoreSummary {
  ownerId?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  settings?: StoreSettings;
  createdAt?: string;
  updatedAt?: string;
}

export interface WidgetLayout {
  id: string;
  visible: boolean;
  order: number;
}

export interface Preferences {
  id: string;
  userId: string;
  theme: Theme;
  language: Language;
  widgetsOrder: WidgetLayout[] | null;
  visibleMetrics: string[] | null;
  autoRefreshInterval: number;
  notificationsEnabled: boolean;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  expiresIn: number;
  storeId?: string;
}

export interface MeResponse {
  user: User;
  stores: StoreSummary[];
  preferences: Preferences;
}

export interface Summary {
  revenue: Money;
  transactions: number;
  itemsSold: number;
  avgTransaction: Money;
}

export interface SummaryComparison extends Summary {
  revenueChange: number | null;
  transactionsChange: number | null;
  avgTransactionChange: number | null;
}

export interface TrendPoint {
  date: string;
  label: string;
  revenue: Money;
  transactions: number;
  itemsSold: number;
}

export interface PaymentBreakdownRow {
  method: PaymentMethod;
  amount: Money;
  count: number;
  percentage: number;
}

export interface TopProduct {
  productId: string | null;
  name: string;
  quantity: number;
  revenue: Money;
  profit: Money;
  margin: number;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: Money;
  unitCost: Money | null;
  subtotal: Money;
}

export interface Sale {
  id: string;
  storeId: string;
  cashierId: string | null;
  transactionId: string;
  totalAmount: Money;
  discount: Money;
  finalAmount: Money;
  paymentMethod: PaymentMethod;
  customerName: string | null;
  notes: string | null;
  createdAt: string;
  cashierName: string | null;
  items: SaleItem[];
}

export interface DashboardData {
  generatedAt: string;
  store: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    city: string | null;
    logoUrl: string | null;
  };
  today: SummaryComparison;
  yesterday: Summary;
  last7Days: SummaryComparison;
  last30Days: SummaryComparison;
  trend: TrendPoint[];
  hourly: Array<{ hour: number; revenue: Money; transactions: number }>;
  paymentBreakdown: PaymentBreakdownRow[];
  topProducts: TopProduct[];
  lowStock: {
    count: number;
    items: Array<{
      id: string;
      name: string;
      currentStock: number;
      minStock: number;
      unit: string;
    }>;
  };
  recentSales: Sale[];
  inventory: {
    totalProducts: number;
    inventoryValue: Money;
    lowStockCount: number;
  };
}

export interface Product {
  id: string;
  storeId: string;
  sku: string;
  name: string;
  category: string | null;
  description: string | null;
  price: Money;
  cost: Money | null;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  barcode: string | null;
  imageUrl: string | null;
  expiryDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySummary {
  totalProducts: number;
  activeProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventoryValue: Money;
  potentialRevenue: Money;
}

export interface InventoryAdjustment {
  id: string;
  productId: string;
  storeId: string;
  adjustedBy: string | null;
  oldQuantity: number;
  newQuantity: number;
  quantityChanged: number;
  reason: 'purchase' | 'sale' | 'loss' | 'damage' | 'correction' | 'return';
  notes: string | null;
  createdAt: string;
  productName: string | null;
}

export interface RevenueResponse {
  period: 'daily' | 'weekly' | 'monthly';
  range: { from: string; to: string };
  totals: SummaryComparison;
  previous: Summary;
  trend: 'up' | 'down' | 'flat';
  percentageChange: number | null;
  data: TrendPoint[];
}

export interface ProductPerformance {
  top: TopProduct[];
  bottom: TopProduct[];
  categories: Array<{ category: string; revenue: Money; quantity: number; share: number }>;
  period: { from: string; to: string; days: number };
}

export interface CustomerAnalytics {
  period: { from: string; to: string; days: number };
  totalCustomers: number;
  returningCustomers: number;
  loyalCustomers: number;
  repeatRate: number;
  namedRevenue: Money;
  walkIn: { transactions: number; revenue: Money; share: number };
  segments: Array<{ label: string; customers: number; percentage: number }>;
  topCustomers: Array<{
    name: string;
    orders: number;
    spend: Money;
    avgOrder: Money;
    lastVisit: string;
  }>;
}

export interface PeakHours {
  period: { from: string; to: string; days: number };
  hours: Array<{ hour: number; revenue: Money; transactions: number; share: number }>;
  weekdays: Array<{ weekday: number; label: string; revenue: Money; transactions: number }>;
  busiestHour: number | null;
  busiestWeekday: string | null;
}

export interface TeamMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StoreRole;
  avatarUrl: string | null;
  isOwner: boolean;
  assignedAt: string;
  lastLoginAt: string | null;
}

export interface Invitation {
  id: string;
  storeId: string;
  email: string;
  role: StoreRole;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  storeId: string | null;
  type: 'low_stock' | 'high_sales' | 'system' | 'alert';
  title: string;
  message: string | null;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

export interface StoreMetrics {
  todayRevenue: Money;
  todayTransactions: number;
  monthRevenue: Money;
  lowStockCount: number;
}

export interface StoreWithMetrics extends StoreSummary {
  metrics: StoreMetrics;
  memberCount: number;
}

export interface StoreDetails {
  store: Store;
  metrics: StoreMetrics;
  memberCount: number;
  permissions: Permission[];
  role: StoreRole;
  isOwner: boolean;
}

export interface StoreComparison {
  storeId: string;
  name: string;
  city: string | null;
  currency: string;
  revenueToday: Money;
  revenue30d: Money;
  transactions30d: number;
  avgTransaction30d: Money;
  lowStockCount: number;
}

export interface CreateSaleResponse {
  sale: Sale;
  totals: { totalAmount: Money; discount: Money; finalAmount: Money };
  receipt: {
    storeName: string;
    address: string | null;
    currency: string;
    transactionId: string;
    cashierName: string | null;
    createdAt: string;
  };
}

export type RealtimeEvent =
  | {
      type: 'sale:created';
      payload: {
        saleId: string;
        transactionId: string;
        finalAmount: Money;
        totalAmount: Money;
        discount: Money;
        paymentMethod: PaymentMethod;
        itemsCount: number;
        cashierName: string | null;
        createdAt: string;
      };
    }
  | {
      type: 'inventory:updated';
      payload: {
        productId: string;
        currentStock: number;
        previousStock: number;
        reason: string;
      };
    }
  | { type: 'notification:new'; payload: NotificationItem }
  | { type: 'milestone:reached'; payload: { milestone: number; revenue: number } };
