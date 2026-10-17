import {
  customerInputSchema,
  customerUpdateSchema,
  updateStoreSchema,
  type Customer,
  type CustomerInput,
  type CustomerUpdateInput,
  type Store,
  type UpdateStoreInput,
} from '@cadernin/shared';
import { doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { conflict, notFound } from '../api/client';
import { db } from '../lib/firebase';
import { reserveInviteCode } from './invites';
import { customerRef, customersCol, inviteRef, storeRef, toCustomer, toStore, transactionsCol } from './refs';
import { currentUid, myStoreId } from './session';

/* ---------- Loja ---------- */

export async function updateStore(raw: UpdateStoreInput): Promise<Store> {
  const { name } = updateStoreSchema.parse(raw);
  const ref = storeRef(await myStoreId());
  await updateDoc(ref, { name });
  return toStore(await getDoc(ref));
}

/* ---------- Clientes ---------- */

async function assertPhoneFree(storeId: string, phone: string, exceptId?: string) {
  const q = await getDocs(query(customersCol(storeId), where('phone', '==', phone), limit(2)));
  if (q.docs.some((d) => d.id !== exceptId)) throw conflict('Já existe um cliente com esse telefone na sua loja.');
}

export async function listCustomers(): Promise<Customer[]> {
  const snap = await getDocs(customersCol(await myStoreId()));
  return snap.docs.map(toCustomer).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export async function getCustomer(id: string): Promise<Customer> {
  const snap = await getDoc(customerRef(await myStoreId(), id)).catch(() => null);
  if (!snap?.exists()) throw notFound('Cliente não encontrado.');
  return toCustomer(snap);
}

/** Cria o cliente e o código de convite dele, juntos. */
export async function createCustomer(raw: CustomerInput): Promise<Customer> {
  const storeId = await myStoreId();
  const input = customerInputSchema.parse(raw);
  await assertPhoneFree(storeId, input.phone);

  const ref = doc(customersCol(storeId));
  await runTransaction(db, async (tx) => {
    const code = await reserveInviteCode(tx);
    tx.set(ref, {
      ...input,
      userUid: null,
      balanceDue: 0,
      inviteCode: code,
      lastReminderAt: null,
      lastTxId: null,
      createdAt: serverTimestamp(),
      createdBy: currentUid(),
    });
    tx.set(inviteRef(code), { storeId, customerId: ref.id, createdAt: serverTimestamp() });
  });
  return toCustomer(await getDoc(ref));
}

/** Edita nome/telefone/limite. O saldo (balanceDue) nunca é editado aqui: só muda via lançamentos. */
export async function updateCustomer(id: string, raw: CustomerUpdateInput): Promise<Customer> {
  const storeId = await myStoreId();
  const input = customerUpdateSchema.parse(raw);
  const ref = customerRef(storeId, id);
  if (!(await getDoc(ref)).exists()) throw notFound('Cliente não encontrado.');
  if (input.phone) await assertPhoneFree(storeId, input.phone, id);
  await updateDoc(ref, input);
  return toCustomer(await getDoc(ref));
}

/** Exclui só cliente sem nenhum lançamento (as regras também exigem isso). */
export async function deleteCustomer(id: string): Promise<void> {
  const storeId = await myStoreId();
  const ref = customerRef(storeId, id);
  const history = await getDocs(query(transactionsCol(storeId), where('customerId', '==', id), limit(1)));
  if (!history.empty) throw conflict('Este cliente já tem lançamentos no caderno e não pode ser excluído.');

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw notFound('Cliente não encontrado.');
    const d = snap.data();
    if (d.balanceDue !== 0 || d.lastTxId) {
      throw conflict('Este cliente já tem lançamentos no caderno e não pode ser excluído.');
    }
    if (d.inviteCode) tx.delete(inviteRef(d.inviteCode));
    tx.delete(ref);
  });
}

/** Gera um novo código de convite (invalida o anterior). Só para clientes ainda não vinculados. */
export async function regenerateInvite(id: string): Promise<Customer> {
  const storeId = await myStoreId();
  const ref = customerRef(storeId, id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw notFound('Cliente não encontrado.');
    if (snap.data().userUid) throw conflict('Este cliente já vinculou a conta.');
    const code = await reserveInviteCode(tx);
    const old = snap.data().inviteCode as string | null | undefined;
    if (old) tx.delete(inviteRef(old));
    tx.set(inviteRef(code), { storeId, customerId: id, createdAt: serverTimestamp() });
    tx.update(ref, { inviteCode: code });
  });
  return toCustomer(await getDoc(ref));
}
