import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProfileInput } from '@cadernin/shared';
import { useAuth } from '../auth/AuthProvider';
import { createProfile, getMe } from '../data/me';
import { run } from './client';

export function useMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['me', user?.uid],
    queryFn: () => run(() => getMe(user!)),
    enabled: Boolean(user),
  });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: CreateProfileInput) => run(() => createProfile(user!, input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
