import { z } from 'zod';
import { isValidInviteCode, normalizeInviteCode } from './invite';
import { MAX_CENTS } from './money';
import { isValidBRPhone, normalizePhone } from './phone';
import type { DueStatus } from './dashboard';
import type { ReminderKind } from './reminders';
import { ROLES, type Role } from './roles';

/* ---------- Primitivos ---------- */

export const centsSchema = z
  .number({ error: 'Informe um valor.' })
  .int('Valor deve ser em centavos inteiros.')
  .min(0, 'Valor não pode ser negativo.')
  .max(MAX_CENTS, 'Valor alto demais.');

const nameSchema = (label: string) =>
  z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(2, `${label[0]!.toUpperCase()}${label.slice(1)} precisa ter pelo menos 2 letras.`)
    .max(80, `${label[0]!.toUpperCase()}${label.slice(1)} pode ter no máximo 80 caracteres.`);

export const phoneSchema = z
  .string({ error: 'Informe o telefone.' })
  .transform(normalizePhone)
  .refine(isValidBRPhone, 'Telefone inválido. Use DDD + número, ex.: (11) 98765-4321.');

export const inviteCodeSchema = z
  .string({ error: 'Informe o código.' })
  .transform(normalizeInviteCode)
  .refine(isValidInviteCode, 'Código inválido. Ele tem 6 letras/números, ex.: K7M-Q2P.');

/* ---------- Entradas da API ---------- */

export const createProfileSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('merchant'), storeName: nameSchema('o nome da loja') }),
  z.object({ role: z.literal('customer') }),
]);
export type CreateProfileInput = z.input<typeof createProfileSchema>;

export const updateStoreSchema = z.object({ name: nameSchema('o nome da loja') });
export type UpdateStoreInput = z.input<typeof updateStoreSchema>;

export const customerInputSchema = z.object({
  name: nameSchema('o nome'),
  phone: phoneSchema,
  creditLimit: centsSchema,
});
export type CustomerInput = z.input<typeof customerInputSchema>;

export const customerUpdateSchema = customerInputSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Nada para atualizar.',
});
export type CustomerUpdateInput = z.input<typeof customerUpdateSchema>;

export const linkInviteSchema = z.object({ code: inviteCodeSchema });
export type LinkInviteInput = z.input<typeof linkInviteSchema>;

/* ---------- Lançamentos ---------- */

export const TRANSACTION_TYPES = ['purchase', 'payment', 'reversal'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

const positiveCents = centsSchema.min(1, 'Informe um valor maior que zero.');

const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento inválida.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Data de vencimento inválida.')
  .nullish()
  .transform((v) => v ?? null);

/** Compra fiada ou pagamento. Estorno tem rota própria (sempre aponta para um lançamento existente). */
export const newTransactionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('purchase'),
    amountCents: positiveCents,
    description: z
      .string({ error: 'Diga o que foi comprado.' })
      .trim()
      .min(2, 'Diga o que foi comprado.')
      .max(200, 'A descrição pode ter no máximo 200 caracteres.'),
    dueDate: dueDateSchema,
  }),
  z.object({
    type: z.literal('payment'),
    amountCents: positiveCents,
    description: z
      .string()
      .trim()
      .max(200, 'A observação pode ter no máximo 200 caracteres.')
      .optional()
      .transform((v) => v || 'Pagamento'),
  }),
]);
export type NewTransactionInput = z.input<typeof newTransactionSchema>;

export const reversalInputSchema = z.object({
  reason: z.string().trim().max(200, 'O motivo pode ter no máximo 200 caracteres.').optional(),
});
export type ReversalInput = z.input<typeof reversalInputSchema>;

/* ---------- Lembretes ---------- */

/** Sem customerIds = todos os lembretes sugeridos de hoje. */
export const sendRemindersSchema = z.object({
  customerIds: z.array(z.string().min(1).max(128)).min(1, 'Escolha pelo menos um cliente.').max(500).optional(),
});
export type SendRemindersInput = z.input<typeof sendRemindersSchema>;

/* ---------- Saídas da API (datas como ISO string, dinheiro em centavos) ---------- */

export type UserProfile = {
  uid: string;
  name: string;
  email: string | null;
  photoURL: string | null;
  role: Role;
  createdAt: string;
};

export type Store = {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  /** uid do usuário vinculado (null até o cliente usar o código de convite). */
  userUid: string | null;
  /** centavos */
  creditLimit: number;
  /** centavos */
  balanceDue: number;
  /** Só aparece para o lojista e enquanto o cliente não vinculou a conta. */
  inviteCode: string | null;
  /** Último lembrete enviado (ISO) ou null. */
  lastReminderAt: string | null;
  createdAt: string;
};

