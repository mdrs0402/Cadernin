import { defineConfig } from 'tsup';

// O shared é TS puro (sem build próprio): entra no bundle da API.
// Nenhuma entrada se chama "server"/"app"/"index" em src/ ou dist/: a Vercel detecta esses
// nomes sozinha (ignorando o entrypoint do vercel.json) e rodava o bundle ESM sem o
// "type": "module", quebrando com "Cannot use import statement outside a module".
export default defineConfig([
  // Servidor local (npm run dev/start). .mjs para ser ESM em qualquer lugar.
  {
    entry: ['src/dev.ts'],
    format: 'esm',
    target: 'node20',
    clean: true,
    noExternal: ['@cadernin/shared'],
    outExtension: () => ({ js: '.mjs' }),
  },
  // Entrada do serviço "api" na Vercel (index.cjs), em CommonJS.
  {
    entry: ['src/vercel.ts'],
    format: 'cjs',
    target: 'node20',
    noExternal: ['@cadernin/shared'],
  },
]);
