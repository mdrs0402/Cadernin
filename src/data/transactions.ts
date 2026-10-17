import {
  newTransactionSchema,
  reversalInputSchema,
  type NewTransactionInput,
  type ReversalInput,
  type Transaction,
} from '@cadernin/shared';
import { doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { conflict, notFound, unprocessable } from '../api/client';
import { db } from '../lib/firebase';
import { customerRef, toTransaction, transactionRef, transactionsCol } from './refs';
import { currentUid, myStoreId } from './session';

export const HISTORY_LIMIT = 200;

/** Histórico de um cliente, mais recente primeiro. Usa o índice (customerId, createdAt desc). */
export async function listCustomerTransactions(storeId: string, customerId: string, max = HISTORY_LIMIT) {
  const q = query(transactionsCol(storeId), where('customerId', '==', customerId), orderBy('createdAt', 'desc'), limit(max));
  return (await getDocs(q)).docs.map(toTransaction);
}

/** Histórico de um cliente da loja do lojista logado. */
export async function myCustomerTransactions(customerId: string) {
  const storeId = await myStoreId();
  if (!(await getDoc(customerRef(storeId, customerId))).exists()) throw notFound('Cliente não encontrado.');
  return listCustomerTransactions(storeId, customerId);
}

/**
 * Lança compra ou pagamento. O lançamento e o novo saldo vão na MESMA transação do Firestore:
 * duas compras ao mesmo tempo nunca furam o limite, e as regras conferem a conta.
 */
export async function createTransaction(customerId: string, raw: NewTransactionInput): Promise<Transaction> {
  const storeId = await myStoreId();
  const input = newTransactionSchema.parse(raw);
  const cRef = customerRef(storeId, customerId);
  const txRef = doc(transactionsCol(storeId));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(cRef);
    if (!snap.exists()) throw notFound('Cliente não encontrado.');
    const { balanceDue, creditLimit } = snap.data() as { balanceDue: number; creditLimit: number };

    let next: number;
    if (input.type === 'purchase') {
      next = balanceDue + input.amountCents;
      if (next > creditLimit) {
        throw unprocessable('credit_limit_exceeded', 'Compra recusada: passa do limite de crédito do cliente.');
      }
    } else {
      if (input.amountCents > balanceDue) {
        throw unprocessable('payment_exceeds_balance', 'O pagamento é maior que o saldo devedor.');
      }
      next = balanceDue - input.amountCents;
    }

    tx.set(txRef, {
      customerId,
      type: input.type,
      amountCents: input.amountCents,
      description: input.description,
      dueDate: input.type === 'purchase' ? input.dueDate : null,
      createdAt: serverTimestamp(),
      createdBy: currentUid(),
      reversesId: null,
      reversesType: null,
      reversedById: null,
    });
    tx.update(cRef, { balanceDue: next, lastTxId: txRef.id });
  });

  return toTransaction(await getDoc(txRef));
}

/**
 * Estorna uma compra ou um pagamento. Nada é apagado: cria um lançamento "reversal" e marca o original.
 * Estornar uma compra diminui a dívida; estornar um pagamento a devolve (mesmo acima do limite, é correção).
 */
export async function reverseTransaction(customerId: string, originalId: string, raw: ReversalInput): Promise<Transaction> {
  const storeId = await myStoreId();
  const { reason } = reversalInputSchema.parse(raw ?? {});
  const cRef = customerRef(storeId, customerId);
  const originalRef = transactionRef(storeId, originalId);
  const reversalRef = doc(transactionsCol(storeId));

  await runTransaction(db, async (tx) => {
    const customer = await tx.get(cRef);
    const original = await tx.get(originalRef);
    if (!customer.exists()) throw notFound('Cliente não encontrado.');
    if (!original.exists() || original.data().customerId !== customerId) throw notFound('Lançamento não encontrado.');

    const o = original.data() as Pick<Transaction, 'type' | 'amountCents' | 'description' | 'reversedById'>;
    if (o.type === 'reversal') throw conflict('Um estorno não pode ser estornado.');
    if (o.reversedById) throw conflict('Este lançamento já foi estornado.');

    const balanceDue = customer.data().balanceDue as number;
    const next = o.type === 'purchase' ? balanceDue - o.amountCents : balanceDue + o.amountCents;
    if (next < 0) {
      throw unprocessable('reversal_negative_balance', 'O saldo ficaria negativo. Estorne antes o pagamento feito depois dessa compra.');
    }

    tx.set(reversalRef, {
      customerId,
      type: 'reversal',
      amountCents: o.amountCents,
      description: reason ? `Estorno: ${o.description} (${reason})` : `Estorno: ${o.description}`,
      dueDate: null,
      createdAt: serverTimestamp(),
      createdBy: currentUid(),
      reversesId: originalId,
      reversesType: o.type,
      reversedById: null,
    });
    tx.update(originalRef, { reversedById: reversalRef.id });
    tx.update(cRef, { balanceDue: next, lastTxId: reversalRef.id });
  });

  return toTransaction(await getDoc(reversalRef));
}
