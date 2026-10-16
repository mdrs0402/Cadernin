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
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../config/firebase';
import { notificationService, type DeliveryResult, type NotificationService } from '../notifications';
import { toCustomer, toReminder, toTransaction } from './mappers';
import { customersCol, remindersCol, transactionsCol } from './stores';
import { HISTORY_LIMIT, listCustomerTransactions } from './transactions';

const RECENT_REMINDERS = 20;

const reminderDay = (iso: string | null) => (iso ? dayKeyInZone(new Date(iso)) : null);

/** Clientes devendo e o lembrete que caberia hoje para cada um (com a prévia do texto). */
export async function reminderCandidates(store: Store, now = new Date()): Promise<ReminderCandidate[]> {
  const today = dayKeyInZone(now);
  const debtors = (await customersCol(store.id).where('balanceDue', '>', 0).get()).docs.map(toCustomer);
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

export async function remindersOverview(store: Store, now = new Date()): Promise<RemindersOverview> {
  const [candidates, recent] = await Promise.all([
    reminderCandidates(store, now),
    remindersCol(store.id).orderBy('createdAt', 'desc').limit(RECENT_REMINDERS).get(),
  ]);
  return { today: dayKeyInZone(now), candidates, recent: recent.docs.map(toReminder) };
}

type Prepared = { to: string; text: string; previousLastReminderAt: Timestamp | null };

/**
 * Envia UM lembrete. Em duas fases, para não perder nada nem mandar em dobro:
 * 1) transação: confere o limite de 1 lembrete por dia, recalcula o texto com os dados atuais,
 *    grava o lembrete como 'queued' e marca lastReminderAt no cliente;
 * 2) chama o NotificationService e grava o resultado. Se falhar, o cliente volta a poder ser lembrado hoje.
 */
export async function sendReminder(
  store: Store,
  customerId: string,
  uid: string,
  { onlySuggested = false, now = new Date(), service = notificationService() }: { onlySuggested?: boolean; now?: Date; service?: NotificationService } = {},
): Promise<Reminder | ReminderSkipReason> {
  const today = dayKeyInZone(now);
  const customerRef = customersCol(store.id).doc(customerId);
  const reminderRef = remindersCol(store.id).doc();

  const prepared = await db.runTransaction<Prepared | ReminderSkipReason>(async (tx) => {
    const snap = await tx.get(customerRef);
    if (!snap.exists) return 'not_found';
    const c = toCustomer(snap);
    if (remindedOn(reminderDay(c.lastReminderAt), today)) return 'already_reminded_today';

    const historySnap = await tx.get(
      transactionsCol(store.id).where('customerId', '==', customerId).orderBy('createdAt', 'desc').limit(HISTORY_LIMIT),
    );
    const facts = reminderFacts(c.balanceDue, dueItems(c, historySnap.docs.map(toTransaction), today));
    if (!facts || (onlySuggested && !isSuggestedKind(facts.kind))) return 'nothing_to_remind';

    const text = buildReminderMessage({ ...facts, storeName: store.name, customerName: c.name, balanceDue: c.balanceDue, today });
    const createdAt = Timestamp.fromDate(now);
    tx.create(reminderRef, {
      customerId,
      customerName: c.name,
      phone: c.phone,
      kind: facts.kind,
      message: text,
      amountCents: facts.amountCents,
      dueDate: facts.dueDate,
      channel: 'whatsapp',
      status: 'queued',
      provider: service.provider,
      providerMessageId: null,
      error: null,
      createdAt,
      createdBy: uid,
    });
    tx.update(customerRef, { lastReminderAt: createdAt });
    return { to: c.phone, text, previousLastReminderAt: (snap.data()!.lastReminderAt as Timestamp | undefined) ?? null };
  });
  if (typeof prepared === 'string') return prepared;

  let result: DeliveryResult;
  try {
    result = await service.send({
      channel: 'whatsapp',
      to: prepared.to,
      text: prepared.text,
      meta: { storeId: store.id, customerId, reminderId: reminderRef.id },
    });
  } catch (err) {
    result = { status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }

  if (result.status === 'failed') {
    const batch = db.batch();
    batch.update(reminderRef, { status: 'failed', error: result.error.slice(0, 500) });
    batch.update(customerRef, { lastReminderAt: prepared.previousLastReminderAt });
    await batch.commit();
    return 'failed';
  }
  await reminderRef.update({ status: result.status, providerMessageId: result.providerMessageId });
  return toReminder(await reminderRef.get());
}

/**
 * Envio em lote. Sem `customerIds`: todos os sugeridos (vencido / vence em breve) ainda não lembrados hoje.
 * Com `customerIds`: só esses (aceita também o lembrete de saldo).
 */
export async function sendReminders(
  store: Store,
  customerIds: string[] | undefined,
  uid: string,
  opts: { now?: Date; service?: NotificationService } = {},
): Promise<SendRemindersResult> {
  let targets: string[];
  const names = new Map<string, string>();
  if (customerIds) {
    targets = [...new Set(customerIds)];
  } else {
    const candidates = await reminderCandidates(store, opts.now);
    candidates.forEach((c) => names.set(c.customerId, c.name));
    targets = candidates.filter((c) => c.suggested && !c.remindedToday).map((c) => c.customerId);
  }

  const out: SendRemindersResult = { sent: [], skipped: [] };
  // um por vez: poucos clientes por loja, e assim o log fica na ordem
  for (const id of targets) {
    const r = await sendReminder(store, id, uid, { ...opts, onlySuggested: !customerIds });
    if (typeof r === 'string') out.skipped.push({ customerId: id, name: names.get(id) ?? null, reason: r });
    else out.sent.push(r);
  }
  return out;
}

/** Lembretes que um cliente recebeu de uma loja (só os efetivamente enviados). */
export async function listCustomerReminders(storeId: string, customerId: string, limit = RECENT_REMINDERS) {
  const snap = await remindersCol(storeId).where('customerId', '==', customerId).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map(toReminder).filter((r) => r.status === 'simulated' || r.status === 'sent');
}
