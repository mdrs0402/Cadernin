import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Testes das firestore.rules: rodam contra o emulador do Firestore (npm run test:rules já sobe ele).
export default defineConfig({
  resolve: {
    alias: { '@cadernin/shared': fileURLToPath(new URL('./src/shared/index.ts', import.meta.url)) },
  },
  test: { include: ['test/**/*.rules.test.ts'], fileParallelism: false, testTimeout: 20_000, hookTimeout: 30_000 },
});
