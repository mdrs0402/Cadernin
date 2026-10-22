// Dá (ou tira) a marca `admin: true` de uma conta do Firebase Auth.
// É essa marca que a função isAdmin() das firestore.rules confere.
//
// Uso (na raiz do projeto):
//   npm install --no-save firebase-admin
//   node scripts/tornar-admin.mjs seu-email@gmail.com            -> vira admin
//   node scripts/tornar-admin.mjs seu-email@gmail.com --remover  -> deixa de ser admin
//
// Precisa da chave da conta de serviço do Firebase:
//   Console do Firebase > ⚙ Configurações do projeto > Contas de serviço > "Gerar nova chave privada".
//   Salve como service-account.json na raiz (já está no .gitignore) ou aponte o caminho em
//   GOOGLE_APPLICATION_CREDENTIALS. Apague a chave depois de usar.
//
// Depois de rodar, saia e entre de novo no painel: a marca só aparece num token novo.

import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const args = process.argv.slice(2);
const remover = args.includes('--remover');
const email = args.find((a) => !a.startsWith('--'));

if (!email) {
  console.error('Uso: node scripts/tornar-admin.mjs <email> [--remover]');
  process.exit(1);
}

const caminhoChave = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './service-account.json';
let chave;
try {
  chave = JSON.parse(readFileSync(caminhoChave, 'utf8'));
} catch {
  console.error(`Não achei a chave da conta de serviço em "${caminhoChave}". Veja as instruções no topo do arquivo.`);
  process.exit(1);
}

initializeApp({ credential: cert(chave) });
const auth = getAuth();

let user;
try {
  user = await auth.getUserByEmail(email);
} catch {
  console.error(`Nenhuma conta com o e-mail ${email}. Entre no app uma vez com essa conta e tente de novo.`);
  process.exit(1);
}

// Mantém outras marcas que a conta já tenha.
const claims = { ...(user.customClaims ?? {}) };
if (remover) delete claims.admin;
else claims.admin = true;

await auth.setCustomUserClaims(user.uid, claims);
console.log(`${email} (uid ${user.uid}) ${remover ? 'NÃO é mais admin' : 'agora é admin'}.`);
console.log('Saia e entre de novo no painel para a mudança valer.');
