import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { createProfileSchema, type MeResponse } from '@cadernin/shared';
import { adminAuth, db } from '../config/firebase';
import { conflict } from '../errors';
import { currentUser } from '../middleware/auth';
import { toUserProfile } from '../services/mappers';
import { findStoreByOwner, storesCol } from '../services/stores';

export const meRouter = Router();

const usersCol = () => db.collection('users');

meRouter.get('/', async (req, res) => {
  const user = currentUser(req);
  const snap = await usersCol().doc(user.uid).get();
  const profile = snap.exists ? toUserProfile(snap) : null;

  // Autocorreção: se o claim não bate com o perfil salvo (ex.: falha ao gravar claim), regrava.
  let claimsStale = false;
  if (profile && user.role !== profile.role) {
    await adminAuth.setCustomUserClaims(user.uid, { role: profile.role });
    claimsStale = true;
  }

  const body: MeResponse = {
    uid: user.uid,
    email: user.email,
    name: user.name,
    picture: user.picture,
    profile,
    store: profile?.role === 'merchant' ? await findStoreByOwner(user.uid) : null,
    claimsStale,
  };
  res.json(body);
});

/** Primeiro acesso: escolhe o perfil (definitivo no MVP). Lojista já cria a loja junto. */
meRouter.post('/profile', async (req, res) => {
  const user = currentUser(req);
  const input = createProfileSchema.parse(req.body);
  const userRef = usersCol().doc(user.uid);

  if ((await userRef.get()).exists) throw conflict('Seu perfil já foi definido.');

  // Claim primeiro: se a gravação no Firestore falhar, o usuário só tenta de novo.
  // Se o contrário acontecer, o GET /me corrige o claim.
  await adminAuth.setCustomUserClaims(user.uid, { role: input.role });

  const now = Timestamp.now();
  await db.runTransaction(async (tx) => {
    if ((await tx.get(userRef)).exists) throw conflict('Seu perfil já foi definido.');
    tx.create(userRef, {
      name: user.name ?? user.email?.split('@')[0] ?? 'Usuário',
      email: user.email,
      photoURL: user.picture,
      role: input.role,
      createdAt: now,
    });
    if (input.role === 'merchant') {
      tx.create(storesCol().doc(), { ownerUid: user.uid, name: input.storeName, createdAt: now });
    }
  });

  res.status(201).json({ role: input.role });
});
