import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NewTransactionInput, ReversalInput, Transaction } from '@cadernin/shared';
import { myTransactions } from '../data/customer';
import { createTransaction, myCustomerTransactions, reverseTransaction } from '../data/transactions';
import { run } from './client';

/* ---------- Lojista ---------- */

export const customerTxKey = (customerId: string) => ['store', 'customers', customerId, 'transactions'] as const;

export function useCustomerTransactions(customerId: string) {
  return useQuery({
    queryKey: customerTxKey(customerId),
    queryFn: () => run(() => myCustomerTransactions(customerId)),
  });
}

function useTxMutation<TVars>(fn: (vars: TVars) => Promise<Transaction>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: TVars) => run(() => fn(vars)),
    // saldo do cliente, lista, histórico e painel mudam juntos
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  });
}

export const useCreateTransaction = (customerId: string) =>
  useTxMutation((input: NewTransactionInput) => createTransaction(customerId, input));

export const useReverseTransaction = (customerId: string) =>
  useTxMutation(({ txId, ...input }: ReversalInput & { txId: string }) => reverseTransaction(customerId, txId, input));

/* ---------- Cliente ---------- */

export function useMyTransactions(storeId?: string) {
  return useQuery({
    queryKey: ['customer', 'transactions', storeId ?? 'all'],
    queryFn: () => run(() => myTransactions(storeId)),
  });
}
