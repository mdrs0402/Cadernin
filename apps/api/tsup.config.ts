import { defineConfig } from 'tsup';

// O shared é TS puro (sem build próprio): entra no bundle da API.
// src/vercel.ts é a entrada da função serverless da Vercel (api/index.js).
export default defineConfig({
  entry: ['src/server.ts', 'src/vercel.ts'],
  format: 'esm',
  target: 'node20',
  clean: true,
  noExternal: ['@cadernin/shared'],
});
