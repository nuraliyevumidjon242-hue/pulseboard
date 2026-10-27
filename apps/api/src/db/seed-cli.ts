import { closeDatabase, initDatabase } from './client';
import { runMigrations } from './migrate';
import { seedDemoData } from './seed';
import { logger } from '../lib/logger';

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  await initDatabase();
  await runMigrations();
  await seedDemoData({ force });
  await closeDatabase();
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Seed failed');
  process.exit(1);
});
