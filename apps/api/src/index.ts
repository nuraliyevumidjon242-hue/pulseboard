import { createServer } from 'node:http';
import { env } from './config/env';
import { closeDatabase, initDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { logger } from './lib/logger';
import { createApp } from './app';
import { createSocketServer } from './realtime/socket';

async function main(): Promise<void> {
  await initDatabase();
  await runMigrations();

  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, docs: `http://localhost:${env.PORT}/api/docs` },
      'PulseBoard API is running',
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down gracefully');
    io.close();
    httpServer.close(() => logger.info('HTTP server closed'));
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    process.exit(1);
  });
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start API');
  process.exit(1);
});
