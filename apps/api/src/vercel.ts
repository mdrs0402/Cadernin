import express from 'express';
import { createApp } from './app';

// Entrada da API na Vercel: o front e a API ficam no mesmo domínio, com a API em /api/*.
const app = express();
app.disable('x-powered-by');
app.use('/api', createApp());

export default app;
