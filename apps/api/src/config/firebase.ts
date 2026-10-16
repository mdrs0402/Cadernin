import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from './env';

// - *_EMULATOR_HOST definido: o Admin SDK fala com o emulador daquele serviço, sem credencial.
// - GOOGLE_APPLICATION_CREDENTIALS definido: usa a service account (necessária para gravar
//   custom claims e acessar o Firestore real).
// - FIREBASE_SERVICE_ACCOUNT definido: mesma coisa, mas com o JSON da service account na
//   própria variável (Vercel e outras hospedagens sem arquivo de credencial).
// - Sem nenhum deles, só com o projectId, ainda dá para verificar ID tokens reais
//   (o SDK baixa as chaves públicas do Google).
// Aceita o JSON com ou sem aspas em volta (é fácil colar a linha do .env com as aspas no painel).
function parseServiceAccount(raw: string) {
  let value = raw.trim();
  if (/^(['"]).*\1$/s.test(value)) value = value.slice(1, -1);
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT não é um JSON válido: cole o conteúdo inteiro do arquivo da service account.');
  }
}

const app =
  getApps()[0] ??
  initializeApp({
    projectId: env.FIREBASE_PROJECT_ID,
    ...(env.FIREBASE_SERVICE_ACCOUNT
      ? { credential: cert(parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT)) }
      : env.GOOGLE_APPLICATION_CREDENTIALS
        ? { credential: applicationDefault() }
        : {}),
  });

export const adminAuth = getAuth(app);
export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
