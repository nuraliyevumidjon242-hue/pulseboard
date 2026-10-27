import { closeDatabase, initDatabase } from './client';
import { runMigrations } from './migrate';
import { logger } from '../lib/logger';

async function main(): Promise<void> {
  await initDatabase();
  const applied = await runMigrations();
  logger.info({ applied }, 'Database migration completed');
  await closeDatabase();
}

main().catch((error) => {
  logger.error({ error }, 'Migration failed');
  process.exitCode = 1;
});
