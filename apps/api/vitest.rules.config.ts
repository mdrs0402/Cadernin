import { defineConfig } from 'vitest/config';

// Testes das firestore.rules: precisam do emulador do Firestore rodando em 127.0.0.1:8080
// (npm run dev ou npm run emulators na raiz). Usam o projeto isolado "demo-rules".
export default defineConfig({
  test: { include: ['test/**/*.rules.test.ts'], fileParallelism: false, testTimeout: 15_000 },
});
