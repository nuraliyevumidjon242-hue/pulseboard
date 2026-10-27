import { eq, inArray } from 'drizzle-orm';
import { getDb } from './client';
import {
  activityLogs,
  dashboardPreferences,
  inventoryAdjustments,
  invitations,
  notifications,
  products,
  saleItems,
  sales,
  storeUsers,
  stores,
  users,
} from './schema';
import { hashPassword } from '../lib/password';
import { newId, randomToken, sha256 } from '../lib/crypto';
import { fromCents, toCents } from '../lib/money';
import { addDays, startOfDayInTimeZone, toDateKey, zonedTimeToUtc } from '../lib/time';
import { logger } from '../lib/logger';

/* Deterministic PRNG so repeated demo seeds look identical. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261026);
const randomInt = (min: number, max: number): number => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T;
const chance = (probability: number): boolean => rand() < probability;

interface ProductSeed {
  sku: string;
  name: string;
  category: string;
  price: string;
  cost: string;
  minStock: number;
  stock: number;
  unit?: string;
  barcode?: string;
  expiryInDays?: number;
  weight: number;
}

const northwindProducts: ProductSeed[] = [
  {
    sku: 'ESP-001',
    name: 'Espresso Beans 1kg',
    category: 'Coffee',
    price: '18.90',
    cost: '11.20',
    minStock: 8,
    stock: 34,
    barcode: '4000100000011',
    weight: 6,
  },
  {
    sku: 'LAT-002',
    name: 'Oat Milk 1L',
    category: 'Dairy',
    price: '3.40',
    cost: '2.10',
    minStock: 12,
    stock: 48,
    expiryInDays: 9,
    weight: 9,
  },
  {
    sku: 'CRO-003',
    name: 'Butter Croissant',
    category: 'Bakery',
    price: '2.80',
    cost: '1.10',
    minStock: 20,
    stock: 12,
    expiryInDays: 2,
    weight: 14,
  },
  {
    sku: 'CAK-004',
    name: 'Cheesecake Slice',
    category: 'Bakery',
    price: '4.50',
    cost: '1.90',
    minStock: 10,
    stock: 22,
    expiryInDays: 4,
    weight: 8,
  },
  {
    sku: 'SAN-005',
    name: 'Club Sandwich',
    category: 'Snacks',
    price: '6.90',
    cost: '3.20',
    minStock: 8,
    stock: 17,
    expiryInDays: 2,
    weight: 7,
  },
  {
    sku: 'COL-006',
    name: 'Cold Brew 0.3L',
    category: 'Cold Drinks',
    price: '4.20',
    cost: '1.40',
    minStock: 15,
    stock: 60,
    weight: 10,
  },
  {
    sku: 'MAT-007',
    name: 'Matcha Latte',
    category: 'Coffee',
    price: '4.80',
    cost: '1.80',
    minStock: 12,
    stock: 9,
    weight: 7,
  },
  {
    sku: 'COO-008',
    name: 'Chocolate Cookie',
    category: 'Bakery',
    price: '2.20',
    cost: '0.80',
    minStock: 25,
    stock: 80,
    weight: 9,
  },
  {
    sku: 'BAG-009',
    name: 'Sourdough Loaf',
    category: 'Bakery',
    price: '5.50',
    cost: '2.20',
    minStock: 10,
    stock: 16,
    expiryInDays: 3,
    weight: 6,
  },
  {
    sku: 'JUI-010',
    name: 'Orange Juice 0.5L',
    category: 'Cold Drinks',
    price: '3.90',
    cost: '1.80',
    minStock: 12,
    stock: 27,
    expiryInDays: 7,
    weight: 6,
  },
  {
    sku: 'TEA-011',
    name: 'Earl Grey Tea',
    category: 'Coffee',
    price: '3.20',
    cost: '0.90',
    minStock: 15,
    stock: 44,
    weight: 4,
  },
  {
    sku: 'GRA-012',
    name: 'Granola Bowl',
    category: 'Snacks',
    price: '6.40',
    cost: '2.70',
    minStock: 8,
    stock: 14,
    expiryInDays: 5,
    weight: 4,
  },
  {
    sku: 'WAT-013',
    name: 'Sparkling Water 0.33L',
    category: 'Cold Drinks',
    price: '2.50',
    cost: '0.70',
    minStock: 30,
    stock: 120,
    weight: 8,
  },
  {
    sku: 'CIN-014',
    name: 'Cinnamon Roll',
    category: 'Bakery',
    price: '3.60',
    cost: '1.30',
    minStock: 15,
    stock: 31,
    expiryInDays: 3,
    weight: 7,
  },
  {
    sku: 'EXP-015',
    name: 'Seasonal Soup',
    category: 'Snacks',
    price: '7.20',
    cost: '3.40',
    minStock: 6,
    stock: 5,
    expiryInDays: 1,
    weight: 3,
  },
];

const kiezProducts: ProductSeed[] = [
  {
    sku: 'MLK-101',
    name: 'Whole Milk 1L',
    category: 'Dairy',
    price: '1.29',
    cost: '0.89',
    minStock: 24,
    stock: 38,
    expiryInDays: 6,
    weight: 10,
  },
  {
    sku: 'EGG-102',
    name: 'Free-range Eggs (10)',
    category: 'Dairy',
    price: '3.49',
    cost: '2.30',
    minStock: 15,
    stock: 26,
    expiryInDays: 12,
    weight: 8,
  },
  {
    sku: 'BAN-103',
    name: 'Bananas 1kg',
    category: 'Fruit',
    price: '2.19',
    cost: '1.40',
    minStock: 20,
    stock: 18,
    weight: 9,
  },
  {
    sku: 'APP-104',
    name: 'Apples 1kg',
    category: 'Fruit',
    price: '3.29',
    cost: '2.10',
    minStock: 15,
    stock: 42,
    weight: 7,
  },
  {
    sku: 'BRE-105',
    name: 'Rye Bread',
    category: 'Bakery',
    price: '2.99',
    cost: '1.70',
    minStock: 12,
    stock: 21,
    expiryInDays: 4,
    weight: 8,
  },
  {
    sku: 'CHE-106',
    name: 'Gouda 400g',
    category: 'Dairy',
    price: '4.49',
    cost: '3.10',
    minStock: 10,
    stock: 25,
    expiryInDays: 20,
    weight: 6,
  },
  {
    sku: 'OIL-107',
    name: 'Olive Oil 500ml',
    category: 'Pantry',
    price: '7.99',
    cost: '5.20',
    minStock: 8,
    stock: 19,
    weight: 4,
  },
  {
    sku: 'PAS-108',
    name: 'Pasta 500g',
    category: 'Pantry',
    price: '1.89',
    cost: '1.10',
    minStock: 25,
    stock: 62,
    weight: 6,
  },
  {
    sku: 'TOM-109',
    name: 'Tomatoes 500g',
    category: 'Fruit',
    price: '2.49',
    cost: '1.50',
    minStock: 15,
    stock: 13,
    expiryInDays: 4,
    weight: 7,
  },
  {
    sku: 'YOG-110',
    name: 'Natural Yogurt 500g',
    category: 'Dairy',
    price: '2.29',
    cost: '1.40',
    minStock: 15,
    stock: 33,
    expiryInDays: 8,
    weight: 6,
  },
  {
    sku: 'CHO-111',
    name: 'Dark Chocolate 70%',
    category: 'Snacks',
    price: '2.79',
    cost: '1.60',
    minStock: 20,
    stock: 48,
    weight: 5,
  },
  {
    sku: 'WAT-112',
    name: 'Mineral Water 1.5L',
    category: 'Drinks',
    price: '0.99',
    cost: '0.50',
    minStock: 40,
    stock: 90,
    weight: 10,
  },
  {
    sku: 'CHI-113',
    name: 'Chicken Breast 1kg',
    category: 'Meat',
    price: '9.49',
    cost: '7.10',
    minStock: 8,
    stock: 11,
    expiryInDays: 2,
    weight: 4,
  },
  {
    sku: 'RIC-114',
    name: 'Basmati Rice 1kg',
    category: 'Pantry',
    price: '3.99',
    cost: '2.60',
    minStock: 12,
    stock: 29,
    weight: 5,
  },
];

const customerNames = [
  'Anna Weber',
  'Jonas Becker',
  'Lena Hoffmann',
  'Felix Wagner',
  'Mia Schulz',
  'Noah Krüger',
  'Emma Fischer',
  'Lukas Meyer',
  'Sophie Richter',
  'David Klein',
  'Clara Wolf',
  'Omar Yilmaz',
  'Elif Demir',
  'Marco Rossi',
  'Sofia Novak',
];

type PaymentMethod = 'card' | 'cash' | 'mobile' | 'cheque';

interface StorePlan {
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  products: ProductSeed[];
  dailyBase: number;
  prefix: string;
  logoColor?: string;
}

const plans: StorePlan[] = [
  {
    name: 'Nordwind Café',
    city: 'Berlin',
    address: 'Torstraße 118, 10119 Berlin',
    phone: '+49 30 1188 2040',
    email: 'hello@nordwind-cafe.de',
    products: northwindProducts,
    dailyBase: 18,
    prefix: 'NWC',
    logoColor: '#4f46e5',
  },
  {
    name: 'Kiez Markt',
    city: 'Berlin',
    address: 'Weserstraße 42, 12045 Berlin',
    phone: '+49 30 6273 9155',
    email: 'team@kiezmarkt.de',
    products: kiezProducts,
    dailyBase: 13,
    prefix: 'KZM',
    logoColor: '#0d9488',
  },
];

export async function seedDemoData(options: { force?: boolean } = {}): Promise<void> {
  const db = getDb();

  const demoEmails = ['owner@demo.dev', 'manager@demo.dev', 'cashier@demo.dev', 'alex@demo.dev'];
  const [existingOwner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'owner@demo.dev'))
    .limit(1);

  if (existingOwner && !options.force) {
    logger.info('Demo data already present — skipping seed. Use --force to reset.');
    return;
  }

  if (existingOwner && options.force) {
    logger.info('Removing previous demo data');
    await db.delete(users).where(inArray(users.email, demoEmails));
  }

  const passwordHash = await hashPassword('PulseDemo2026!');
  const now = new Date();

  const [owner] = await db
    .insert(users)
    .values({
      email: 'owner@demo.dev',
      passwordHash,
      firstName: 'Mara',
      lastName: 'Vogel',
      role: 'business_owner',
      phone: '+49 170 555 0101',
      lastLoginAt: now,
    })
    .returning();

  const [manager] = await db
    .insert(users)
    .values({
      email: 'manager@demo.dev',
      passwordHash,
      firstName: 'Tobias',
      lastName: 'Berger',
      role: 'manager',
      phone: '+49 170 555 0102',
      lastLoginAt: addDays(now, -1),
    })
    .returning();

  const [cashier] = await db
    .insert(users)
    .values({
      email: 'cashier@demo.dev',
      passwordHash,
      firstName: 'Selin',
      lastName: 'Aydin',
      role: 'cashier',
      phone: '+49 170 555 0103',
      lastLoginAt: addDays(now, -2),
    })
    .returning();

  if (!owner || !manager || !cashier) throw new Error('Failed to create demo users');

  await db.insert(dashboardPreferences).values([
    { userId: owner.id, theme: 'system', language: 'en', autoRefreshInterval: 30 },
    { userId: manager.id, theme: 'light', language: 'de', autoRefreshInterval: 30 },
    { userId: cashier.id, theme: 'light', language: 'en', autoRefreshInterval: 60 },
  ]);

  const createdStores: Array<{
    id: string;
    name: string;
    currency: string;
    timezone: string;
    prefix: string;
  }> = [];

  for (const plan of plans) {
    const [store] = await db
      .insert(stores)
      .values({
        ownerId: owner.id,
        name: plan.name,
        city: plan.city,
        country: 'Germany',
        address: plan.address,
        phone: plan.phone,
        email: plan.email,
        timezone: 'Europe/Berlin',
        currency: 'EUR',
        description:
          plan.name === 'Nordwind Café'
            ? 'Specialty coffee, fresh bakery and a calm corner in Mitte.'
            : 'Neighbourhood grocery with regional produce and everyday essentials.',
        settings: {
          milestoneAmount: 1000,
          lowStockEmails: true,
          dataRetentionDays: 0,
          receiptPrefix: plan.prefix,
        },
      })
      .returning();

    if (!store) throw new Error('Failed to create demo store');
    createdStores.push({
      id: store.id,
      name: store.name,
      currency: store.currency,
      timezone: store.timezone,
      prefix: plan.prefix,
    });

    await db.insert(storeUsers).values(
      plan.name === 'Nordwind Café'
        ? [
            { storeId: store.id, userId: owner.id, role: 'admin' },
            { storeId: store.id, userId: manager.id, role: 'manager' },
            { storeId: store.id, userId: cashier.id, role: 'cashier' },
          ]
        : [{ storeId: store.id, userId: owner.id, role: 'admin' }],
    );

    const productRows = await db
      .insert(products)
      .values(
        plan.products.map((product) => ({
          storeId: store.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          price: product.price,
          cost: product.cost,
          currentStock: product.stock,
          minStock: product.minStock,
          maxStock: Math.max(product.stock * 4, 120),
          unit: product.unit ?? 'pcs',
          barcode: product.barcode ?? `40${randomInt(10_000_000_000, 99_999_999_999)}`,
          expiryDate:
            product.expiryInDays !== undefined
              ? addDays(now, product.expiryInDays).toISOString().slice(0, 10)
              : null,
        })),
      )
      .returning();

    // ── Sales history (90 days) ───────────────────────────────
    const saleRows: Array<typeof sales.$inferInsert> = [];
    const itemRows: Array<typeof saleItems.$inferInsert> = [];
    let yesterdayRevenue = 0;

    for (let dayOffset = 89; dayOffset >= 0; dayOffset -= 1) {
      const dayStart = startOfDayInTimeZone('Europe/Berlin', addDays(now, -dayOffset));
      const [, localMonth, localDay] = toDateKey(dayStart, 'Europe/Berlin').split('-').map(Number);
      const localWeekday = new Date(
        Date.UTC(
          Number(toDateKey(dayStart, 'Europe/Berlin').slice(0, 4)),
          localMonth! - 1,
          localDay!,
        ),
      ).getUTCDay();
      const weekendBoost = localWeekday === 0 || localWeekday === 6 ? 1.35 : 1;
      const growth = 1 + (89 - dayOffset) * 0.0022;
      const count = Math.max(
        3,
        Math.round(plan.dailyBase * weekendBoost * growth * (0.75 + rand() * 0.5)),
      );

      const localHourNow = Number(
        new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          hour12: false,
          timeZone: 'Europe/Berlin',
        }).format(now),
      );
      const maxHour = dayOffset === 0 ? Math.max(7, localHourNow) : 21;

      for (let i = 0; i < count; i += 1) {
        const hour = dayOffset === 0 ? randomInt(6, maxHour) : randomInt(7, 21);
        const minute = randomInt(0, 59);
        const [localYear, month, day] = toDateKey(dayStart, 'Europe/Berlin').split('-').map(Number);
        const createdAt = zonedTimeToUtc('Europe/Berlin', localYear!, month!, day!, hour, minute);
        if (createdAt > now) continue;

        const lineCount = randomInt(1, 3);
        const chosen = new Map<string, number>();
        for (let l = 0; l < lineCount; l += 1) {
          const totalWeight = plan.products.reduce((sum, p) => sum + p.weight, 0);
          let ticket = rand() * totalWeight;
          let chosenProduct = plan.products[0]!;
          for (const product of plan.products) {
            ticket -= product.weight;
            if (ticket <= 0) {
              chosenProduct = product;
              break;
            }
          }
          const quantity = chance(0.18) ? 2 : chance(0.05) ? 3 : 1;
          const previous = chosen.get(chosenProduct.sku) ?? 0;
          chosen.set(chosenProduct.sku, previous + quantity);
        }

        let totalCents = 0;
        const saleId = newId();
        const transactionId = `${plan.prefix}-${createdAt
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, '')}-${randomInt(100_000, 999_999)}`;
        const customerName = chance(0.58) ? pick(customerNames) : null;

        for (const [sku, quantity] of chosen) {
          const product = productRows.find((row) => row.sku === sku);
          if (!product) continue;
          const unitCents = toCents(product.price);
          const subtotalCents = unitCents * quantity;
          totalCents += subtotalCents;
          itemRows.push({
            saleId,
            productId: product.id,
            productName: product.name,
            quantity,
            unitPrice: product.price,
            unitCost: product.cost,
            subtotal: fromCents(subtotalCents),
          });
        }

        const discountCents = chance(0.12) ? Math.round(totalCents * (rand() * 0.08)) : 0;
        const finalCents = Math.max(0, totalCents - discountCents);
        const paymentMethod = chance(0.52)
          ? 'card'
          : chance(0.55)
            ? 'cash'
            : chance(0.85)
              ? 'mobile'
              : 'cheque';

        saleRows.push({
          id: saleId,
          storeId: store.id,
          cashierId: chance(0.55) ? cashier.id : manager.id,
          transactionId,
          totalAmount: fromCents(totalCents),
          discount: fromCents(discountCents),
          finalAmount: fromCents(finalCents),
          paymentMethod: paymentMethod as PaymentMethod,
          customerName,
          createdAt,
        });

        if (dayOffset === 1) yesterdayRevenue += finalCents / 100;
      }
    }

    const chunk = <T>(items: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
      return chunks;
    };

    for (const batch of chunk(saleRows, 250)) {
      await db.insert(sales).values(batch);
    }
    for (const batch of chunk(itemRows, 400)) {
      await db.insert(saleItems).values(batch);
    }

    // Keep the curated stock levels (a few products intentionally low) with light jitter.
    for (const product of productRows) {
      const target = Math.max(0, Math.round(product.currentStock * (0.85 + rand() * 0.3)));
      await db.update(products).set({ currentStock: target }).where(eq(products.id, product.id));

      if (chance(0.35)) {
        await db.insert(inventoryAdjustments).values({
          productId: product.id,
          storeId: store.id,
          adjustedBy: manager.id,
          oldQuantity: Math.max(0, target - randomInt(5, 20)),
          newQuantity: target,
          quantityChanged: randomInt(5, 20),
          reason: 'purchase',
          notes: 'Weekly supplier delivery',
          createdAt: addDays(now, -randomInt(2, 20)),
        });
      }
    }

    // ── Notifications & activity ──────────────────────────────
    const refreshedProducts = await db
      .select()
      .from(products)
      .where(eq(products.storeId, store.id));
    const lowStock = refreshedProducts.filter(
      (product) => product.currentStock <= product.minStock,
    );

    await db.insert(notifications).values([
      {
        userId: owner.id,
        storeId: store.id,
        type: 'system' as const,
        title: `Welcome to ${store.name}`,
        message: 'Your store is ready. Record a sale to see live analytics.',
        actionUrl: '/dashboard',
        isRead: true,
        createdAt: addDays(now, -89),
      },
      {
        userId: owner.id,
        storeId: store.id,
        type: 'low_stock' as const,
        title: `Low stock: ${lowStock[0]?.name ?? 'Butter Croissant'}`,
        message: lowStock
          .slice(0, 3)
          .map((product) => `${product.name}: ${product.currentStock} left`)
          .join(' · '),
        actionUrl: '/inventory?lowStock=true',
        createdAt: addDays(now, -1),
      },
      {
        userId: manager.id,
        storeId: store.id,
        type: 'low_stock' as const,
        title: 'Reorder list ready',
        message: `${lowStock.length} products are below their minimum stock level.`,
        actionUrl: '/inventory?lowStock=true',
        createdAt: addDays(now, -1),
      },
      ...(yesterdayRevenue >= 1000
        ? [
            {
              userId: owner.id,
              storeId: store.id,
              type: 'high_sales' as const,
              title: `Daily target reached at ${store.name}`,
              message: `Yesterday closed at €${yesterdayRevenue.toFixed(2)}.`,
              actionUrl: '/analytics',
              createdAt: addDays(now, -1),
            },
          ]
        : []),
    ]);

    await db.insert(activityLogs).values(
      saleRows.slice(-12).map((sale) => ({
        storeId: store.id,
        userId: sale.cashierId ?? manager.id,
        action: 'sale.created',
        entityType: 'sale',
        entityId: sale.id,
        details: {
          transactionId: sale.transactionId,
          finalAmount: sale.finalAmount,
          paymentMethod: sale.paymentMethod,
        },
        createdAt: sale.createdAt,
      })),
    );
  }

  // A pending invitation to showcase the team workflow.
  const [firstStore] = createdStores;
  if (firstStore) {
    const inviteToken = randomToken(32);
    await db.insert(invitations).values({
      storeId: firstStore.id,
      email: 'alex@demo.dev',
      role: 'manager',
      tokenHash: sha256(inviteToken),
      invitedById: owner.id,
      expiresAt: addDays(now, 7),
    });
    logger.info(
      { email: 'alex@demo.dev', acceptUrl: `/accept-invitation?token=${inviteToken}` },
      'Demo invitation created',
    );
  }

  logger.info(
    {
      accounts: ['owner@demo.dev', 'manager@demo.dev', 'cashier@demo.dev'],
      password: 'PulseDemo2026!',
      stores: createdStores.length,
    },
    'Demo data seeded successfully',
  );
}
