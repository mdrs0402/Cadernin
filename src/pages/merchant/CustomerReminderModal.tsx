import { formatPhone, type Customer } from '@cadernin/shared';
import { Send } from 'lucide-react';
import { useReminders, useSendCustomerReminder } from '../../api/reminders';
import { Modal } from '../../components/Modal';
import { MessageBubble, ReminderKindBadge, SimulatedNote } from '../../components/reminders';
import { useToast } from '../../components/Toast';
import { Button, ErrorState, Skeleton } from '../../components/ui';
import { dayLabel, formatTime } from '../../lib/dates';

/** Prévia e envio (simulado) de um lembrete para um cliente. */
export function CustomerReminderModal({ customer: c, open, onClose }: { customer: Customer; open: boolean; onClose: () => void }) {
  const overview = useReminders();
  const send = useSendCustomerReminder(c.id);
  const toast = useToast();
  const candidate = overview.data?.candidates.find((x) => x.customerId === c.id);

  async function submit() {
    try {
      await send.mutateAsync();
      toast.success(`Lembrete enviado para ${c.name} (simulado).`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Lembrar ${c.name}`}
      description={`WhatsApp para ${formatPhone(c.phone)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={send.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            loading={send.isPending}
            disabled={!candidate || candidate.remindedToday}
            icon={<Send className="size-4" />}
          >
            Enviar lembrete
          </Button>
        </>
      }
    >
      {overview.isPending ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : overview.isError ? (
        <ErrorState message={overview.error.message} onRetry={() => overview.refetch()} />
      ) : !candidate ? (
        <p className="text-sm text-stone-500">Este cliente não está devendo nada, então não há o que lembrar.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <ReminderKindBadge kind={candidate.kind} />
            {candidate.remindedToday && <span className="font-semibold text-brand-700">Já recebeu um lembrete hoje.</span>}
          </div>
          <MessageBubble text={candidate.message} />
          {c.lastReminderAt && (
            <p className="text-xs text-stone-500">
              Último lembrete: {dayLabel(new Date(c.lastReminderAt)).toLowerCase()}, às {formatTime(new Date(c.lastReminderAt))}.
            </p>
          )}
          <SimulatedNote />
        </div>
      )}
    </Modal>
  );
}
