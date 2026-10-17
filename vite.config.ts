import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@cadernin/shared': fileURLToPath(new URL('./src/shared/index.ts', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  // Testes unitários (sem Firebase). Os testes das firestore.rules ficam em test/ (npm run test:rules).
  test: { include: ['src/**/*.test.ts'] },
});
