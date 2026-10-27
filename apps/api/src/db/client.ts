import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleNodePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { existsSync, mkdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import * as schema from './schema';

/**
 * Both drivers expose the same Drizzle PostgreSQL query builder API at runtime.
 * We type the exported database against the node-postgres flavour to keep
 * call sites simple; the PGlite instance is structurally compatible.
 */
export type Database = NodePgDatabase<typeof schema>;
export type RawQuery = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<{ rows: T[] }>;

interface DatabaseState {
  db: Database;
  raw: RawQuery;
  driver: 'pglite' | 'postgres';
  close: () => Promise<void>;
}

let state: DatabaseState | null = null;

export interface InitDatabaseOptions {
  databaseUrl?: string;
  pgliteDir?: string;
}

export async function initDatabase(options: InitDatabaseOptions = {}): Promise<DatabaseState> {
  if (state) return state;

  const databaseUrl = options.databaseUrl ?? env.DATABASE_URL;

  if (databaseUrl) {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
    });
    await pool.query('SELECT 1');
    const db = drizzleNodePg(pool, { schema });
    state = {
      db: db as unknown as Database,
      raw: async <T>(text: string, params: unknown[] = []) =>
        (await pool.query(text, params as never)) as unknown as { rows: T[] },
      driver: 'postgres',
      close: () => pool.end(),
    };
    logger.info('Connected to PostgreSQL');
  } else {
    const configuredDir = options.pgliteDir ?? env.PGLITE_DATA_DIR;
    let dataDir = configuredDir;
    if (configuredDir !== 'memory://') {
      dataDir = isAbsolute(configuredDir)
        ? configuredDir
        : resolve(__dirname, '..', '..', configuredDir);
      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    }
    const client = new PGlite(dataDir);
    await client.waitReady;
    const db = drizzlePglite(client, { schema });
    state = {
      db: db as unknown as Database,
      raw: async <T>(text: string, params: unknown[] = []) =>
        client.query<T>(text, params as never[]),
      driver: 'pglite',
      close: () => client.close(),
    };
    logger.info({ dataDir }, 'Using embedded PostgreSQL (PGlite)');
  }

  return state;
}

export function getDb(): Database {
  if (!state) throw new Error('Database has not been initialised. Call initDatabase() first.');
  return state.db;
}

export function getRawQuery(): RawQuery {
  if (!state) throw new Error('Database has not been initialised. Call initDatabase() first.');
  return state.raw;
}

export function getDriver(): 'pglite' | 'postgres' {
  if (!state) throw new Error('Database has not been initialised.');
  return state.driver;
}

export async function closeDatabase(): Promise<void> {
  if (!state) return;
  await state.close();
  state = null;
}

/** Test helper: swaps the singleton for an isolated in-memory database. */
export async function initTestDatabase(): Promise<void> {
  await closeDatabase();
  await initDatabase({ databaseUrl: undefined, pgliteDir: 'memory://' });
}

export { schema };
