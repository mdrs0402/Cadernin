import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Customer, CustomerInput, CustomerUpdateInput, UpdateStoreInput } from '@cadernin/shared';
import { buildMerchantDashboard } from '../data/dashboard';
import { createCustomer, deleteCustomer, getCustomer, listCustomers, regenerateInvite, updateCustomer, updateStore } from '../data/store';
import { run } from './client';

const keys = {
  customers: ['store', 'customers'] as const,
  customer: (id: string) => ['store', 'customers', id] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: ['store', 'dashboard'], queryFn: () => run(() => buildMerchantDashboard()) });
}

export function useCustomers() {
  return useQuery({ queryKey: keys.customers, queryFn: () => run(listCustomers) });
}

export function useCustomer(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.customer(id),
    queryFn: () => run(() => getCustomer(id)),
    // mostra na hora o que já veio na lista, e atualiza por trás
    placeholderData: () => qc.getQueryData<Customer[]>(keys.customers)?.find((c) => c.id === id),
  });
}

function useCustomerMutation<TVars>(fn: (vars: TVars) => Promise<Customer | void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: TVars) => run(() => fn(vars)),
    onSuccess: (data) => {
      if (data) qc.setQueryData(keys.customer(data.id), data);
      return Promise.all([
        qc.invalidateQueries({ queryKey: keys.customers }),
        qc.invalidateQueries({ queryKey: ['store', 'dashboard'] }),
      ]);
    },
  });
}

export const useCreateCustomer = () => useCustomerMutation((input: CustomerInput) => createCustomer(input));

export const useUpdateCustomer = (id: string) => useCustomerMutation((input: CustomerUpdateInput) => updateCustomer(id, input));

export const useDeleteCustomer = (id: string) => useCustomerMutation(() => deleteCustomer(id));

export const useRegenerateInvite = (id: string) => useCustomerMutation(() => regenerateInvite(id));

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStoreInput) => run(() => updateStore(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
