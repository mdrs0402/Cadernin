import type { newTransactionSchema, Transaction } from '@cadernin/shared';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import type { z } from 'zod';
import { db } from '../config/firebase';
import { conflict, notFound, unprocessable } from '../errors';
import { toTransaction } from './mappers';
import { customersCol, transactionsCol } from './stores';

type NewTx = z.output<typeof newTransactionSchema>;

export const HISTORY_LIMIT = 200;

/** Histórico de um cliente, mais recente primeiro. Usa o índice (customerId, createdAt desc). */
export async function listCustomerTransactions(storeId: string, customerId: string, limit = HISTORY_LIMIT) {
  const q: Query = transactionsCol(storeId)
    .where('customerId', '==', customerId)
    .orderBy('createdAt', 'desc')
    .limit(limit);
  return (await q.get()).docs.map(toTransaction);
}

/**
 * Lança compra ou pagamento. O lançamento e o novo balanceDue são gravados na MESMA transação do Firestore,
 * então duas compras simultâneas nunca furam o limite.
 */
export async function createTransaction(storeId: string, customerId: string, input: NewTx, uid: string) {
  const customerRef = customersCol(storeId).doc(customerId);
  const txRef = transactionsCol(storeId).doc();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(customerRef);
    if (!snap.exists) throw notFound('Cliente não encontrado.');
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

    tx.create(txRef, {
      customerId,
      type: input.type,
      amountCents: input.amountCents,
      description: input.description,
      dueDate: input.type === 'purchase' ? input.dueDate : null,
      createdAt: Timestamp.now(),
      createdBy: uid,
      reversesId: null,
      reversesType: null,
      reversedById: null,
    });
    tx.update(customerRef, { balanceDue: next });
  });

  return toTransaction(await txRef.get());
}

/**
 * Estorna uma compra ou um pagamento. Nada é apagado: cria um lançamento "reversal" e marca o original.
 * Estornar uma compra diminui a dívida; estornar um pagamento a devolve (mesmo acima do limite, é correção).
 */
export async function reverseTransaction(storeId: string, customerId: string, originalId: string, reason: string | undefined, uid: string) {
  const customerRef = customersCol(storeId).doc(customerId);
  const originalRef = transactionsCol(storeId).doc(originalId);
  const reversalRef = transactionsCol(storeId).doc();

  await db.runTransaction(async (tx) => {
    const [customer, original] = await Promise.all([tx.get(customerRef), tx.get(originalRef)]);
    if (!customer.exists) throw notFound('Cliente não encontrado.');
    if (!original.exists || original.data()!.customerId !== customerId) throw notFound('Lançamento não encontrado.');

    const o = original.data() as Pick<Transaction, 'type' | 'amountCents' | 'description' | 'reversedById'>;
    if (o.type === 'reversal') throw conflict('Um estorno não pode ser estornado.');
    if (o.reversedById) throw conflict('Este lançamento já foi estornado.');

    const balanceDue = customer.data()!.balanceDue as number;
    const next = o.type === 'purchase' ? balanceDue - o.amountCents : balanceDue + o.amountCents;
    if (next < 0) {
      throw unprocessable('reversal_negative_balance', 'O saldo ficaria negativo. Estorne antes o pagamento feito depois dessa compra.');
    }

    tx.create(reversalRef, {
      customerId,
      type: 'reversal',
      amountCents: o.amountCents,
      description: reason ? `Estorno: ${o.description} (${reason})` : `Estorno: ${o.description}`,
      dueDate: null,
      createdAt: Timestamp.now(),
      createdBy: uid,
      reversesId: originalId,
      reversesType: o.type,
      reversedById: null,
    });
    tx.update(originalRef, { reversedById: reversalRef.id });
    tx.update(customerRef, { balanceDue: next });
  });

  return toTransaction(await reversalRef.get());
}
