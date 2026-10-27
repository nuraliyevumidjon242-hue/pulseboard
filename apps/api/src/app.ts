import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins, env, isProduction } from './config/env';
import { getRawQuery } from './db/client';
import { openApiDocument } from './docs/openapi';
import { asyncHandler } from './lib/async-handler';
import { AppError } from './lib/errors';
import { sendData } from './lib/http';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { apiLimiter } from './middleware/rate-limit';
import { requestId } from './middleware/request-id';
import { analyticsRouter } from './modules/analytics/routes';
import { authRouter } from './modules/auth/routes';
import { notificationsRouter } from './modules/notifications/routes';
import { preferencesRouter } from './modules/preferences/routes';
import { inventoryRouter, productsRouter } from './modules/products/routes';
import { salesRouter } from './modules/sales/routes';
import { storesRouter } from './modules/stores/routes';
import { activityRouter, invitationsRouter, teamRouter } from './modules/team/routes';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY ? 1 : false);
  app.disable('x-powered-by');
  app.disable('etag');

  app.use(requestId);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new AppError(403, 'FORBIDDEN', 'Origin is not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
      maxAge: 86_400,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url?.startsWith('/api/docs') === true,
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use('/api', apiLimiter);

  const healthHandler = asyncHandler(async (_req, res) => {
    const startedAt = Date.now();
    let databaseOk = true;
    try {
      await getRawQuery()('SELECT 1');
    } catch {
      databaseOk = false;
    }

    return res.status(databaseOk ? 200 : 503).json({
      status: databaseOk ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      environment: env.NODE_ENV,
      checks: {
        database: { status: databaseOk ? 'up' : 'down', latencyMs: Date.now() - startedAt },
      },
    });
  });

  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  // Public
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/invitations', invitationsRouter);

  // Store-scoped resources
  app.use('/api/v1/stores/:storeId/products', productsRouter);
  app.use('/api/v1/stores/:storeId/inventory', inventoryRouter);
  app.use('/api/v1/stores/:storeId/sales', salesRouter);
  app.use('/api/v1/stores/:storeId/analytics', analyticsRouter);
  app.use('/api/v1/stores/:storeId/team', teamRouter);
  app.use('/api/v1/stores/:storeId/activity-log', activityRouter);
  app.use('/api/v1/stores', storesRouter);

  // User-scoped resources
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/user/preferences', preferencesRouter);

  app.get('/api/v1/meta', (_req, res) =>
    sendData(res, {
      name: 'PulseBoard API',
      version: '1.0.0',
      docs: '/api/docs',
      environment: env.NODE_ENV,
      capabilities: {
        websockets: true,
        exports: ['pdf', 'csv'],
        realtimeEvents: [
          'sale:created',
          'inventory:updated',
          'notification:new',
          'milestone:reached',
        ],
      },
    }),
  );

  // API documentation
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'PulseBoard API docs',
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
      customCss: isProduction ? undefined : '.swagger-ui .topbar { display: none }',
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
