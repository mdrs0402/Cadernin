import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CustomerAccount, LinkInviteInput } from '@cadernin/shared';
import { api } from './client';

export function useMyAccounts() {
  return useQuery({ queryKey: ['customer', 'accounts'], queryFn: () => api<CustomerAccount[]>('/customer/accounts') });
}

export function useLinkInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkInviteInput) =>
      api<{ storeId: string }>('/customer/links', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer', 'accounts'] }),
  });
}