/** Visão do cliente: uma loja onde ele tem conta. */
export type CustomerAccount = {
  storeId: string;
  storeName: string;
  customerId: string;
  name: string;
  creditLimit: number;
  balanceDue: number;
  linkedAt: string;
  /** Soma das compras vencidas ainda em aberto. */
  overdueCents: number;
  /** Próximo vencimento (de hoje em diante) ainda em aberto. */
  nextDue: { dueDate: string; openCents: number } | null;
  /** Compras do mês corrente (sem estornadas). */
  monthPurchasesCents: number;
};

export type Transaction = {
  id: string;
  customerId: string;
  type: TransactionType;
  /** centavos, sempre positivo; o tipo diz se aumenta ou diminui a dívida */
  amountCents: number;
  description: string;
  /** 'AAAA-MM-DD' (só compras) */
  dueDate: string | null;
  createdAt: string;
  /** Em um estorno: o lançamento estornado. */
  reversesId: string | null;
  /** Em uma compra/pagamento estornado: o id do estorno. */
  reversedById: string | null;
  /** Tipo do lançamento original (só em estornos). */
  reversesType: 'purchase' | 'payment' | null;
};

/** Lançamento visto pelo cliente, com a loja (para o histórico que junta várias lojas). */
export type CustomerTransaction = Transaction & { storeId: string; storeName: string };

/** Uma compra com vencimento e valor ainda em aberto. */
export type DueItem = {
  purchaseId: string;
  customerId: string;
  customerName: string;
  description: string;
  dueDate: string;
  openCents: number;
  status: DueStatus;
};

export type DayTotals = { day: string; soldCents: number; receivedCents: number };

/** GET /store/dashboard */
export type MerchantDashboard = {
  /** Hoje no fuso da loja (AAAA-MM-DD). */
  today: string;
  totals: { receivableCents: number; creditGrantedCents: number; customers: number; debtors: number };
  /** Mês corrente: vendido fiado (sem estornos) e recebido. */
  month: { soldCents: number; receivedCents: number; purchases: number; payments: number };
  /** Últimos 7 dias, do mais antigo para hoje. */
  last7Days: DayTotals[];
  overdue: DueItem[];
  overdueCents: number;
  /** Vence hoje ou nos próximos dias. */
  dueSoon: DueItem[];
  dueSoonCents: number;
  /** Clientes com 80% ou mais do limite em uso. */
  nearLimit: Array<{ customerId: string; name: string; creditLimit: number; balanceDue: number }>;
  recent: Array<Transaction & { customerName: string }>;
};

/** 'simulated' = o NotificationService simulado "enviou" (só registrou). 'queued' = gravado, envio em andamento. */
export type ReminderStatus = 'queued' | 'simulated' | 'sent' | 'failed';

export type Reminder = {
  id: string;
  customerId: string;
  customerName: string;
  /** Telefone de destino (só dígitos). */
  phone: string;
  kind: ReminderKind;
  message: string;
  amountCents: number;
  dueDate: string | null;
  channel: 'whatsapp';
  status: ReminderStatus;
  /** Nome do provedor que fez o envio ('simulado' no MVP). */
  provider: string;
  createdAt: string;
};

/** Lembrete visto pelo cliente. */
export type CustomerReminder = Omit<Reminder, 'phone' | 'provider'> & { storeId: string; storeName: string };

/** Um cliente devendo e o lembrete que caberia para ele hoje. */
export type ReminderCandidate = {
  customerId: string;
  name: string;
  phone: string;
  /** Cliente já usa o app (vê o lembrete na conta dele). */
  linked: boolean;
  balanceDue: number;
  kind: ReminderKind;
  amountCents: number;
  dueDate: string | null;
  /** Prévia do texto que seria enviado. */
  message: string;
  /** true para vencido / vence em breve (entram no "enviar todos"). */
  suggested: boolean;
  lastReminderAt: string | null;
  remindedToday: boolean;
};

/** GET /store/reminders */
export type RemindersOverview = { today: string; candidates: ReminderCandidate[]; recent: Reminder[] };

export type ReminderSkipReason = 'already_reminded_today' | 'nothing_to_remind' | 'not_found' | 'failed';

/** POST /store/reminders */
export type SendRemindersResult = {
  sent: Reminder[];
  skipped: Array<{ customerId: string; name: string | null; reason: ReminderSkipReason }>;
};

/** Identidade (Firebase Auth) + perfil (null no primeiro login) e loja do lojista. */
export type MeResponse = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  profile: UserProfile | null;
  /** Loja do lojista (null para cliente ou sem perfil). */
  store: Store | null;
};
