import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CustomerTransaction, NewTransactionInput, ReversalInput, Transaction } from '@cadernin/shared';
import { api } from './client';

const enc = encodeURIComponent;

/* ---------- Lojista ---------- */

export const customerTxKey = (customerId: string) => ['store', 'customers', customerId, 'transactions'] as const;

export function useCustomerTransactions(customerId: string) {
  return useQuery({
    queryKey: customerTxKey(customerId),
    queryFn: () => api<Transaction[]>(`/store/customers/${enc(customerId)}/transactions`),
  });
}

function useTxMutation<TVars>(fn: (vars: TVars) => Promise<Transaction>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // saldo do cliente, lista, histórico e painel mudam juntos
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  });
}

export const useCreateTransaction = (customerId: string) =>
  useTxMutation((input: NewTransactionInput) =>
    api<Transaction>(`/store/customers/${enc(customerId)}/transactions`, { method: 'POST', body: JSON.stringify(input) }),
  );

export const useReverseTransaction = (customerId: string) =>
  useTxMutation(({ txId, ...input }: ReversalInput & { txId: string }) =>
    api<Transaction>(`/store/customers/${enc(customerId)}/transactions/${enc(txId)}/reversal`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );

/* ---------- Cliente ---------- */

export function useMyTransactions(storeId?: string) {
  return useQuery({
    queryKey: ['customer', 'transactions', storeId ?? 'all'],
    queryFn: () => api<CustomerTransaction[]>(`/customer/transactions${storeId ? `?storeId=${enc(storeId)}` : ''}`),
  });
}
