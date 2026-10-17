import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const ENV_NAMES: Record<keyof typeof config, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

/**
 * Variáveis do Firebase que faltaram no build. Na Vercel, as VITE_* entram no site NA HORA DO BUILD:
 * depois de criar/alterar uma, é preciso fazer um novo deploy.
 */
export const missingFirebaseEnv = (Object.keys(config) as (keyof typeof config)[])
  .filter((k) => !config[k])
  .map((k) => ENV_NAMES[k]);

// Com valor provisório o app ainda abre e a tela de login explica o que falta (em vez de tela branca).
const app = initializeApp({
  apiKey: config.apiKey || 'faltando-VITE_FIREBASE_API_KEY',
  authDomain: config.authDomain || undefined,
  projectId: config.projectId || 'faltando-VITE_FIREBASE_PROJECT_ID',
  appId: config.appId || undefined,
});

export const auth = getAuth(app);
auth.languageCode = 'pt-BR';

/** Sem servidor: o app lê e grava direto no Firestore. A segurança está nas firestore.rules. */
export const db = getFirestore(app);

if (import.meta.env.VITE_USE_AUTH_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
if (import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
