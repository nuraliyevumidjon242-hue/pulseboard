import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb, getRawQuery } from '../../db/client';
import { products, sales, type StoreRow } from '../../db/schema';
import { cached, cacheKeys } from '../../lib/cache';
import { badRequest } from '../../lib/errors';
import { formatMoney, percentageChange } from '../../lib/money';
import { renderReportPdf } from '../../lib/pdf';
import {
  addDays,
  dateKeysBetween,
  formatDateInTimeZone,
  startOfDayInTimeZone,
  startOfDayKeyInTimeZone,
  toDateKey,
} from '../../lib/time';
import {
  dailyStats,
  hourlyStats,
  paymentBreakdown,
  recentSales,
  summaryForRange,
  toSummaryComparison,
  type RangeSummary,
  type SummaryComparison,
  type SaleWithItems,
} from '../sales/service';
import { listLowStock } from '../products/service';
import { toCsv } from '../../lib/csv';

export interface TrendPoint {
  date: string;
  label: string;
  revenue: string;
  transactions: number;
  itemsSold: number;
}

export interface TopProduct {
  productId: string | null;
  name: string;
  quantity: number;
  revenue: string;
  profit: string;
  margin: number;
}

export interface DashboardResponse {
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
  yesterday: RangeSummary;
  last7Days: SummaryComparison;
  last30Days: SummaryComparison;
  trend: TrendPoint[];
  hourly: Array<{ hour: number; revenue: string; transactions: number }>;
  paymentBreakdown: Array<{ method: string; amount: string; count: number; percentage: number }>;
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
  recentSales: SaleWithItems[];
  inventory: {
    totalProducts: number;
    inventoryValue: string;
    lowStockCount: number;
  };
}

const round = (value: number): number => Number(value.toFixed(1));

