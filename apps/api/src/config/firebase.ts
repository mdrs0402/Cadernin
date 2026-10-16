import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from './env';

// - *_EMULATOR_HOST definido: o Admin SDK fala com o emulador daquele serviço, sem credencial.
// - GOOGLE_APPLICATION_CREDENTIALS definido: usa a service account (necessária para gravar
//   custom claims e acessar o Firestore real).
// - Sem nenhum dos dois, só com o projectId, ainda dá para verificar ID tokens reais
//   (o SDK baixa as chaves públicas do Google).
const app =
  getApps()[0] ??
  initializeApp({
    projectId: env.FIREBASE_PROJECT_ID,
    ...(env.GOOGLE_APPLICATION_CREDENTIALS ? { credential: applicationDefault() } : {}),
  });

export const adminAuth = getAuth(app);
export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
