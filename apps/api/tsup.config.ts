import { defineConfig } from 'tsup';

// O shared é TS puro (sem build próprio): entra no bundle da API.
export default defineConfig([
  {
    entry: ['src/server.ts'],
    format: 'esm',
    target: 'node20',
    noExternal: ['@cadernin/shared'],
  },
  // Entrada do serviço "api" na Vercel (index.cjs). Sai em CommonJS porque a Vercel
  // empacota a função num server.js sem o "type": "module" do package.json.
  {
    entry: ['src/vercel.ts'],
    format: 'cjs',
    target: 'node20',
    noExternal: ['@cadernin/shared'],
  },
]);
