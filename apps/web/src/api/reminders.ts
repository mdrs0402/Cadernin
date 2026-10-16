import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CustomerReminder, Reminder, RemindersOverview, SendRemindersInput, SendRemindersResult } from '@cadernin/shared';
import { api } from './client';

const remindersKey = ['store', 'reminders'] as const;

/** Candidatos a lembrete de hoje (com prévia) e os últimos enviados. */
export function useReminders() {
  return useQuery({ queryKey: remindersKey, queryFn: () => api<RemindersOverview>('/store/reminders') });
}

export function useSendReminders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendRemindersInput) =>
      api<SendRemindersResult>('/store/reminders', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  });
}

export function useSendCustomerReminder(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Reminder>(`/store/customers/${encodeURIComponent(customerId)}/reminder`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  });
}

/** Lembretes que o cliente recebeu (todas as lojas ou uma). */
export function useMyReminders(storeId?: string) {
  return useQuery({
    queryKey: ['customer', 'reminders', storeId ?? 'all'],
    queryFn: () => api<CustomerReminder[]>(`/customer/reminders${storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''}`),
  });
}