export async function getDashboard(store: StoreRow, days: number): Promise<DashboardResponse> {
  return cached(cacheKeys.dashboard(store.id, days), 15, async () => {
    const now = new Date();
    const todayStart = startOfDayInTimeZone(store.timezone, now);
    const todayEnd = addDays(todayStart, 1);
    const yesterdayStart = addDays(todayStart, -1);
    const last7Start = addDays(todayStart, -6);
    const previous7Start = addDays(last7Start, -7);
    const last30Start = addDays(todayStart, -29);
    const previous30Start = addDays(last30Start, -30);

    const [
      today,
      yesterday,
      last7,
      previous7,
      last30,
      previous30,
      trendData,
      hourlyData,
      payments,
      topProducts,
      lowStockItems,
      recent,
      inventoryRow,
    ] = await Promise.all([
      summaryForRange(store.id, todayStart, todayEnd),
      summaryForRange(store.id, yesterdayStart, todayStart),
      summaryForRange(store.id, last7Start, todayEnd),
      summaryForRange(store.id, previous7Start, last7Start),
      summaryForRange(store.id, last30Start, todayEnd),
      summaryForRange(store.id, previous30Start, last30Start),
      dailyStats(store, days),
      hourlyStats(store, toDateKey(now, store.timezone)),
      paymentBreakdown(store.id, last30Start, todayEnd),
      getTopProducts(store, last30Start, todayEnd, 5, 'revenue', false),
      listLowStock(store.id),
      recentSales(store.id, 6),
      getInventoryTotals(store.id),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      store: {
        id: store.id,
        name: store.name,
        currency: store.currency,
        timezone: store.timezone,
        city: store.city,
        logoUrl: store.logoUrl,
      },
      today: toSummaryComparison(today, yesterday),
      yesterday,
      last7Days: toSummaryComparison(last7, previous7),
      last30Days: toSummaryComparison(last30, previous30),
      trend: trendData.data.map((point) => ({
        date: point.date,
        label: formatDateInTimeZone(new Date(`${point.date}T12:00:00Z`), store.timezone, {
          month: 'short',
          day: 'numeric',
        }),
        revenue: point.revenue,
        transactions: point.transactions,
        itemsSold: point.itemsSold,
      })),
      hourly: hourlyData.data,
      paymentBreakdown: payments,
      topProducts,
      lowStock: {
        count: lowStockItems.length,
        items: lowStockItems.slice(0, 5).map((product) => ({
          id: product.id,
          name: product.name,
          currentStock: product.currentStock,
          minStock: product.minStock,
          unit: product.unit,
        })),
      },
      recentSales: recent,
      inventory: inventoryRow,
    };
  });
}

async function getInventoryTotals(storeId: string): Promise<{
  totalProducts: number;
  inventoryValue: string;
  lowStockCount: number;
}> {
  const [row] = await getDb()
    .select({
      totalProducts: sql<number>`count(*) filter (where ${products.isActive})::int`,
      inventoryValue: sql<string>`coalesce(sum(${products.currentStock} * coalesce(${products.cost}, ${products.price} * 0.6)), 0)::text`,
      lowStockCount: sql<number>`count(*) filter (where ${products.currentStock} <= ${products.minStock} and ${products.isActive})::int`,
    })
    .from(products)
    .where(eq(products.storeId, storeId));

  return {
    totalProducts: row?.totalProducts ?? 0,
    inventoryValue: Number(row?.inventoryValue ?? 0).toFixed(2),
    lowStockCount: row?.lowStockCount ?? 0,
  };
}

/* ─────────────────────────── Revenue analytics ─────────────────────────── */

export interface RevenueResponse {
  period: 'daily' | 'weekly' | 'monthly';
  range: { from: string; to: string };
  totals: SummaryComparison;
  previous: RangeSummary;
  trend: 'up' | 'down' | 'flat';
  percentageChange: number | null;
  data: TrendPoint[];
}

function resolveRange(
  store: StoreRow,
  period: 'daily' | 'weekly' | 'monthly',
  fromKey?: string,
  toKey?: string,
  days?: number,
): { start: Date; end: Date; bucket: 'day' | 'week' | 'month' } {
  const now = new Date();
  const todayStart = startOfDayInTimeZone(store.timezone, now);

  let start: Date;
  let end = addDays(todayStart, 1);

  if (fromKey) {
    const parsed = startOfDayKeyInTimeZone(fromKey, store.timezone);
    if (!parsed) throw badRequest('Invalid "from" date');
    start = parsed;
  } else if (period === 'weekly') {
    start = addDays(todayStart, -7 * 12 + 1);
  } else if (period === 'monthly') {
    start = addDays(todayStart, -365);
  } else {
    start = addDays(todayStart, -((days ?? 30) - 1));
  }

  if (toKey) {
    const parsed = startOfDayKeyInTimeZone(toKey, store.timezone);
    if (!parsed) throw badRequest('Invalid "to" date');
    end = addDays(parsed, 1);
  }

  if (start >= end) throw badRequest('"from" must be before "to"');

  const bucket = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';
  return { start, end, bucket };
}

export async function getRevenue(
  store: StoreRow,
  options: {
    period: 'daily' | 'weekly' | 'monthly';
    from?: string;
    to?: string;
    days?: number;
  },
): Promise<RevenueResponse> {
  const { start, end, bucket } = resolveRange(
    store,
    options.period,
    options.from,
    options.to,
    options.days,
  );

  const { rows } = await getRawQuery()<{
    bucket: string;
    revenue: string;
    transactions: number;
    items_sold: number;
  }>(
    `
      SELECT
        to_char(date_trunc($1, s.created_at AT TIME ZONE $2), 'YYYY-MM-DD') AS bucket,
        coalesce(sum(s.final_amount), 0)::text AS revenue,
        count(*)::int AS transactions,
        coalesce(sum((
          SELECT sum(si.quantity) FROM sale_items si WHERE si.sale_id = s.id
        )), 0)::int AS items_sold
      FROM sales s
      WHERE s.store_id = $3 AND s.created_at >= $4 AND s.created_at < $5
      GROUP BY 1
      ORDER BY 1
    `,
    [bucket, store.timezone, store.id, start.toISOString(), end.toISOString()],
  );

  const byBucket = new Map(rows.map((row) => [row.bucket, row]));
  const buckets =
    bucket === 'day'
      ? dateKeysBetween(start, addDays(end, -1), store.timezone)
      : rows.map((row) => row.bucket);

  const data: TrendPoint[] = buckets.map((key) => {
    const row = byBucket.get(key);
    const revenue = row?.revenue ?? '0.00';
    const transactions = row?.transactions ?? 0;
    return {
      date: key,
      label:
        bucket === 'month'
          ? formatDateInTimeZone(new Date(`${key}T12:00:00Z`), store.timezone, {
              month: 'short',
              year: 'numeric',
            })
          : formatDateInTimeZone(new Date(`${key}T12:00:00Z`), store.timezone, {
              month: 'short',
              day: 'numeric',
            }),
      revenue,
      transactions,
      itemsSold: row?.items_sold ?? 0,
    };
  });

  const current = await summaryForRange(store.id, start, end);
  const lengthMs = end.getTime() - start.getTime();
  const previous = await summaryForRange(store.id, new Date(start.getTime() - lengthMs), start);
  const totals = toSummaryComparison(current, previous);
  const change = totals.revenueChange;

  return {
    period: options.period,
    range: {
      from: toDateKey(start, store.timezone),
      to: toDateKey(addDays(end, -1), store.timezone),
    },
    totals,
    previous,
    trend: change === null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    percentageChange: change,
    data,
  };
}

/* ─────────────────────────── Product performance ─────────────────────────── */

export async function getTopProducts(
  store: StoreRow,
  from: Date,
  to: Date,
  limit: number,
  sortBy: 'revenue' | 'quantity' | 'profit',
  includeBottom = false,
): Promise<TopProduct[]> {
  const order = sortBy === 'quantity' ? 'quantity' : sortBy === 'profit' ? 'profit' : 'revenue';
  const { rows } = await getRawQuery()<{
    product_id: string | null;
    name: string;
    quantity: number;
    revenue: string;
    profit: string;
  }>(
    `
      SELECT
        si.product_id,
        si.product_name AS name,
        sum(si.quantity)::int AS quantity,
        coalesce(sum(si.subtotal), 0)::text AS revenue,
        coalesce(sum((si.unit_price - coalesce(si.unit_cost, 0)) * si.quantity), 0)::text AS profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.store_id = $1 AND s.created_at >= $2 AND s.created_at < $3
      GROUP BY si.product_id, si.product_name
      ORDER BY ${order} ${includeBottom ? 'ASC' : 'DESC'}
      LIMIT $4
    `,
    [store.id, from.toISOString(), to.toISOString(), limit],
  );

  return rows.map((row) => {
    const margin =
      Number(row.revenue) > 0 ? round((Number(row.profit) / Number(row.revenue)) * 100) : 0;
    return {
      productId: row.product_id,
      name: row.name,
      quantity: row.quantity,
      revenue: row.revenue,
      profit: row.profit,
      margin,
    };
  });
}

export async function getProductPerformance(
  store: StoreRow,
  options: { days: number; limit: number; sortBy: 'revenue' | 'quantity' | 'profit' },
): Promise<{
  top: TopProduct[];
  bottom: TopProduct[];
  categories: Array<{ category: string; revenue: string; quantity: number; share: number }>;
  period: { from: string; to: string; days: number };
}> {
  const now = new Date();
  const todayStart = startOfDayInTimeZone(store.timezone, now);
  const start = addDays(todayStart, -(options.days - 1));
  const end = addDays(todayStart, 1);

  const top = await getTopProducts(store, start, end, options.limit, options.sortBy, false);

  const { rows: bottomRows } = await getRawQuery()<{
    product_id: string;
    name: string;
    quantity: number;
    revenue: string;
    profit: string;
  }>(
    `
      SELECT
        p.id AS product_id,
        p.name,
        coalesce(agg.quantity, 0)::int AS quantity,
        coalesce(agg.revenue, '0')::text AS revenue,
        coalesce(agg.profit, '0')::text AS profit
      FROM products p
      LEFT JOIN (
        SELECT
          si.product_id,
          sum(si.quantity)::int AS quantity,
          sum(si.subtotal)::text AS revenue,
          sum((si.unit_price - coalesce(si.unit_cost, 0)) * si.quantity)::text AS profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.store_id = $1 AND s.created_at >= $2 AND s.created_at < $3
        GROUP BY si.product_id
      ) agg ON agg.product_id = p.id
      WHERE p.store_id = $1 AND p.is_active = true
      ORDER BY ${options.sortBy === 'quantity' ? 'quantity' : options.sortBy === 'profit' ? 'profit' : 'revenue'} ASC
      LIMIT $4
    `,
    [store.id, start.toISOString(), end.toISOString(), options.limit],
  );

  const { rows: categoryRows } = await getRawQuery()<{
    category: string;
    revenue: string;
    quantity: number;
  }>(
    `
      SELECT
        coalesce(p.category, 'Uncategorised') AS category,
        coalesce(sum(si.subtotal), 0)::text AS revenue,
        coalesce(sum(si.quantity), 0)::int AS quantity
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.store_id = $1 AND s.created_at >= $2 AND s.created_at < $3
      GROUP BY 1
      ORDER BY sum(si.subtotal) DESC
      LIMIT 8
    `,
    [store.id, start.toISOString(), end.toISOString()],
  );

  const totalRevenue = categoryRows.reduce((sum, row) => sum + Number(row.revenue), 0);

  return {
    top,
    bottom: bottomRows.map((row) => ({
      productId: row.product_id,
      name: row.name,
      quantity: row.quantity,
      revenue: row.revenue,
      profit: row.profit,
      margin: Number(row.revenue) > 0 ? round((Number(row.profit) / Number(row.revenue)) * 100) : 0,
    })),
    categories: categoryRows.map((row) => ({
      category: row.category,
      revenue: row.revenue,
      quantity: row.quantity,
      share: totalRevenue > 0 ? round((Number(row.revenue) / totalRevenue) * 100) : 0,
    })),
    period: {
      from: toDateKey(start, store.timezone),
      to: toDateKey(addDays(end, -1), store.timezone),
      days: options.days,
    },
  };
}

/* ─────────────────────────── Customer analytics ─────────────────────────── */

export async function getCustomerAnalytics(
  store: StoreRow,
  days: number,
): Promise<{
  period: { from: string; to: string; days: number };
  totalCustomers: number;
  returningCustomers: number;
  loyalCustomers: number;
  repeatRate: number;
  namedRevenue: string;
  walkIn: { transactions: number; revenue: string; share: number };
  segments: Array<{ label: string; customers: number; percentage: number }>;
  topCustomers: Array<{
    name: string;
    orders: number;
    spend: string;
    avgOrder: string;
    lastVisit: Date;
  }>;
}> {
  const todayStart = startOfDayInTimeZone(store.timezone, new Date());
  const start = addDays(todayStart, -(days - 1));
  const end = addDays(todayStart, 1);
  const fromIso = start.toISOString();
  const toIso = end.toISOString();

  const { rows } = await getRawQuery()<{
    name: string;
    orders: number;
    spend: string;
    last_visit: string;
  }>(
    `
      SELECT
        customer_name AS name,
        count(*)::int AS orders,
        coalesce(sum(final_amount), 0)::text AS spend,
        max(created_at) AS last_visit
      FROM sales
      WHERE store_id = $1 AND created_at >= $2 AND created_at < $3 AND customer_name IS NOT NULL
      GROUP BY customer_name
      ORDER BY sum(final_amount) DESC
    `,
    [store.id, fromIso, toIso],
  );

  const walkIn = await getRawQuery()<{ transactions: number; revenue: string }>(
    `
      SELECT count(*)::int AS transactions, coalesce(sum(final_amount), 0)::text AS revenue
      FROM sales
      WHERE store_id = $1 AND created_at >= $2 AND created_at < $3 AND customer_name IS NULL
    `,
    [store.id, fromIso, toIso],
  );

  const named = rows.map((row) => ({
    name: row.name,
    orders: row.orders,
    spend: row.spend,
    lastVisit: new Date(row.last_visit),
  }));

  const totalCustomers = named.length;
  const returning = named.filter((row) => row.orders >= 2).length;
  const loyal = named.filter((row) => row.orders >= 5).length;
  const oneTime = named.filter((row) => row.orders === 1).length;
  const namedRevenue = named.reduce((sum, row) => sum + Number(row.spend), 0);
  const walkInRow = walkIn.rows[0] ?? { transactions: 0, revenue: '0' };
  const allTransactions = named.reduce((sum, row) => sum + row.orders, 0) + walkInRow.transactions;

  return {
    period: {
      from: toDateKey(start, store.timezone),
      to: toDateKey(addDays(end, -1), store.timezone),
      days,
    },
    totalCustomers,
    returningCustomers: returning,
    loyalCustomers: loyal,
    repeatRate: totalCustomers > 0 ? round((returning / totalCustomers) * 100) : 0,
    namedRevenue: namedRevenue.toFixed(2),
    walkIn: {
      transactions: walkInRow.transactions,
      revenue: walkInRow.revenue,
      share: allTransactions > 0 ? round((walkInRow.transactions / allTransactions) * 100) : 0,
    },
    segments: [
      {
        label: 'One-time',
        customers: oneTime,
        percentage: totalCustomers > 0 ? round((oneTime / totalCustomers) * 100) : 0,
      },
      {
        label: 'Returning',
        customers: named.filter((row) => row.orders >= 2 && row.orders < 5).length,
        percentage:
          totalCustomers > 0
            ? round(
                (named.filter((row) => row.orders >= 2 && row.orders < 5).length / totalCustomers) *
                  100,
              )
            : 0,
      },
      {
        label: 'Loyal (5+)',
        customers: loyal,
        percentage: totalCustomers > 0 ? round((loyal / totalCustomers) * 100) : 0,
      },
    ],
    topCustomers: named.slice(0, 10).map((row) => ({
      ...row,
      avgOrder: (Number(row.spend) / row.orders).toFixed(2),
    })),
  };
}

/* ─────────────────────────── Peak hours ─────────────────────────── */

export async function getPeakHours(
  store: StoreRow,
  days: number,
): Promise<{
  period: { from: string; to: string; days: number };
  hours: Array<{ hour: number; revenue: string; transactions: number; share: number }>;
  weekdays: Array<{ weekday: number; label: string; revenue: string; transactions: number }>;
  busiestHour: number | null;
  busiestWeekday: string | null;
}> {
  const todayStart = startOfDayInTimeZone(store.timezone, new Date());
  const start = addDays(todayStart, -(days - 1));
  const end = addDays(todayStart, 1);
  const fromIso = start.toISOString();
  const toIso = end.toISOString();

  const { rows: hourRows } = await getRawQuery()<{
    hour: number;
    revenue: string;
    transactions: number;
  }>(
    `
      SELECT
        extract(hour FROM created_at AT TIME ZONE $1)::int AS hour,
        coalesce(sum(final_amount), 0)::text AS revenue,
        count(*)::int AS transactions
      FROM sales
      WHERE store_id = $2 AND created_at >= $3 AND created_at < $4
      GROUP BY 1
      ORDER BY 1
    `,
    [store.timezone, store.id, fromIso, toIso],
  );

  const { rows: weekdayRows } = await getRawQuery()<{
    weekday: number;
    revenue: string;
    transactions: number;
  }>(
    `
      SELECT
        extract(isodow FROM created_at AT TIME ZONE $1)::int AS weekday,
        coalesce(sum(final_amount), 0)::text AS revenue,
        count(*)::int AS transactions
      FROM sales
      WHERE store_id = $2 AND created_at >= $3 AND created_at < $4
      GROUP BY 1
      ORDER BY 1
    `,
    [store.timezone, store.id, fromIso, toIso],
  );

  const byHour = new Map(hourRows.map((row) => [row.hour, row]));
  const totalRevenue = hourRows.reduce((sum, row) => sum + Number(row.revenue), 0);

  const hours = Array.from({ length: 24 }, (_, hour) => {
    const row = byHour.get(hour);
    return {
      hour,
      revenue: row?.revenue ?? '0.00',
      transactions: row?.transactions ?? 0,
      share: totalRevenue > 0 && row ? round((Number(row.revenue) / totalRevenue) * 100) : 0,
    };
  });

  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byWeekday = new Map(weekdayRows.map((row) => [row.weekday, row]));
  const weekdays = weekdayLabels.map((label, index) => {
    const row = byWeekday.get(index + 1);
    return {
      weekday: index + 1,
      label,
      revenue: row?.revenue ?? '0.00',
      transactions: row?.transactions ?? 0,
    };
  });

  const busiest = [...hours].sort((a, b) => Number(b.revenue) - Number(a.revenue))[0];
  const busiestDay = [...weekdays].sort((a, b) => Number(b.revenue) - Number(a.revenue))[0];

  return {
    period: {
      from: toDateKey(start, store.timezone),
      to: toDateKey(addDays(end, -1), store.timezone),
      days,
    },
    hours,
    weekdays,
    busiestHour: busiest && Number(busiest.revenue) > 0 ? busiest.hour : null,
    busiestWeekday: busiestDay && Number(busiestDay.revenue) > 0 ? busiestDay.label : null,
  };
}

/* ─────────────────────────── Exports ─────────────────────────── */

export interface ExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export async function buildExport(
  store: StoreRow,
  format: 'pdf' | 'csv',
  type: 'daily' | 'weekly' | 'monthly',
): Promise<ExportResult> {
  const now = new Date();
  const todayStart = startOfDayInTimeZone(store.timezone, now);
  const days = type === 'daily' ? 1 : type === 'weekly' ? 7 : 30;
  const start = addDays(todayStart, -(days - 1));
  const end = addDays(todayStart, 1);

  const [summary, previous, trend, payments, topProducts, lowStock, inventory] = await Promise.all([
    summaryForRange(store.id, start, end),
    summaryForRange(store.id, addDays(start, -days), start),
    dailyStats(store, days),
    paymentBreakdown(store.id, start, end),
    getTopProducts(store, start, end, 10, 'revenue'),
    listLowStock(store.id),
    getInventoryTotals(store.id),
  ]);

  const rangeLabel = `${formatDateInTimeZone(start, store.timezone, {
    dateStyle: 'medium',
  })} – ${formatDateInTimeZone(addDays(end, -1), store.timezone, { dateStyle: 'medium' })}`;
  const fileStamp = `${type}-${toDateKey(start, store.timezone)}`;

  if (format === 'pdf') {
    const buffer = await renderReportPdf({
      storeName: store.name,
      storeAddress: [store.address, store.city].filter(Boolean).join(', '),
      currency: store.currency,
      periodLabel: `${type[0]?.toUpperCase()}${type.slice(1)} report · ${rangeLabel}`,
      generatedAt: now,
      timeZone: store.timezone,
      metrics: [
        { label: 'Revenue', value: formatMoney(summary.revenue, store.currency) },
        {
          label: 'Transactions',
          value: summary.transactions.toLocaleString('en-US'),
          hint: `Avg ${formatMoney(summary.avgTransaction, store.currency)}`,
        },
        {
          label: 'Items sold',
          value: summary.itemsSold.toLocaleString('en-US'),
          hint: `${lowStock.length} low-stock products`,
        },
        {
          label: 'Revenue change',
          value:
            summary.transactions > 0 && Number(previous.revenue) > 0
              ? `${percentageChange(Number(summary.revenue), Number(previous.revenue)) ?? 0}%`
              : 'n/a',
          hint: 'vs previous period',
        },
        { label: 'Inventory value', value: formatMoney(inventory.inventoryValue, store.currency) },
        {
          label: 'Top product',
          value: topProducts[0]?.name ?? 'No sales yet',
          hint: topProducts[0]
            ? `${formatMoney(topProducts[0].revenue, store.currency)} revenue`
            : undefined,
        },
      ],
      series: trend.data.map((point) => ({ label: point.date, value: Number(point.revenue) })),
      paymentBreakdown: payments,
      topProducts: topProducts.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        revenue: product.revenue,
      })),
      footer: `${store.name} · ${rangeLabel} · Amounts in ${store.currency}.`,
    });

    return {
      buffer,
      contentType: 'application/pdf',
      filename: `pulseboard-${fileStamp}.pdf`,
    };
  }

  const { rows } = await getRawQuery()<{
    transaction_id: string;
    created_at: string;
    customer_name: string | null;
    payment_method: string;
    total_amount: string;
    discount: string;
    final_amount: string;
    cashier: string | null;
    item_count: number;
    items_sold: number;
  }>(
    `
      SELECT
        s.transaction_id,
        s.created_at,
        s.customer_name,
        s.payment_method,
        s.total_amount::text,
        s.discount::text,
        s.final_amount::text,
        nullif(concat_ws(' ', u.first_name, u.last_name), '') AS cashier,
        (SELECT count(*)::int FROM sale_items si WHERE si.sale_id = s.id) AS item_count,
        coalesce((SELECT sum(si.quantity)::int FROM sale_items si WHERE si.sale_id = s.id), 0) AS items_sold
      FROM sales s
      LEFT JOIN users u ON u.id = s.cashier_id
      WHERE s.store_id = $1 AND s.created_at >= $2 AND s.created_at < $3
      ORDER BY s.created_at ASC
    `,
    [store.id, start.toISOString(), end.toISOString()],
  );

  const csv = toCsv(
    rows.map((row) => ({
      transaction_id: row.transaction_id,
      date: formatDateInTimeZone(new Date(row.created_at), store.timezone, {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
      customer: row.customer_name ?? '',
      payment_method: row.payment_method,
      items_sold: row.items_sold,
      total: row.total_amount,
      discount: row.discount,
      final_amount: row.final_amount,
      currency: store.currency,
      cashier: row.cashier ?? '',
    })),
    [
      'transaction_id',
      'date',
      'customer',
      'payment_method',
      'items_sold',
      'total',
      'discount',
      'final_amount',
      'currency',
      'cashier',
    ],
  );

  return {
    buffer: Buffer.from(`\uFEFF${csv}`, 'utf8'),
    contentType: 'text/csv; charset=utf-8',
    filename: `pulseboard-${fileStamp}.csv`,
  };
}

/** Simple health metric used by the system page. */
export async function getSalesHealth(storeId: string): Promise<{
  totalSales: number;
  latestSaleAt: Date | null;
}> {
  const db = getDb();
  const [row] = await db
    .select({
      totalSales: sql<number>`count(*)::int`,
      latestSaleAt: sql<string | null>`max(${sales.createdAt})`,
    })
    .from(sales)
    .where(and(eq(sales.storeId, storeId), gte(sales.createdAt, addDays(new Date(), -30))));

  return {
    totalSales: row?.totalSales ?? 0,
    latestSaleAt: row?.latestSaleAt ? new Date(row.latestSaleAt) : null,
  };
}
