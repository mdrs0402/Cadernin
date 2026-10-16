import type { NextFunction, Request, Response } from 'express';
import type { Store } from '@cadernin/shared';
import { db } from '../config/firebase';
import { notFound } from '../errors';
import { currentUser } from '../middleware/auth';
import { toStore } from './mappers';

declare module 'express-serve-static-core' {
  interface Request {
    store?: Store;
  }
}

export const storesCol = () => db.collection('stores');
export const customersCol = (storeId: string) => storesCol().doc(storeId).collection('customers');
export const transactionsCol = (storeId: string) => storesCol().doc(storeId).collection('transactions');
export const remindersCol = (storeId: string) => storesCol().doc(storeId).collection('reminders');

export async function findStoreByOwner(uid: string): Promise<Store | null> {
  const q = await storesCol().where('ownerUid', '==', uid).limit(1).get();
  const doc = q.docs[0];
  return doc ? toStore(doc) : null;
}

/** Carrega a loja do lojista logado. A loja vem SEMPRE do dono (uid do token), nunca de um id enviado pelo front. */
export async function loadMerchantStore(req: Request, _res: Response, next: NextFunction) {
  const store = await findStoreByOwner(currentUser(req).uid);
  if (!store) throw notFound('Loja não encontrada para este usuário.');
  req.store = store;
  next();
}

export function currentStore(req: Request): Store {
  if (!req.store) throw notFound('Loja não encontrada.');
  return req.store;
}
