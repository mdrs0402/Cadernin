// Entrada do serviço "api" na Vercel (vercel.json). O bundle em dist/ é gerado pelo
// buildCommand do serviço (`npm run build`, tsup) a partir de src/vercel.ts.
export { default } from './dist/vercel.js';
