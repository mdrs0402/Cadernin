import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { accountSummary, linkInviteSchema, type CustomerAccount, type CustomerReminder, type CustomerTransaction } from '@cadernin/shared';
import { z } from 'zod';
import { db } from '../config/firebase';
import { conflict, notFound } from '../errors';
import { currentUser, requireRole } from '../middleware/auth';
import { invitesCol } from '../services/invites';
import { iso } from '../services/mappers';
import { listCustomerReminders } from '../services/reminders';
import { customersCol, storesCol } from '../services/stores';
import { HISTORY_LIMIT, listCustomerTransactions } from '../services/transactions';

export const customerRouter = Router();
customerRouter.use(requireRole('customer'));

const linksCol = (uid: string) => db.collection('users').doc(uid).collection('links');

/**
 * Contas vinculadas do usuário. Confere o vínculo no próprio cadastro do cliente
 * (userUid === uid): o documento de link sozinho não dá acesso.
 */
type LinkedAccount = Omit<CustomerAccount, 'overdueCents' | 'nextDue' | 'monthPurchasesCents'>;

async function linkedAccounts(uid: string): Promise<LinkedAccount[]> {
  const links = await linksCol(uid).get();
  if (links.empty) return [];

  const customerRefs = links.docs.map((l) => customersCol(l.data().storeId).doc(l.data().customerId));
  const storeRefs = links.docs.map((l) => storesCol().doc(l.data().storeId));
  const [customers, stores] = await Promise.all([db.getAll(...customerRefs), db.getAll(...storeRefs)]);

  const accounts: LinkedAccount[] = [];
  links.docs.forEach((link, i) => {
    const c = customers[i];
    const s = stores[i];
    if (!c?.exists || !s?.exists || c.data()!.userUid !== uid) return;
    accounts.push({
      storeId: s.id,
      storeName: s.data()!.name,
      customerId: c.id,
      name: c.data()!.name,
      creditLimit: c.data()!.creditLimit,
      balanceDue: c.data()!.balanceDue,
      linkedAt: iso(link.data().linkedAt),
    });
  });
  return accounts.sort((a, b) => a.storeName.localeCompare(b.storeName, 'pt-BR'));
}

/** Lojas onde o cliente tem conta: limite, saldo, vencido, próximo vencimento e compras do mês. */
customerRouter.get('/accounts', async (req, res) => {
  const accounts = await linkedAccounts(currentUser(req).uid);
  const histories = await Promise.all(accounts.map((a) => listCustomerTransactions(a.storeId, a.customerId)));
  res.json(accounts.map((a, i) => ({ ...a, ...accountSummary(a, histories[i]!) })));
});

const historyQuery = z.object({
  storeId: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(HISTORY_LIMIT).default(HISTORY_LIMIT),
});

/** Histórico de lançamentos do cliente (todas as lojas, ou só uma com ?storeId=), mais recente primeiro. */
customerRouter.get('/transactions', async (req, res) => {
  const { storeId, limit } = historyQuery.parse(req.query);
  let accounts = await linkedAccounts(currentUser(req).uid);
  if (storeId) {
    accounts = accounts.filter((a) => a.storeId === storeId);
    if (accounts.length === 0) throw notFound('Conta não encontrada.');
  }

  const perStore = await Promise.all(
    accounts.map(async (a) =>
      (await listCustomerTransactions(a.storeId, a.customerId, limit)).map<CustomerTransaction>((t) => ({
        ...t,
        storeId: a.storeId,
        storeName: a.storeName,
      })),
    ),
  );
  const all = perStore.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(all.slice(0, limit));
});

const remindersQuery = z.object({ storeId: z.string().min(1).max(128).optional() });

/** Lembretes que o cliente recebeu (simulação do WhatsApp), mais recente primeiro. */
customerRouter.get('/reminders', async (req, res) => {
  const { storeId } = remindersQuery.parse(req.query);
  let accounts = await linkedAccounts(currentUser(req).uid);
  if (storeId) {
    accounts = accounts.filter((a) => a.storeId === storeId);
    if (accounts.length === 0) throw notFound('Conta não encontrada.');
  }
  const perStore = await Promise.all(
    accounts.map(async (a) =>
      (await listCustomerReminders(a.storeId, a.customerId)).map<CustomerReminder>(({ phone: _phone, provider: _provider, ...r }) => ({
        ...r,
        storeId: a.storeId,
        storeName: a.storeName,
      })),
    ),
  );
  res.json(perStore.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

/** Vincula a conta do usuário ao cadastro feito pelo lojista, usando o código de convite. */
customerRouter.post('/links', async (req, res) => {
  const uid = currentUser(req).uid;
  const { code } = linkInviteSchema.parse(req.body);
  const inviteRef = invitesCol().doc(code);

  const storeId = await db.runTransaction(async (tx) => {
    const invite = await tx.get(inviteRef);
    if (!invite.exists) throw notFound('Código não encontrado. Confira com o lojista.');
    const { storeId, customerId } = invite.data() as { storeId: string; customerId: string };

    const customerRef = customersCol(storeId).doc(customerId);
    const linkRef = linksCol(uid).doc(storeId);
    const [customer, store, existingLink] = await Promise.all([
      tx.get(customerRef),
      tx.get(storesCol().doc(storeId)),
      tx.get(linkRef),
    ]);
    if (!customer.exists || !store.exists) throw notFound('Código não encontrado. Confira com o lojista.');
    if (customer.data()!.userUid) throw conflict('Este código já foi usado.');
    if (existingLink.exists) throw conflict('Você já tem uma conta vinculada nesta loja.');

    tx.update(customerRef, { userUid: uid, inviteCode: null });
    tx.delete(inviteRef);
    tx.create(linkRef, { storeId, customerId, linkedAt: Timestamp.now() });
    return storeId;
  });

  res.status(201).json({ storeId });
});
