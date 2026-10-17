import {
  addDays,
  byDueDate,
  creditUsagePercent,
  dayKeyInZone,
  dueItems,
  monthStart,
  sumOpen,
  type DayTotals,
  type MerchantDashboard,
  type Transaction,
} from '@cadernin/shared';
import { getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { customersCol, toCustomer, toTransaction, transactionsCol } from './refs';
import { myStoreId } from './session';
import { listCustomerTransactions } from './transactions';

const NEAR_LIMIT_PERCENT = 80;
const RECENT_COUNT = 10;

/** Compra/pagamento que conta nos totais (estornados saem). */
const counts = (t: Transaction) => t.type !== 'reversal' && !t.reversedById;

/** Painel do lojista: a receber, vencimentos, movimento do mês e dos últimos 7 dias. */
export async function buildMerchantDashboard(now = new Date()): Promise<MerchantDashboard> {
  const storeId = await myStoreId();
  const today = dayKeyInZone(now);
  const firstDay = [monthStart(today), addDays(today, -6)].sort()[0]!;
  // 1 dia de folga em UTC; o recorte exato é feito pelo dia no fuso da loja
  const since = Timestamp.fromDate(new Date(`${addDays(firstDay, -1)}T00:00:00Z`));

  const [customersSnap, periodSnap, recentSnap] = await Promise.all([
    getDocs(customersCol(storeId)),
    getDocs(query(transactionsCol(storeId), where('createdAt', '>=', since), orderBy('createdAt', 'desc'))),
    getDocs(query(transactionsCol(storeId), orderBy('createdAt', 'desc'), limit(RECENT_COUNT))),
  ]);
  const customers = customersSnap.docs.map(toCustomer);
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const debtors = customers.filter((c) => c.balanceDue > 0);

  // Movimento do mês e dos últimos 7 dias
  const days = new Map<string, DayTotals>();
  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    days.set(day, { day, soldCents: 0, receivedCents: 0 });
  }
  const month = { soldCents: 0, receivedCents: 0, purchases: 0, payments: 0 };
  const mStart = monthStart(today);
  for (const t of periodSnap.docs.map(toTransaction)) {
    if (!counts(t)) continue;
    const day = dayKeyInZone(new Date(t.createdAt));
    const bucket = days.get(day);
    if (t.type === 'purchase') {
      if (bucket) bucket.soldCents += t.amountCents;
      if (day >= mStart && day <= today) {
        month.soldCents += t.amountCents;
        month.purchases++;
      }
    } else {
      if (bucket) bucket.receivedCents += t.amountCents;
      if (day >= mStart && day <= today) {
        month.receivedCents += t.amountCents;
        month.payments++;
      }
    }
  }

  // Vencimentos: só quem deve; o saldo fica nas compras mais recentes
  const histories = await Promise.all(debtors.map((c) => listCustomerTransactions(storeId, c.id)));
  const due = debtors.flatMap((c, i) => dueItems(c, histories[i]!, today));
  const overdue = due.filter((d) => d.status === 'overdue').sort(byDueDate);
  const dueSoon = due.filter((d) => d.status === 'today' || d.status === 'soon').sort(byDueDate);

  return {
    today,
    totals: {
      receivableCents: customers.reduce((s, c) => s + c.balanceDue, 0),
      creditGrantedCents: customers.reduce((s, c) => s + c.creditLimit, 0),
      customers: customers.length,
      debtors: debtors.length,
    },
    month,
    last7Days: [...days.values()],
    overdue,
    overdueCents: sumOpen(overdue),
    dueSoon,
    dueSoonCents: sumOpen(dueSoon),
    nearLimit: customers
      .filter((c) => c.balanceDue > 0 && creditUsagePercent(c.creditLimit, c.balanceDue) >= NEAR_LIMIT_PERCENT)
      .sort((a, b) => creditUsagePercent(b.creditLimit, b.balanceDue) - creditUsagePercent(a.creditLimit, a.balanceDue))
      .map((c) => ({ customerId: c.id, name: c.name, creditLimit: c.creditLimit, balanceDue: c.balanceDue })),
    recent: recentSnap.docs.map(toTransaction).map((t) => ({ ...t, customerName: names.get(t.customerId) ?? 'Cliente removido' })),
  };
}
