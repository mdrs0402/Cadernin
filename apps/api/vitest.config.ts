import { defineConfig } from 'vitest/config';

// Testes unitários da API: não falam com Firebase nenhum. As variáveis abaixo só existem para o
// módulo de config carregar (o Admin SDK não conecta enquanto ninguém usa o db/auth).
// Os testes das firestore.rules ficam em test/ e rodam com `npm run test:rules` (precisam do emulador).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: { WEB_ORIGIN: 'http://localhost:5173', FIREBASE_PROJECT_ID: 'demo-unit' },
  },
});
