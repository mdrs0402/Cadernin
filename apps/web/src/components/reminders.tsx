import type { ReminderKind } from '@cadernin/shared';
import { CheckCheck } from 'lucide-react';
import { formatTime } from '../lib/dates';
import { Badge, cx } from './ui';

const KIND_LABEL: Record<ReminderKind, string> = {
  overdue: 'Vencido',
  due_soon: 'Vence em breve',
  balance: 'Saldo',
};

export function ReminderKindBadge({ kind }: { kind: ReminderKind }) {
  const tone = kind === 'overdue' ? 'danger' : kind === 'due_soon' ? 'accent' : 'neutral';
  return <Badge tone={tone}>{KIND_LABEL[kind]}</Badge>;
}

/** Balão no estilo de conversa de WhatsApp, para a prévia e o histórico dos lembretes. */
export function MessageBubble({ text, at, className }: { text: string; at?: string; className?: string }) {
  return (
    <div className={cx('rounded-2xl bg-[#e7f6df] p-3', className)}>
      <div className="relative max-w-prose rounded-xl rounded-tl-sm bg-white px-3.5 pt-2.5 pb-1.5 text-[14px] leading-relaxed text-ink shadow-sm">
        <p className="whitespace-pre-line">{text}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-stone-400">
          {at && formatTime(new Date(at))}
          <CheckCheck className="size-3.5 text-sky-500" aria-hidden />
        </p>
      </div>
    </div>
  );
}

/** Aviso fixo de que o envio é simulado (fora do escopo do MVP: WhatsApp de verdade). */
export function SimulatedNote({ className }: { className?: string }) {
  return (
    <p className={cx('rounded-xl bg-stone-100 px-3.5 py-2.5 text-xs leading-relaxed text-stone-600', className)}>
      <strong className="font-semibold text-ink">Envio simulado.</strong> Nenhuma mensagem sai de verdade para o WhatsApp
      nesta versão: o lembrete fica registrado e o cliente que usa o app vê na conta dele.
    </p>
  );
}
