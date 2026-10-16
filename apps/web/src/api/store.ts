import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Customer, CustomerInput, CustomerUpdateInput, MerchantDashboard, Store, UpdateStoreInput } from '@cadernin/shared';
import { api } from './client';

const keys = {
  customers: ['store', 'customers'] as const,
  customer: (id: string) => ['store', 'customers', id] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: ['store', 'dashboard'], queryFn: () => api<MerchantDashboard>('/store/dashboard') });
}

export function useCustomers() {
  return useQuery({ queryKey: keys.customers, queryFn: () => api<Customer[]>('/store/customers') });
}

export function useCustomer(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.customer(id),
    queryFn: () => api<Customer>(`/store/customers/${encodeURIComponent(id)}`),
    // mostra na hora o que já veio na lista, e atualiza por trás
    placeholderData: () => qc.getQueryData<Customer[]>(keys.customers)?.find((c) => c.id === id),
  });
}

function useCustomerMutation<TVars>(fn: (vars: TVars) => Promise<Customer | void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      if (data) qc.setQueryData(keys.customer(data.id), data);
      return Promise.all([
        qc.invalidateQueries({ queryKey: keys.customers }),
        qc.invalidateQueries({ queryKey: ['store', 'dashboard'] }),
      ]);
    },
  });
}

export const useCreateCustomer = () =>
  useCustomerMutation((input: CustomerInput) =>
    api<Customer>('/store/customers', { method: 'POST', body: JSON.stringify(input) }),
  );

export const useUpdateCustomer = (id: string) =>
  useCustomerMutation((input: CustomerUpdateInput) =>
    api<Customer>(`/store/customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  );

export const useDeleteCustomer = (id: string) =>
  useCustomerMutation(() => api<void>(`/store/customers/${encodeURIComponent(id)}`, { method: 'DELETE' }));

export const useRegenerateInvite = (id: string) =>
  useCustomerMutation(() => api<Customer>(`/store/customers/${encodeURIComponent(id)}/invite`, { method: 'POST' }));

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStoreInput) => api<Store>('/store', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
