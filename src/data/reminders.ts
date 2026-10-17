import {
  buildReminderMessage,
  dayKeyInZone,
  dueItems,
  isSuggestedKind,
  reminderFacts,
  remindedOn,
  type Reminder,
  type ReminderCandidate,
  type ReminderSkipReason,
  type RemindersOverview,
  type SendRemindersResult,
  type Store,
} from '@cadernin/shared';
import { doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notificationService } from './notifications';
import { customerRef, customersCol, remindersCol, toCustomer, toReminder } from './refs';
import { currentUid, myStore } from './session';
import { listCustomerTransactions } from './transactions';

const RECENT_REMINDERS = 20;

const reminderDay = (isoDate: string | null) => (isoDate ? dayKeyInZone(new Date(isoDate)) : null);

/** Clientes devendo e o lembrete que caberia hoje para cada um (com a prévia do texto). */
export async function reminderCandidates(store: Store, now = new Date()): Promise<ReminderCandidate[]> {
  const today = dayKeyInZone(now);
  const debtors = (await getDocs(query(customersCol(store.id), where('balanceDue', '>', 0)))).docs.map(toCustomer);
  const histories = await Promise.all(debtors.map((c) => listCustomerTransactions(store.id, c.id)));

  const order = { overdue: 0, due_soon: 1, balance: 2 } as const;
  return debtors
    .flatMap((c, i) => {
      const facts = reminderFacts(c.balanceDue, dueItems(c, histories[i]!, today));
      if (!facts) return [];
      return [
        {
          customerId: c.id,
          name: c.name,
          phone: c.phone,
          linked: Boolean(c.userUid),
          balanceDue: c.balanceDue,
          ...facts,
          message: buildReminderMessage({ ...facts, storeName: store.name, customerName: c.name, balanceDue: c.balanceDue, today }),
          suggested: isSuggestedKind(facts.kind),
          lastReminderAt: c.lastReminderAt,
          remindedToday: remindedOn(reminderDay(c.lastReminderAt), today),
        },
      ];
    })
    .sort((a, b) => order[a.kind] - order[b.kind] || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9') || b.amountCents - a.amountCents);
}

export async function remindersOverview(now = new Date()): Promise<RemindersOverview> {
  const store = await myStore();
  const [candidates, recent] = await Promise.all([
    reminderCandidates(store, now),
    getDocs(query(remindersCol(store.id), orderBy('createdAt', 'desc'), limit(RECENT_REMINDERS))),
  ]);
  return { today: dayKeyInZone(now), candidates, recent: recent.docs.map(toReminder) };
}

/**
 * Envia UM lembrete (simulado). Numa transação: confere o limite de 1 lembrete por dia, recalcula o
 * texto com os dados atuais, grava o lembrete e marca lastReminderAt no cliente. As regras do
 * Firestore também impõem o "1 por dia", então nem burlando o app dá para mandar em dobro.
 */
export async function sendReminder(
  store: Store,
  customerId: string,
  { onlySuggested = false, now = new Date() }: { onlySuggested?: boolean; now?: Date } = {},
): Promise<Reminder | ReminderSkipReason> {
  const today = dayKeyInZone(now);
  const cRef = customerRef(store.id, customerId);
  const reminderRef = doc(remindersCol(store.id));
  const history = await listCustomerTransactions(store.id, customerId);

  const prepared = await runTransaction<{ to: string; text: string } | ReminderSkipReason>(db, async (tx) => {
    const snap = await tx.get(cRef);
    if (!snap.exists()) return 'not_found';
    const c = toCustomer(snap);
    if (remindedOn(reminderDay(c.lastReminderAt), today)) return 'already_reminded_today';

    const facts = reminderFacts(c.balanceDue, dueItems(c, history, today));
    if (!facts || (onlySuggested && !isSuggestedKind(facts.kind))) return 'nothing_to_remind';

    const text = buildReminderMessage({ ...facts, storeName: store.name, customerName: c.name, balanceDue: c.balanceDue, today });
    tx.set(reminderRef, {
      customerId,
      customerName: c.name,
      phone: c.phone,
      kind: facts.kind,
      message: text,
      amountCents: facts.amountCents,
      dueDate: facts.dueDate,
      channel: 'whatsapp',
      status: 'simulated',
      provider: notificationService.provider,
      providerMessageId: `sim_${crypto.randomUUID()}`,
      error: null,
      createdAt: serverTimestamp(),
      createdBy: currentUid(),
    });
    tx.update(cRef, { lastReminderAt: serverTimestamp() });
    return { to: c.phone, text };
  }).catch((err: unknown) => {
    // As regras recusam um 2º lembrete no mesmo dia (ex.: outra aba enviou antes).
    if ((err as { code?: string }).code === 'permission-denied') return 'already_reminded_today' as const;
    throw err;
  });
  if (typeof prepared === 'string') return prepared;

  await notificationService.send({
    channel: 'whatsapp',
    to: prepared.to,
    text: prepared.text,
    meta: { storeId: store.id, customerId, reminderId: reminderRef.id },
  });
  return toReminder(await getDoc(reminderRef));
}

/**
 * Envio em lote. Sem `customerIds`: todos os sugeridos (vencido / vence em breve) ainda não lembrados hoje.
 * Com `customerIds`: só esses (aceita também o lembrete de saldo).
 */
export async function sendReminders(customerIds: string[] | undefined, now = new Date()): Promise<SendRemindersResult> {
  const store = await myStore();
  let targets: string[];
  const names = new Map<string, string>();
  if (customerIds) {
    targets = [...new Set(customerIds)];
  } else {
    const candidates = await reminderCandidates(store, now);
    candidates.forEach((c) => names.set(c.customerId, c.name));
    targets = candidates.filter((c) => c.suggested && !c.remindedToday).map((c) => c.customerId);
  }

  const out: SendRemindersResult = { sent: [], skipped: [] };
  // um por vez: poucos clientes por loja, e assim o histórico fica na ordem
  for (const id of targets) {
    const r = await sendReminder(store, id, { onlySuggested: !customerIds, now });
    if (typeof r === 'string') out.skipped.push({ customerId: id, name: names.get(id) ?? null, reason: r });
    else out.sent.push(r);
  }
  return out;
}

/** Lembrete para um cliente da loja do lojista logado. */
export async function sendCustomerReminder(customerId: string) {
  return sendReminder(await myStore(), customerId);
}

/** Lembretes que um cliente recebeu de uma loja (só os efetivamente enviados). */
export async function listCustomerReminders(storeId: string, customerId: string, max = RECENT_REMINDERS) {
  const snap = await getDocs(
    query(remindersCol(storeId), where('customerId', '==', customerId), orderBy('createdAt', 'desc'), limit(max)),
  );
  return snap.docs.map(toReminder).filter((r) => r.status === 'simulated' || r.status === 'sent');
}

