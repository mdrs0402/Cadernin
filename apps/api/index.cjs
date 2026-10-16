// Entrada do serviço "api" na Vercel (vercel.json). O bundle em dist/ é gerado pelo
// buildCommand do serviço (`npm run build`, tsup) a partir de src/vercel.ts.
module.exports = require('./dist/vercel.cjs').default;
