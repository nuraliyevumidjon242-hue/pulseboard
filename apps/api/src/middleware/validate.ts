import type { Request } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AppError } from '../lib/errors';

type Source = 'body' | 'query' | 'params';

export function validate<T extends ZodTypeAny>(
  schema: T,
  source: Source = 'body',
): (req: Request, _res: unknown, next: (error?: unknown) => void) => void {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', {
          fields: result.error.flatten().fieldErrors,
          source,
        }),
      );
      return;
    }
    // Express 4 query/params are mutable enough for our use; body is replaced.
    if (source === 'body') {
      req.body = result.data as Record<string, unknown>;
    } else {
      Object.assign(req[source] as Record<string, unknown>, result.data as Record<string, unknown>);
    }
    next();
  };
}

export function parsePagination(query: Record<string, unknown>): { page: number; limit: number } {
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit ?? '20'), 10) || 20));
  return { page, limit };
}

export type InferBody<T extends ZodTypeAny> = z.infer<T>;
