import { createProfileSchema, type CreateProfileInput, type MeResponse } from '@cadernin/shared';
import type { User } from 'firebase/auth';
import { getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { conflict } from '../api/client';
import { db } from '../lib/firebase';
import { storeRef, toUserProfile, userRef } from './refs';
import { findStoreByOwner } from './session';

/** Identidade (do Firebase Auth) + perfil e loja (do Firestore). */
export async function getMe(user: User): Promise<MeResponse> {
  const snap = await getDoc(userRef(user.uid));
  const profile = snap.exists() ? toUserProfile(snap) : null;
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    picture: user.photoURL,
    profile,
    store: profile?.role === 'merchant' ? await findStoreByOwner(user.uid) : null,
  };
}

/** Primeiro acesso: escolhe o perfil (definitivo). Lojista já cria a loja junto, no mesmo batch. */
export async function createProfile(user: User, raw: CreateProfileInput) {
  const input = createProfileSchema.parse(raw);
  const ref = userRef(user.uid);
  if ((await getDoc(ref)).exists()) throw conflict('Seu perfil já foi definido.');

  const batch = writeBatch(db);
  batch.set(ref, {
    name: (user.displayName ?? user.email?.split('@')[0] ?? 'Usuário').slice(0, 80) || 'Usuário',
    email: user.email ?? null,
    photoURL: user.photoURL && user.photoURL.length <= 2048 ? user.photoURL : null,
    role: input.role,
    createdAt: serverTimestamp(),
  });
  if (input.role === 'merchant') {
    // id da loja = uid do dono: garante uma loja por lojista (as regras exigem isso)
    batch.set(storeRef(user.uid), { ownerUid: user.uid, name: input.storeName, createdAt: serverTimestamp() });
  }
  await batch.commit();
  return { role: input.role };
}
