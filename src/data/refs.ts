import type { Customer, Reminder, Store, Transaction, UserProfile } from '@cadernin/shared';
import { collection, doc, type DocumentSnapshot, type Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

/* ---------- Coleções (mesmos caminhos de antes: os dados existentes continuam valendo) ---------- */

export const usersCol = () => collection(db, 'users');
export const userRef = (uid: string) => doc(db, 'users', uid);
export const linksCol = (uid: string) => collection(db, 'users', uid, 'links');
export const linkRef = (uid: string, storeId: string) => doc(db, 'users', uid, 'links', storeId);
export const storesCol = () => collection(db, 'stores');
export const storeRef = (storeId: string) => doc(db, 'stores', storeId);
export const customersCol = (storeId: string) => collection(db, 'stores', storeId, 'customers');
export const customerRef = (storeId: string, customerId: string) => doc(db, 'stores', storeId, 'customers', customerId);
export const transactionsCol = (storeId: string) => collection(db, 'stores', storeId, 'transactions');
export const transactionRef = (storeId: string, txId: string) => doc(db, 'stores', storeId, 'transactions', txId);
export const remindersCol = (storeId: string) => collection(db, 'stores', storeId, 'reminders');
export const invitesCol = () => collection(db, 'invites');
export const inviteRef = (code: string) => doc(db, 'invites', code);

/* ---------- Documento -> tipo do app (datas como ISO string) ---------- */

export const iso = (t: Timestamp | undefined | null) => (t ? t.toDate().toISOString() : new Date(0).toISOString());

// 'estimate': logo depois de gravar, o serverTimestamp ainda pode estar pendente no cache local.
const dataOf = (snap: DocumentSnapshot) => snap.data({ serverTimestamps: 'estimate' })!;

export function toUserProfile(snap: DocumentSnapshot): UserProfile {
  const d = dataOf(snap);
  return {
    uid: snap.id,
    name: d.name,
    email: d.email ?? null,
    photoURL: d.photoURL ?? null,
    role: d.role,
    createdAt: iso(d.createdAt),
  };
}

export function toStore(snap: DocumentSnapshot): Store {
  const d = dataOf(snap);
  return { id: snap.id, name: d.name, ownerUid: d.ownerUid, createdAt: iso(d.createdAt) };
}

export function toCustomer(snap: DocumentSnapshot): Customer {
  const d = dataOf(snap);
  return {
    id: snap.id,
    name: d.name,
    phone: d.phone,
    userUid: d.userUid ?? null,
    creditLimit: d.creditLimit,
    balanceDue: d.balanceDue,
    inviteCode: d.userUid ? null : (d.inviteCode ?? null),
    lastReminderAt: d.lastReminderAt ? iso(d.lastReminderAt) : null,
    createdAt: iso(d.createdAt),
  };
}

export function toTransaction(snap: DocumentSnapshot): Transaction {
  const d = dataOf(snap);
  return {
    id: snap.id,
    customerId: d.customerId,
    type: d.type,
    amountCents: d.amountCents,
    description: d.description,
    dueDate: d.dueDate ?? null,
    createdAt: iso(d.createdAt),
    reversesId: d.reversesId ?? null,
    reversedById: d.reversedById ?? null,
    reversesType: d.reversesType ?? null,
  };
}

export function toReminder(snap: DocumentSnapshot): Reminder {
  const d = dataOf(snap);
  return {
    id: snap.id,
    customerId: d.customerId,
    customerName: d.customerName,
    phone: d.phone,
    kind: d.kind,
    message: d.message,
    amountCents: d.amountCents,
    dueDate: d.dueDate ?? null,
    channel: 'whatsapp',
    status: d.status,
    provider: d.provider,
    createdAt: iso(d.createdAt),
  };
}
