import type { Customer, Reminder, Store, Transaction, UserProfile } from '@cadernin/shared';
import type { DocumentSnapshot, Timestamp } from 'firebase-admin/firestore';

export const iso = (t: Timestamp | undefined | null) => (t ? t.toDate().toISOString() : new Date(0).toISOString());

export function toUserProfile(snap: DocumentSnapshot): UserProfile {
  const d = snap.data()!;
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
  const d = snap.data()!;
  return { id: snap.id, name: d.name, ownerUid: d.ownerUid, createdAt: iso(d.createdAt) };
}

export function toCustomer(snap: DocumentSnapshot): Customer {
  const d = snap.data()!;
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
  const d = snap.data()!;
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
  const d = snap.data()!;
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
