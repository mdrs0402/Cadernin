import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import {
  customerInputSchema,
  customerUpdateSchema,
  newTransactionSchema,
  reversalInputSchema,
  sendRemindersSchema,
  updateStoreSchema,
} from '@cadernin/shared';
import { z } from 'zod';
import { db } from '../config/firebase';
import { conflict, HttpError, notFound, unprocessable } from '../errors';
import { currentUser, requireRole } from '../middleware/auth';
import { buildMerchantDashboard } from '../services/dashboard';
import { invitesCol, reserveInviteCode } from '../services/invites';
import { toCustomer, toStore } from '../services/mappers';
import { remindersOverview, sendReminder, sendReminders } from '../services/reminders';
import { createTransaction, listCustomerTransactions, reverseTransaction } from '../services/transactions';
import { currentStore, customersCol, loadMerchantStore, storesCol, transactionsCol } from '../services/stores';

export const storeRouter = Router();
storeRouter.use(requireRole('merchant'), loadMerchantStore);

const idParam = z.object({ id: z.string().min(1).max(128) });
const txParam = idParam.extend({ txId: z.string().min(1).max(128) });

async function assertPhoneFree(storeId: string, phone: string, exceptId?: string) {
  const q = await customersCol(storeId).where('phone', '==', phone).limit(2).get();
  if (q.docs.some((d) => d.id !== exceptId)) throw conflict('Já existe um cliente com esse telefone na sua loja.');
}

/* ---------- Loja ---------- */

storeRouter.get('/', (req, res) => {
  res.json(currentStore(req));
});

storeRouter.patch('/', async (req, res) => {
  const { name } = updateStoreSchema.parse(req.body);
  const ref = storesCol().doc(currentStore(req).id);
  await ref.update({ name });
  res.json(toStore(await ref.get()));
});

/** Painel do lojista: a receber, vencimentos, movimento do mês e dos últimos 7 dias. */
storeRouter.get('/dashboard', async (req, res) => {
  res.json(await buildMerchantDashboard(currentStore(req).id));
});

/* ---------- Clientes ---------- */

storeRouter.get('/customers', async (req, res) => {
  const snap = await customersCol(currentStore(req).id).get();
  const list = snap.docs.map(toCustomer).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  res.json(list);
});

storeRouter.post('/customers', async (req, res) => {
  const store = currentStore(req);
  const input = customerInputSchema.parse(req.body);
  await assertPhoneFree(store.id, input.phone);

  const ref = customersCol(store.id).doc();
  const now = Timestamp.now();
  await db.runTransaction(async (tx) => {
    const code = await reserveInviteCode(tx);
    tx.create(ref, { ...input, userUid: null, balanceDue: 0, inviteCode: code, createdAt: now, createdBy: currentUser(req).uid });
    tx.create(invitesCol().doc(code), { storeId: store.id, customerId: ref.id, createdAt: now });
  });

  res.status(201).json(toCustomer(await ref.get()));
});

storeRouter.get('/customers/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const snap = await customersCol(currentStore(req).id).doc(id).get();
  if (!snap.exists) throw notFound('Cliente não encontrado.');
  res.json(toCustomer(snap));
});

storeRouter.patch('/customers/:id', async (req, res) => {
  const store = currentStore(req);
  const { id } = idParam.parse(req.params);
  const input = customerUpdateSchema.parse(req.body);
  const ref = customersCol(store.id).doc(id);

  if (!(await ref.get()).exists) throw notFound('Cliente não encontrado.');
  if (input.phone) await assertPhoneFree(store.id, input.phone, id);

  // balanceDue nunca é editado aqui: só muda via lançamentos (Etapa 3).
  await ref.update(input);
  res.json(toCustomer(await ref.get()));
});

storeRouter.delete('/customers/:id', async (req, res) => {
  const store = currentStore(req);
  const { id } = idParam.parse(req.params);
  const ref = customersCol(store.id).doc(id);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound('Cliente não encontrado.');
    const history = await tx.get(transactionsCol(store.id).where('customerId', '==', id).limit(1));
    if (!history.empty || snap.data()!.balanceDue !== 0) {
      throw conflict('Este cliente já tem lançamentos no caderno e não pode ser excluído.');
    }
    const code = snap.data()!.inviteCode as string | null;
    if (code) tx.delete(invitesCol().doc(code));
    tx.delete(ref);
  });

  res.status(204).end();
});

/** Gera um novo código de convite (invalida o anterior). Só para clientes ainda não vinculados. */
storeRouter.post('/customers/:id/invite', async (req, res) => {
  const store = currentStore(req);
  const { id } = idParam.parse(req.params);
  const ref = customersCol(store.id).doc(id);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound('Cliente não encontrado.');
    if (snap.data()!.userUid) throw conflict('Este cliente já vinculou a conta.');
    const code = await reserveInviteCode(tx);
    const old = snap.data()!.inviteCode as string | null;
    if (old) tx.delete(invitesCol().doc(old));
    tx.create(invitesCol().doc(code), { storeId: store.id, customerId: id, createdAt: Timestamp.now() });
    tx.update(ref, { inviteCode: code });
  });

  res.json(toCustomer(await ref.get()));
});

/* ---------- Lançamentos ---------- */

storeRouter.get('/customers/:id/transactions', async (req, res) => {
  const store = currentStore(req);
  const { id } = idParam.parse(req.params);
  if (!(await customersCol(store.id).doc(id).get()).exists) throw notFound('Cliente não encontrado.');
  res.json(await listCustomerTransactions(store.id, id));
});

storeRouter.post('/customers/:id/transactions', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const input = newTransactionSchema.parse(req.body);
  res.status(201).json(await createTransaction(currentStore(req).id, id, input, currentUser(req).uid));
});

storeRouter.post('/customers/:id/transactions/:txId/reversal', async (req, res) => {
  const { id, txId } = txParam.parse(req.params);
  const { reason } = reversalInputSchema.parse(req.body ?? {});
  res.status(201).json(await reverseTransaction(currentStore(req).id, id, txId, reason, currentUser(req).uid));
});

/* ---------- Lembretes (simulados) ---------- */

/** Quem está devendo, o lembrete que caberia hoje (com prévia do texto) e os últimos enviados. */
storeRouter.get('/reminders', async (req, res) => {
  res.json(await remindersOverview(currentStore(req)));
});

/** Envia os lembretes sugeridos de hoje, ou só para os clientes escolhidos. No máximo 1 por cliente por dia. */
storeRouter.post('/reminders', async (req, res) => {
  const { customerIds } = sendRemindersSchema.parse(req.body ?? {});
  res.json(await sendReminders(currentStore(req), customerIds, currentUser(req).uid));
});

/** Lembrete para um cliente (inclusive só do saldo, sem vencimento). */
storeRouter.post('/customers/:id/reminder', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const r = await sendReminder(currentStore(req), id, currentUser(req).uid);
  if (r === 'not_found') throw notFound('Cliente não encontrado.');
  if (r === 'already_reminded_today') throw new HttpError(409, 'already_reminded_today', 'Este cliente já recebeu um lembrete hoje.');
  if (r === 'nothing_to_remind') throw unprocessable('nothing_to_remind', 'Este cliente não está devendo nada.');
  if (r === 'failed') throw new HttpError(502, 'notification_failed', 'Não foi possível enviar o lembrete. Tente de novo.');
  res.status(201).json(r);
});
