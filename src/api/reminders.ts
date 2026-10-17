import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Reminder, SendRemindersInput } from '@cadernin/shared';
import { sendRemindersSchema } from '@cadernin/shared';
import { myReminders } from '../data/customer';
import { remindersOverview, sendCustomerReminder, sendReminders } from '../data/reminders';
import { ApiError, notFound, run, unprocessable } from './client';

const remindersKey = ['store', 'reminders'] as const;

/** Candidatos a lembrete de hoje (com prévia) e os últimos enviados. */
export function useReminders() {
  return useQuery({ queryKey: remindersKey, queryFn: () => run(() => remindersOverview()) });
}

export function useSendReminders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendRemindersInput) =>
      run(() => sendReminders(sendRemindersSchema.parse(input ?? {}).customerIds)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  });
}

/** Lembrete para um cliente (inclusive só do saldo, sem vencimento). */
export function useSendCustomerReminder(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      run(async (): Promise<Reminder> => {
        const r = await sendCustomerReminder(customerId);
        if (r === 'not_found') throw notFound('Cliente não encontrado.');
        if (r === 'already_reminded_today') throw new ApiError(409, 'already_reminded_today', 'Este cliente já recebeu um lembrete hoje.');
        if (r === 'nothing_to_remind') throw unprocessable('nothing_to_remind', 'Este cliente não está devendo nada.');
        if (r === 'failed') throw new ApiError(502, 'notification_failed', 'Não foi possível enviar o lembrete. Tente de novo.');
        return r;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  });
}

/** Lembretes que o cliente recebeu (todas as lojas ou uma). */
export function useMyReminders(storeId?: string) {
  return useQuery({
    queryKey: ['customer', 'reminders', storeId ?? 'all'],
    queryFn: () => run(() => myReminders(storeId)),
  });
}
