import type { Cents } from './money';
import type { Customer, CustomerAccount, DueItem, Transaction } from './schemas';

/** Fuso usado para "hoje", "este mês" e vencimentos. O MVP atende comércios no Brasil. */
export const STORE_TIME_ZONE = 'America/Sao_Paulo';

/** Quantos dias à frente contam como "vence em breve". */
export const DUE_SOON_DAYS = 7;

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** Dia (AAAA-MM-DD) de um instante no fuso informado. */
export function dayKeyInZone(date: Date, timeZone = STORE_TIME_ZONE): string {
  let f = dayFormatters.get(timeZone);
  if (!f) {
    // en-CA formata como AAAA-MM-DD
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFormatters.set(timeZone, f);
  }
  return f.format(date);
}

/** Soma dias a uma data AAAA-MM-DD (aritmética de calendário, sem fuso). */
export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + days));
  return t.toISOString().slice(0, 10);
}

/** Primeiro dia do mês de uma data AAAA-MM-DD. */
export const monthStart = (dayKey: string) => `${dayKey.slice(0, 7)}-01`;

/** Diferença em dias entre duas datas AAAA-MM-DD (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export type DueStatus = 'overdue' | 'today' | 'soon' | 'later';

export function dueStatus(dueDate: string, today: string, soonDays = DUE_SOON_DAYS): DueStatus {
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  return daysBetween(today, dueDate) <= soonDays ? 'soon' : 'later';
}

type PurchaseLike = { id: string; amountCents: Cents; reversed: boolean };

/**
 * Quanto de cada compra ainda está em aberto.
 *
 * Regra: pagamentos quitam as compras mais antigas primeiro. Então o saldo devedor atual é formado
 * pelas compras MAIS RECENTES — basta distribuir o balanceDue de trás para frente.
 * Compras estornadas não contam. Recebe as compras da mais recente para a mais antiga e devolve só
 * as que têm algum valor em aberto (na mesma ordem).
 */
export function openPurchases<T extends PurchaseLike>(balanceDue: Cents, purchasesNewestFirst: T[]): Array<T & { openCents: Cents }> {
  const out: Array<T & { openCents: Cents }> = [];
  let remaining = Math.max(0, balanceDue);
  for (const p of purchasesNewestFirst) {
    if (remaining <= 0) break;
    if (p.reversed) continue;
    const open = Math.min(p.amountCents, remaining);
    out.push({ ...p, openCents: open });
    remaining -= open;
  }
  return out;
}

/* ---------- Vencimentos de um cliente (puro: usado pela API e pelos testes) ---------- */

/** Compras com vencimento que ainda têm valor em aberto. `history` vem da mais recente para a mais antiga. */
export function dueItems(customer: Pick<Customer, 'id' | 'name' | 'balanceDue'>, history: Transaction[], today: string): DueItem[] {
  const purchases = history
    .filter((t) => t.type === 'purchase')
    .map((t) => ({ ...t, reversed: Boolean(t.reversedById) }));
  return openPurchases(customer.balanceDue, purchases)
    .filter((p) => p.dueDate)
    .map((p) => ({
      purchaseId: p.id,
      customerId: customer.id,
      customerName: customer.name,
      description: p.description,
      dueDate: p.dueDate!,
      openCents: p.openCents,
      status: dueStatus(p.dueDate!, today),
    }));
}

/** Ordem de exibição: vencimento mais antigo primeiro; empate, maior valor primeiro. */
export const byDueDate = (a: DueItem, b: DueItem) => a.dueDate.localeCompare(b.dueDate) || b.openCents - a.openCents;
export const sumOpen = (xs: { openCents: number }[]) => xs.reduce((s, x) => s + x.openCents, 0);

/** Resumo de uma conta para o cliente: vencido, próximo vencimento e compras do mês. */
export function accountSummary(
  account: Pick<CustomerAccount, 'customerId' | 'name' | 'balanceDue'>,
  history: Transaction[],
  now = new Date(),
): Pick<CustomerAccount, 'overdueCents' | 'nextDue' | 'monthPurchasesCents'> {
  const today = dayKeyInZone(now);
  const mStart = monthStart(today);
  const due = dueItems({ id: account.customerId, name: account.name, balanceDue: account.balanceDue }, history, today);
  const next = due.filter((d) => d.status !== 'overdue').sort(byDueDate)[0];
  return {
    overdueCents: sumOpen(due.filter((d) => d.status === 'overdue')),
    nextDue: next ? { dueDate: next.dueDate, openCents: next.openCents } : null,
    monthPurchasesCents: history
      .filter((t) => t.type === 'purchase' && !t.reversedById)
      .filter((t) => {
        const day = dayKeyInZone(new Date(t.createdAt));
        return day >= mStart && day <= today;
      })
      .reduce((s, t) => s + t.amountCents, 0),
  };
}
