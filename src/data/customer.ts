import {
  accountSummary,
  linkInviteSchema,
  type CustomerAccount,
  type CustomerReminder,
  type CustomerTransaction,
  type LinkInviteInput,
} from '@cadernin/shared';
import { FirestoreError, getDoc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { conflict, notFound } from '../api/client';
import { db } from '../lib/firebase';
import { customerRef, inviteRef, iso, linkRef, linksCol, storeRef } from './refs';
import { listCustomerReminders } from './reminders';
import { currentUid } from './session';
import { HISTORY_LIMIT, listCustomerTransactions } from './transactions';

type LinkedAccount = Omit<CustomerAccount, 'overdueCents' | 'nextDue' | 'monthPurchasesCents'>;

/**
 * Contas vinculadas do usuário logado. O vínculo vale pelo próprio cadastro do cliente
 * (userUid === uid): um documento de link forjado não abre nada (as regras recusam a leitura).
 */
async function linkedAccounts(): Promise<LinkedAccount[]> {
  const uid = currentUid();
  const links = await getDocs(linksCol(uid));

  const accounts = await Promise.all(
    links.docs.map(async (link): Promise<LinkedAccount | null> => {
      const { storeId, customerId } = link.data() as { storeId: string; customerId: string };
      try {
        const [c, s] = await Promise.all([getDoc(customerRef(storeId, customerId)), getDoc(storeRef(storeId))]);
        if (!c.exists() || !s.exists() || c.data().userUid !== uid) return null;
        return {
          storeId: s.id,
          storeName: s.data().name,
          customerId: c.id,
          name: c.data().name,
          creditLimit: c.data().creditLimit,
          balanceDue: c.data().balanceDue,
          linkedAt: iso(link.data({ serverTimestamps: 'estimate' }).linkedAt),
        };
      } catch (err) {
        if (err instanceof FirestoreError && err.code === 'permission-denied') return null;
        throw err;
      }
    }),
  );
  return accounts.filter((a): a is LinkedAccount => a !== null).sort((a, b) => a.storeName.localeCompare(b.storeName, 'pt-BR'));
}

async function accountsFor(storeId?: string) {
  let accounts = await linkedAccounts();
  if (storeId) {
    accounts = accounts.filter((a) => a.storeId === storeId);
    if (accounts.length === 0) throw notFound('Conta não encontrada.');
  }
  return accounts;
}

/** Lojas onde o cliente tem conta: limite, saldo, vencido, próximo vencimento e compras do mês. */
export async function myAccounts(): Promise<CustomerAccount[]> {
  const accounts = await linkedAccounts();
  const histories = await Promise.all(accounts.map((a) => listCustomerTransactions(a.storeId, a.customerId)));
  return accounts.map((a, i) => ({ ...a, ...accountSummary(a, histories[i]!) }));
}

/** Histórico de lançamentos do cliente (todas as lojas, ou só uma), mais recente primeiro. */
export async function myTransactions(storeId?: string, max = HISTORY_LIMIT): Promise<CustomerTransaction[]> {
  const accounts = await accountsFor(storeId);
  const perStore = await Promise.all(
    accounts.map(async (a) =>
      (await listCustomerTransactions(a.storeId, a.customerId, max)).map<CustomerTransaction>((t) => ({
        ...t,
        storeId: a.storeId,
        storeName: a.storeName,
      })),
    ),
  );
  return perStore
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, max);
}

/** Lembretes que o cliente recebeu (simulação do WhatsApp), mais recente primeiro. */
export async function myReminders(storeId?: string): Promise<CustomerReminder[]> {
  const accounts = await accountsFor(storeId);
  const perStore = await Promise.all(
    accounts.map(async (a) =>
      (await listCustomerReminders(a.storeId, a.customerId)).map<CustomerReminder>(({ phone: _phone, provider: _provider, ...r }) => ({
        ...r,
        storeId: a.storeId,
        storeName: a.storeName,
      })),
    ),
  );
  return perStore.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Vincula a conta do usuário ao cadastro feito pelo lojista, usando o código de convite.
 * Tudo junto: marca o cadastro com o uid, apaga o convite (código de uso único) e cria o link.
 */
export async function linkInvite(raw: LinkInviteInput): Promise<{ storeId: string }> {
  const uid = currentUid();
  const { code } = linkInviteSchema.parse(raw);

  try {
    return await runTransaction(db, async (tx) => {
      const invite = await tx.get(inviteRef(code));
      if (!invite.exists()) throw notFound('Código não encontrado. Confira com o lojista.');
      const { storeId, customerId } = invite.data() as { storeId: string; customerId: string };

      const existing = await tx.get(linkRef(uid, storeId));
      if (existing.exists()) throw conflict('Você já tem uma conta vinculada nesta loja.');

      tx.update(customerRef(storeId, customerId), { userUid: uid, inviteCode: null });
      tx.delete(inviteRef(code));
      tx.set(linkRef(uid, storeId), { storeId, customerId, linkedAt: serverTimestamp() });
      return { storeId };
    });
  } catch (err) {
    if (err instanceof FirestoreError && (err.code === 'permission-denied' || err.code === 'not-found')) {
      throw conflict('Este código já foi usado ou não vale mais. Peça um código novo ao lojista.');
    }
    throw err;
  }
}
