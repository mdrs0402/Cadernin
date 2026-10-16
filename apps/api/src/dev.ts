import { env } from './config/env';
import { createApp } from './createApp';

createApp().listen(env.PORT, () => {
  console.log(`API Cadernin em http://localhost:${env.PORT}`);
  console.log(`  projeto:   ${env.FIREBASE_PROJECT_ID}`);
  console.log(`  auth:      ${env.FIREBASE_AUTH_EMULATOR_HOST ? `emulador (${env.FIREBASE_AUTH_EMULATOR_HOST})` : 'Firebase real'}`);
  console.log(`  firestore: ${env.FIRESTORE_EMULATOR_HOST ? `emulador (${env.FIRESTORE_EMULATOR_HOST})` : 'Firebase real'}`);
});
