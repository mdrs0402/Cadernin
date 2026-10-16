import { formatCents, formatPhone, type ReminderCandidate, type ReminderSkipReason } from '@cadernin/shared';
import { BellRing, CalendarCheck2, Check, ChevronDown, Send, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useReminders, useSendReminders } from '../../api/reminders';
import { MessageBubble, ReminderKindBadge, SimulatedNote } from '../../components/reminders';
import { useToast } from '../../components/Toast';
import { Avatar, Badge, Button, Card, cx, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { dayLabel, formatDateOnly, formatTime } from '../../lib/dates';

const SKIP_LABEL: Record<ReminderSkipReason, string> = {
  already_reminded_today: 'já lembrado hoje',
  nothing_to_remind: 'não deve mais nada',
  not_found: 'cliente não encontrado',
  failed: 'falha no envio',
};

export function RemindersPage() {
  const q = useReminders();
  const send = useSendReminders();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);

  const candidates = q.data?.candidates ?? [];
  const available = useMemo(() => candidates.filter((c) => !c.remindedToday), [candidates]);

  // pré-seleciona os sugeridos (vencido / vence em breve) até o lojista mexer na seleção
  useEffect(() => {
    if (!touched) setSelected(new Set(available.filter((c) => c.suggested).map((c) => c.customerId)));
  }, [available, touched]);

  function toggle(id: string) {
    setTouched(true);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    try {
      const r = await send.mutateAsync({ customerIds: [...selected] });
      const n = r.sent.length;
      if (n) toast.success(n === 1 ? '1 lembrete enviado (simulado).' : `${n} lembretes enviados (simulados).`);
      if (r.skipped.length) {
        const first = r.skipped[0]!;
        toast.error(
          `${r.skipped.length} não ${r.skipped.length === 1 ? 'foi enviado' : 'foram enviados'}: ${first.name ?? 'cliente'} — ${SKIP_LABEL[first.reason]}.`,
        );
      }
      setTouched(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar.');
    }
  }

  const groups = [
    { title: 'Vencidos', items: candidates.filter((c) => c.kind === 'overdue') },
    { title: 'Vencem em breve', items: candidates.filter((c) => c.kind === 'due_soon') },
    { title: 'Só com saldo', hint: 'sem vencimento próximo', items: candidates.filter((c) => c.kind === 'balance') },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8 pb-24 sm:pb-0">
      <header className="animate-fade-up">
        <p className="font-hand text-2xl leading-none text-brand-600">Cobrança gentil</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Lembretes</h1>
        <p className="mt-2 max-w-prose text-stone-500">
          Avise quem tem conta vencida ou vencendo. Cada cliente recebe no máximo um lembrete por dia.
        </p>
        <SimulatedNote className="mt-4 max-w-prose" />
      </header>

      {q.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <section className="animate-fade-up space-y-6 [animation-delay:60ms]">
            {candidates.length === 0 ? (
              <EmptyState icon={<CalendarCheck2 className="size-7" />} title="Ninguém para lembrar">
                Nenhum cliente está devendo agora. Quando alguém tiver conta vencida ou perto de vencer, aparece aqui.
              </EmptyState>
            ) : (
              groups.map((g) => (
                <div key={g.title}>
                  <h2 className="mb-3 flex items-baseline gap-2 text-lg font-extrabold tracking-tight">
                    {g.title} <span className="text-sm font-semibold text-stone-400">{g.items.length}</span>
                    {g.hint && <span className="text-sm font-medium text-stone-400">· {g.hint}</span>}
                  </h2>
                  <ul className="space-y-3">
                    {g.items.map((c) => (
                      <CandidateRow
                        key={c.customerId}
                        candidate={c}
                        checked={selected.has(c.customerId)}
                        onToggle={() => toggle(c.customerId)}
                      />
                    ))}
                  </ul>
                </div>
              ))
            )}

          </section>

          <aside className="animate-fade-up [animation-delay:120ms]">
            <h2 className="mb-3 text-lg font-extrabold tracking-tight">Enviados recentemente</h2>
            {q.data.recent.length === 0 ? (
              <EmptyState icon={<BellRing className="size-7" />} title="Nenhum lembrete ainda">
                Os lembretes enviados ficam registrados aqui.
              </EmptyState>
            ) : (
              <Card className="divide-y divide-stone-100">
                {q.data.recent.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 px-4 py-3.5">
                    <Avatar name={r.customerName} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate font-semibold">{r.customerName}</p>
                        <ReminderKindBadge kind={r.kind} />
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {dayLabel(new Date(r.createdAt))}, {formatTime(new Date(r.createdAt))} · {formatCents(r.amountCents)} ·{' '}
                        {r.status === 'failed' ? <span className="font-semibold text-red-600">falhou</span> : 'simulado'}
                      </p>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </aside>
        </div>
      )}

      {/* fora das seções animadas: transform no pai prenderia o position:fixed */}
      {available.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 sm:sticky sm:bottom-6 sm:px-0">
          <Card className="mx-auto flex max-w-md items-center justify-between gap-3 p-3 shadow-lift sm:max-w-none sm:shadow-card">
            <p className="pl-1 text-sm text-stone-600">
              <strong className="text-ink">{selected.size}</strong> de {available.length}{' '}
              {available.length === 1 ? 'selecionado' : 'selecionados'}
            </p>
            <Button
            onClick={submit}
            loading={send.isPending}
            disabled={selected.size === 0}
            icon={<Send className="size-4" />}
            className="shrink-0 whitespace-nowrap"
          >
              Enviar {selected.size === 1 ? 'lembrete' : 'lembretes'}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

function CandidateRow({ candidate: c, checked, onToggle }: { candidate: ReminderCandidate; checked: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const disabled = c.remindedToday;
  return (
    <li>
      <Card className={cx('overflow-hidden transition', checked && 'ring-2 ring-brand-500/60', disabled && 'opacity-70')}>
        <div className="flex items-center gap-3 p-4">
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`Enviar lembrete para ${c.name}`}
            disabled={disabled}
            onClick={onToggle}
            className={cx(
              'grid size-7 shrink-0 place-items-center rounded-lg border-2 transition',
              checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white',
              disabled && 'cursor-not-allowed border-stone-200 bg-stone-100',
            )}
          >
            {checked && <Check className="size-4" strokeWidth={3} aria-hidden />}
          </button>
          <Link to={`/loja/clientes/${encodeURIComponent(c.customerId)}`} className="min-w-0 flex-1">
            <p className="truncate font-bold hover:underline">{c.name}</p>
            <p className="truncate text-xs text-stone-500">
              {formatPhone(c.phone)}
              {c.dueDate && ` · ${c.kind === 'overdue' ? 'venceu' : 'vence'} ${formatDateOnly(c.dueDate)}`}
            </p>
          </Link>
          <div className="shrink-0 text-right">
            <p className="font-extrabold whitespace-nowrap tabular-nums">{formatCents(c.amountCents)}</p>
            <div className="mt-1 flex justify-end">
              {disabled ? <Badge tone="brand">Lembrado hoje</Badge> : <ReminderKindBadge kind={c.kind} />}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between border-t border-stone-100 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50/50"
        >
          <span className="inline-flex items-center gap-1.5">
            <Smartphone className="size-4" aria-hidden />
            {open ? 'Esconder mensagem' : 'Ver mensagem'}
            {c.linked && <span className="font-medium text-stone-400">· usa o app</span>}
          </span>
          <ChevronDown className={cx('size-4 transition', open && 'rotate-180')} aria-hidden />
        </button>
        {open && <MessageBubble text={c.message} className="mx-4 mb-4" />}
      </Card>
    </li>
  );
}
