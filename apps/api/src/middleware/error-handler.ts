import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { isProduction } from '../config/env';
import { AppError, isPgUniqueViolation } from '../lib/errors';
import { logger } from '../lib/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} does not exist`,
      requestId: req.requestId,
    },
  });
}

interface PgError {
  code?: string;
  detail?: string;
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ err: error, requestId: req.requestId }, error.message);
    }
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
        requestId: req.requestId,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.flatten(),
        requestId: req.requestId,
      },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Uploaded file is too large (max 5 MB)'
            : `Upload failed: ${error.message}`,
        requestId: req.requestId,
      },
    });
    return;
  }

  const pgError = error as PgError;
  if (isPgUniqueViolation(error)) {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A record with these values already exists',
        details: isProduction ? undefined : pgError.detail,
        requestId: req.requestId,
      },
    });
    return;
  }

  if (typeof error === 'object' && error !== null && 'type' in error) {
    const type = (error as { type?: string }).type;
    if (type === 'entity.too.large') {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body is too large',
          requestId: req.requestId,
        },
      });
      return;
    }
    if (type === 'entity.parse.failed') {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Request body contains invalid JSON',
          requestId: req.requestId,
        },
      });
      return;
    }
  }

  logger.error({ err: error, requestId: req.requestId }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      requestId: req.requestId,
    },
  });
}
