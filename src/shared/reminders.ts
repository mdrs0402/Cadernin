import { byDueDate, daysBetween, sumOpen } from './dashboard';
import { formatCents, type Cents } from './money';
import type { DueItem } from './schemas';

/**
 * Lembretes de cobrança (simulados no MVP: nada sai de verdade para o WhatsApp).
 *
 * - overdue:  tem compra vencida em aberto
 * - due_soon: nada vencido, mas algo vence hoje ou nos próximos dias
 * - balance:  só tem saldo, sem vencimento próximo (lembrete manual, nunca sugerido)
 */
export const REMINDER_KINDS = ['overdue', 'due_soon', 'balance'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export type ReminderFacts = {
  kind: ReminderKind;
  /** Valor em destaque na mensagem: o vencido, o que vence ou o saldo. */
  amountCents: Cents;
  /** Vencimento em destaque (o mais antigo vencido ou o próximo a vencer). */
  dueDate: string | null;
};

/** Decide o tipo de lembrete a partir dos vencimentos em aberto do cliente. null = nada a lembrar. */
export function reminderFacts(balanceDue: Cents, due: DueItem[]): ReminderFacts | null {
  if (balanceDue <= 0) return null;
  const overdue = due.filter((d) => d.status === 'overdue').sort(byDueDate);
  if (overdue.length) return { kind: 'overdue', amountCents: sumOpen(overdue), dueDate: overdue[0]!.dueDate };
  const soon = due.filter((d) => d.status === 'today' || d.status === 'soon').sort(byDueDate);
  if (soon.length) {
    // destaca o primeiro vencimento e soma o que vence no mesmo dia
    const first = soon[0]!.dueDate;
    return { kind: 'due_soon', amountCents: sumOpen(soon.filter((d) => d.dueDate === first)), dueDate: first };
  }
  return { kind: 'balance', amountCents: balanceDue, dueDate: null };
}

/** Lembretes sugeridos automaticamente (o "balance" só sai quando o lojista pede). */
export const isSuggestedKind = (kind: ReminderKind) => kind !== 'balance';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "2026-10-19" -> "19/10" */
export function shortDate(ymd: string): string {
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

/** Como o vencimento aparece no texto: "hoje", "amanhã" ou "sexta, 23/10". */
export function dueWhen(dueDate: string, today: string): string {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  const weekday = WEEKDAYS[new Date(`${dueDate}T12:00:00Z`).getUTCDay()]!;
  return `${weekday}, ${shortDate(dueDate)}`;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export type ReminderMessageInput = ReminderFacts & {
  storeName: string;
  customerName: string;
  balanceDue: Cents;
  today: string;
};

/** Texto do lembrete, no tom de quem conhece o cliente. Pensado para caber numa mensagem de WhatsApp. */
export function buildReminderMessage(m: ReminderMessageInput): string {
  const hello = `Olá, ${firstName(m.customerName)}! Aqui é da ${m.storeName}.`;
  const total = `Seu saldo total no caderno é ${formatCents(m.balanceDue)}.`;
  const bye = 'Qualquer dúvida, é só chamar. Obrigado!';

  switch (m.kind) {
    case 'overdue': {
      const when = m.dueDate ? `venceu em ${shortDate(m.dueDate)}` : 'já venceu';
      const tail = m.amountCents < m.balanceDue ? ` ${total}` : '';
      return `${hello} Passando para lembrar que ${formatCents(m.amountCents)} da sua conta ${when}.${tail} Quando puder, passe aqui para acertar. ${bye}`;
    }
    case 'due_soon': {
      const when = m.dueDate ? dueWhen(m.dueDate, m.today) : 'em breve';
      const tail = m.amountCents < m.balanceDue ? ` ${total}` : '';
      return `${hello} Lembrete: ${formatCents(m.amountCents)} da sua conta vence ${when}.${tail} ${bye}`;
    }
    case 'balance':
      return `${hello} Só para você acompanhar: sua conta no caderno está em ${formatCents(m.balanceDue)}. ${bye}`;
  }
}

/** Um lembrete por cliente por dia (no fuso da loja), para não virar spam. */
export const remindedOn = (lastReminderDay: string | null, today: string) => lastReminderDay === today;
