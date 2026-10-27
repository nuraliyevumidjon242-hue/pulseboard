import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { logger } from '../lib/logger';
import { getRawQuery } from './client';

const MIGRATIONS_DIR = resolve(__dirname, '..', '..', 'drizzle');

/** Applies every pending SQL migration exactly once, in filename order. */
export async function runMigrations(): Promise<string[]> {
  const raw = getRawQuery();
  await raw(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await raw<{ name: string }>('SELECT name FROM _migrations')).rows.map((row) => row.name),
  );

  if (!existsSync(MIGRATIONS_DIR)) {
    logger.warn({ dir: MIGRATIONS_DIR }, 'No migrations directory found — schema was not applied');
    return [];
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const freshlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    logger.info({ migration: file, statements: statements.length }, 'Applying migration');

    for (const statement of statements) {
      await raw(statement);
    }

    await raw('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    freshlyApplied.push(file);
  }

  if (freshlyApplied.length === 0) {
    logger.info('Database schema is up to date');
  }

  return freshlyApplied;
}

export const migrationsDirectory = (): string => dirname(MIGRATIONS_DIR);
