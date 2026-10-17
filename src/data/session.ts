import type { Store } from '@cadernin/shared';
import { getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { ApiError, notFound } from '../api/client';
import { auth } from '../lib/firebase';
import { storeRef, storesCol, toStore } from './refs';

/** uid do usuário logado (a identidade vem SÓ do Firebase Auth). */
export function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new ApiError(401, 'unauthorized', 'Sua sessão expirou. Entre de novo.');
  return uid;
}

/**
 * Loja de um lojista. Lojas novas têm o id = uid do dono; lojas antigas (criadas pela API)
 * têm id aleatório, por isso a busca é pelo dono.
 */
export async function findStoreByOwner(uid: string): Promise<Store | null> {
  const own = await getDoc(storeRef(uid)).catch(() => null);
  if (own?.exists()) return toStore(own);
  const q = await getDocs(query(storesCol(), where('ownerUid', '==', uid), limit(1)));
  const d = q.docs[0];
  return d ? toStore(d) : null;
}

const storeIds = new Map<string, Promise<string>>();

/** Id da loja do lojista logado (guardado em memória por usuário). */
export function myStoreId(): Promise<string> {
  const uid = currentUid();
  let p = storeIds.get(uid);
  if (!p) {
    p = findStoreByOwner(uid).then((s) => {
      if (!s) throw notFound('Loja não encontrada para este usuário.');
      return s.id;
    });
    p.catch(() => storeIds.delete(uid));
    storeIds.set(uid, p);
  }
  return p;
}

/** Loja do lojista logado, lida na hora (o nome pode ter mudado). */
export async function myStore(): Promise<Store> {
  const snap = await getDoc(storeRef(await myStoreId()));
  if (!snap.exists()) throw notFound('Loja não encontrada.');
  return toStore(snap);
}
