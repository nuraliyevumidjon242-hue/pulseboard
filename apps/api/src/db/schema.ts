import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/* ────────────────────────────── Enums ────────────────────────────── */

export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'business_owner',
  'manager',
  'cashier',
  'viewer',
]);

export const storeRoleEnum = pgEnum('store_role', ['admin', 'manager', 'cashier', 'viewer']);

export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card', 'mobile', 'cheque']);

export const adjustmentReasonEnum = pgEnum('adjustment_reason', [
  'purchase',
  'sale',
  'loss',
  'damage',
  'correction',
  'return',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'low_stock',
  'high_sales',
  'system',
  'alert',
]);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'revoked',
]);

export const themeEnum = pgEnum('theme', ['light', 'dark', 'system']);

/* ────────────────────────────── Types ────────────────────────────── */

export interface StoreSettings {
  /** Daily revenue milestone that triggers a celebration notification. */
  milestoneAmount: number;
  /** Send an email to managers when a product falls below its minimum stock. */
  lowStockEmails: boolean;
  /** Retention window in days for raw sales records (0 = keep forever). */
  dataRetentionDays: number;
  /** Prefix used when generating human-readable transaction ids. */
  receiptPrefix: string;
}

export interface DashboardWidgetLayout {
  id: string;
  visible: boolean;
  order: number;
}

/* ────────────────────────────── Tables ───────────────────────────── */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    role: userRoleEnum('role').notNull().default('business_owner'),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    phone: varchar('phone', { length: 32 }),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_key').on(table.email),
    index('users_role_idx').on(table.role),
    index('users_created_at_idx').on(table.createdAt),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    userAgent: varchar('user_agent', { length: 500 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('refresh_tokens_hash_key').on(table.tokenHash),
    index('refresh_tokens_user_idx').on(table.userId),
    index('refresh_tokens_expires_idx').on(table.expiresAt),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('password_reset_tokens_hash_key').on(table.tokenHash),
    index('password_reset_tokens_user_idx').on(table.userId),
  ],
);

export const stores = pgTable(
  'stores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    address: varchar('address', { length: 500 }),
    city: varchar('city', { length: 100 }),
    country: varchar('country', { length: 100 }),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Europe/Berlin'),
    currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
    logoUrl: varchar('logo_url', { length: 500 }),
    phone: varchar('phone', { length: 32 }),
    email: varchar('email', { length: 255 }),
    description: text('description'),
    settings: jsonb('settings').$type<StoreSettings>().notNull().default({
      milestoneAmount: 1000,
      lowStockEmails: true,
      dataRetentionDays: 0,
      receiptPrefix: 'TXN',
    }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('stores_owner_idx').on(table.ownerId), index('stores_city_idx').on(table.city)],
);

export const storeUsers = pgTable(
  'store_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: storeRoleEnum('role').notNull().default('viewer'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('store_users_store_user_key').on(table.storeId, table.userId),
    index('store_users_store_idx').on(table.storeId),
    index('store_users_user_idx').on(table.userId),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: storeRoleEnum('role').notNull().default('viewer'),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    invitedById: uuid('invited_by_id').references(() => users.id, { onDelete: 'set null' }),
    status: invitationStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('invitations_token_key').on(table.tokenHash),
    index('invitations_store_idx').on(table.storeId),
    index('invitations_email_idx').on(table.email),
  ],
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    sku: varchar('sku', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }),
    description: text('description'),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    cost: numeric('cost', { precision: 12, scale: 2 }),
    currentStock: integer('current_stock').notNull().default(0),
    minStock: integer('min_stock').notNull().default(10),
    maxStock: integer('max_stock').notNull().default(1000),
    unit: varchar('unit', { length: 20 }).notNull().default('pcs'),
    barcode: varchar('barcode', { length: 100 }),
    imageUrl: varchar('image_url', { length: 500 }),
    expiryDate: date('expiry_date'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('products_store_sku_key').on(table.storeId, table.sku),
    index('products_store_idx').on(table.storeId),
    index('products_category_idx').on(table.category),
    index('products_barcode_idx').on(table.barcode),
    index('products_name_idx').on(table.name),
  ],
);

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    cashierId: uuid('cashier_id').references(() => users.id, { onDelete: 'set null' }),
    transactionId: varchar('transaction_id', { length: 100 }).notNull(),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),
    finalAmount: numeric('final_amount', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    customerName: varchar('customer_name', { length: 255 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sales_transaction_id_key').on(table.transactionId),
    index('sales_store_idx').on(table.storeId),
    index('sales_created_at_idx').on(table.createdAt),
    index('sales_payment_method_idx').on(table.paymentMethod),
    index('sales_store_created_idx').on(table.storeId, table.createdAt),
  ],
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    productName: varchar('product_name', { length: 255 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric('unit_cost', { precision: 12, scale: 2 }),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    index('sale_items_sale_idx').on(table.saleId),
    index('sale_items_product_idx').on(table.productId),
  ],
);

export const inventoryAdjustments = pgTable(
  'inventory_adjustments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    adjustedBy: uuid('adjusted_by').references(() => users.id, { onDelete: 'set null' }),
    oldQuantity: integer('old_quantity').notNull(),
    newQuantity: integer('new_quantity').notNull(),
    quantityChanged: integer('quantity_changed').notNull(),
    reason: adjustmentReasonEnum('reason').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('inventory_adjustments_product_idx').on(table.productId),
    index('inventory_adjustments_store_idx').on(table.storeId),
    index('inventory_adjustments_created_at_idx').on(table.createdAt),
  ],
);

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: varchar('entity_id', { length: 100 }),
    details: jsonb('details').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('activity_logs_store_idx').on(table.storeId),
    index('activity_logs_user_idx').on(table.userId),
    index('activity_logs_action_idx').on(table.action),
    index('activity_logs_created_at_idx').on(table.createdAt),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message'),
    isRead: boolean('is_read').notNull().default(false),
    actionUrl: varchar('action_url', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_user_idx').on(table.userId),
    index('notifications_is_read_idx').on(table.isRead),
    index('notifications_created_at_idx').on(table.createdAt),
  ],
);

export const dashboardPreferences = pgTable(
  'dashboard_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    theme: themeEnum('theme').notNull().default('system'),
    language: varchar('language', { length: 5 }).notNull().default('en'),
    widgetsOrder: jsonb('widgets_order').$type<DashboardWidgetLayout[]>(),
    visibleMetrics: jsonb('visible_metrics').$type<string[]>(),
    autoRefreshInterval: integer('auto_refresh_interval').notNull().default(30),
    notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('dashboard_preferences_user_key').on(table.userId)],
);

/* ────────────────────────────── Inferred row types ────────────────── */

export type UserRow = typeof users.$inferSelect;
export type StoreRow = typeof stores.$inferSelect;
export type StoreUserRow = typeof storeUsers.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type SaleRow = typeof sales.$inferSelect;
export type SaleItemRow = typeof saleItems.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type ActivityLogRow = typeof activityLogs.$inferSelect;
export type PreferencesRow = typeof dashboardPreferences.$inferSelect;
export type InvitationRow = typeof invitations.$inferSelect;
