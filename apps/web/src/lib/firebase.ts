import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
auth.languageCode = 'pt-BR';

if (import.meta.env.VITE_USE_AUTH_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
