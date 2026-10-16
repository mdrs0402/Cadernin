import { defineConfig } from 'tsup';

// O shared é TS puro (sem build próprio): entra no bundle da API.
export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  target: 'node20',
  clean: true,
  noExternal: ['@cadernin/shared'],
});
