import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3333),
  WEB_ORIGIN: z.string().url(),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas (veja apps/api/.env.example):');
  console.error(z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
