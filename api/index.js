// Função serverless da Vercel. O bundle é gerado por `npm run build -w @cadernin/api`
// (veja vercel.json); as rotas /api/* são reescritas para cá.
export { default } from '../apps/api/dist/vercel.js';
