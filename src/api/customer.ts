import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LinkInviteInput } from '@cadernin/shared';
import { linkInvite, myAccounts } from '../data/customer';
import { run } from './client';

export function useMyAccounts() {
  return useQuery({ queryKey: ['customer', 'accounts'], queryFn: () => run(myAccounts) });
}

export function useLinkInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkInviteInput) => run(() => linkInvite(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer'] }),
  });
}
