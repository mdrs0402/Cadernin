import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProfileInput, MeResponse } from '@cadernin/shared';
import { useAuth } from '../auth/AuthProvider';
import { auth } from '../lib/firebase';
import { api } from './client';

export function useMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['me', user?.uid],
    queryFn: async () => {
      const me = await api<MeResponse>('/me');
      // O backend regravou o papel nos custom claims: pega um token novo.
      if (me.claimsStale) await auth.currentUser?.getIdToken(true);
      return me;
    },
    enabled: Boolean(user),
  });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProfileInput) => {
      await api('/me/profile', { method: 'POST', body: JSON.stringify(input) });
      // O papel acabou de entrar nos custom claims: força um ID token novo antes das próximas chamadas.
      await auth.currentUser?.getIdToken(true);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
