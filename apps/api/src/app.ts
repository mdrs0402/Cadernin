import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { customerRouter } from './routes/customer';
import { meRouter } from './routes/me';
import { storeRouter } from './routes/store';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, allowedHeaders: ['Authorization', 'Content-Type'] }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/me', requireAuth, meRouter);
  app.use('/store', requireAuth, storeRouter);
  app.use('/customer', requireAuth, customerRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
