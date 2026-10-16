import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { HttpError } from '../errors';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'not_found', message: 'Rota não encontrada.' } });
}

// Express 5 encaminha erros de handlers async para cá automaticamente.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: err.issues[0]?.message ?? 'Dados inválidos.',
        details: z.flattenError(err).fieldErrors,
      },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'invalid_json', message: 'JSON inválido.' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'internal', message: 'Erro interno. Tente novamente.' } });
}
