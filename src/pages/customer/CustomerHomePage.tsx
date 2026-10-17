import { formatCents, formatInviteCode, INVITE_LENGTH, linkInviteSchema, normalizeInviteCode, availableCredit, type CustomerAccount } from '@cadernin/shared';
import { AlertTriangle, ArrowRight, CalendarClock, KeyRound, Plus, ReceiptText, Store } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useLinkInvite, useMyAccounts } from '../../api/customer';
import { useMyTransactions } from '../../api/transactions';
import { AppShell } from '../../components/AppShell';
import { CreditBar } from '../../components/credit';
import { Field, TextInput } from '../../components/forms';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { TransactionList } from '../../components/TransactionList';
import { Button, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { formatDateOnly } from '../../lib/dates';
import { useMeContext } from '../../routes/guards';
import { ReceivedReminders } from './ReceivedReminders';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function CustomerHomePage() {
  const me = useMeContext();
  const accounts = useMyAccounts();
  const [linking, setLinking] = useState(false);
  const list = accounts.data ?? [];
  const totalDue = list.reduce((s, a) => s + a.balanceDue, 0);
  const overdue = list.filter((a) => a.overdueCents > 0);

  return (
    <AppShell>
      <div className="space-y-8">
        <section className="relative isolate animate-fade-up overflow-hidden rounded-[28px] bg-brand-900 px-6 py-8 text-white shadow-lift sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div className="absolute -top-24 -right-16 size-80 rounded-full bg-brand-500/40 blur-3xl" />
            <div className="absolute inset-0 bg-ruled opacity-30" />
          </div>
          <p className="font-hand text-2xl text-accent-300">{greeting()},</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{me.name?.split(' ')[0] ?? 'tudo bem'}!</h1>
          {list.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-bold tracking-widest text-brand-200/80 uppercase">Você deve no total</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">{formatCents(totalDue)}</p>
            </div>
          )}
          {accounts.data && list.length === 0 && (
            <p className="mt-2 max-w-md text-brand-100/80">Vincule sua conta com o código que o lojista te enviou.</p>
          )}
        </section>

        {overdue.length > 0 && (
          <div role="alert" className="flex animate-fade-up gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
            <div className="text-sm">
              <p className="font-bold">Você tem compras vencidas</p>
              <p className="mt-0.5 text-red-800/80">
                {overdue.map((a, i) => (
                  <span key={a.storeId}>
                    {i > 0 && (i === overdue.length - 1 ? ' e ' : ', ')}
                    <strong className="tabular-nums">{formatCents(a.overdueCents)}</strong> em {a.storeName}
                  </span>
                ))}
                . Combine o pagamento com a loja.
              </p>
            </div>
          </div>
        )}

        {accounts.isPending && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </div>
        )}
        {accounts.isError && <ErrorState message={accounts.error.message} onRetry={() => accounts.refetch()} />}

        {accounts.data && list.length === 0 && (
          <Card className="mx-auto max-w-lg animate-fade-up p-6 sm:p-8">
            <span className="grid size-12 place-items-center rounded-2xl bg-accent-100 text-accent-600">
              <KeyRound className="size-6" aria-hidden />
            </span>
            <h2 className="mt-4 text-xl font-extrabold tracking-tight">Tem um código de convite?</h2>
            <p className="mt-1 text-sm text-stone-500">
              Peça ao seu mercadinho, padaria ou venda o código de 6 caracteres. Com ele você vê o que deve e quanto
              ainda pode comprar.
            </p>
            <div className="mt-6">
              <LinkForm />
            </div>
          </Card>
        )}

        {list.length > 0 && (
          <section className="animate-fade-up [animation-delay:80ms]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight">Suas contas</h2>
              <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => setLinking(true)}>
                Outra loja
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {list.map((a) => (
                <AccountCard key={a.storeId} account={a} />
              ))}
            </div>
          </section>
        )}

        {list.length > 0 && <ReceivedReminders showStore={list.length > 1} />}

        {list.length > 0 && <RecentHistory multiStore={list.length > 1} />}
      </div>

      <Modal open={linking} onClose={() => setLinking(false)} title="Vincular outra loja" description="Digite o código que o lojista te enviou.">
        <LinkForm onLinked={() => setLinking(false)} />
      </Modal>
    </AppShell>
  );
}

function AccountCard({ account: a }: { account: CustomerAccount }) {
  return (
    <Link
      to={`/conta/lojas/${encodeURIComponent(a.storeId)}`}
      className="group block overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <Store className="size-5" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate font-bold">{a.storeName}</p>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700">
          <span className="hidden sm:inline">Ver compras</span> <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
      <div className="px-5 py-5">
        <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">Saldo devedor</p>
        <p className={`mt-0.5 text-3xl font-extrabold tabular-nums ${a.balanceDue > 0 ? 'text-red-600' : 'text-ink'}`}>
          {formatCents(a.balanceDue)}
        </p>
        <CreditBar creditLimit={a.creditLimit} balanceDue={a.balanceDue} className="mt-4" />
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-stone-500">
            Disponível <strong className="text-brand-700 tabular-nums">{formatCents(availableCredit(a.creditLimit, a.balanceDue))}</strong>
          </span>
          <span className="text-stone-500 tabular-nums">Limite {formatCents(a.creditLimit)}</span>
        </div>
      </div>
      <AccountFacts account={a} />
    </Link>
  );
}

/** Vencido, próximo vencimento e compras do mês (usado no cartão e na página da loja). */
export function AccountFacts({ account: a }: { account: CustomerAccount }) {
  return (
    <dl className="grid grid-cols-2 gap-px border-t border-stone-100 bg-stone-100 text-sm">
      <div className="bg-white px-5 py-3">
        <dt className="text-xs text-stone-500">Compras neste mês</dt>
        <dd className="font-bold tabular-nums">{formatCents(a.monthPurchasesCents)}</dd>
      </div>
      <div className="bg-white px-5 py-3">
        {a.overdueCents > 0 ? (
          <>
            <dt className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
              <AlertTriangle className="size-3" aria-hidden /> Vencido
            </dt>
            <dd className="font-bold text-red-600 tabular-nums">{formatCents(a.overdueCents)}</dd>
          </>
        ) : a.nextDue ? (
          <>
            <dt className="inline-flex items-center gap-1 text-xs text-stone-500">
              <CalendarClock className="size-3" aria-hidden /> Próximo vencimento
            </dt>
            <dd className="font-bold tabular-nums">
              {formatDateOnly(a.nextDue.dueDate)} · {formatCents(a.nextDue.openCents)}
            </dd>
          </>
        ) : (
          <>
            <dt className="text-xs text-stone-500">Vencimentos</dt>
            <dd className="font-bold text-brand-700">Nada a vencer</dd>
          </>
        )}
      </div>
      {a.overdueCents > 0 && a.nextDue && (
        <div className="col-span-2 flex items-center justify-between gap-3 bg-white px-5 py-3">
          <dt className="inline-flex items-center gap-1 text-xs text-stone-500">
            <CalendarClock className="size-3" aria-hidden /> Próximo vencimento
          </dt>
          <dd className="font-bold tabular-nums">
            {formatDateOnly(a.nextDue.dueDate)} · {formatCents(a.nextDue.openCents)}
          </dd>
        </div>
      )}
    </dl>
  );
}

const RECENT = 8;

/** Últimas compras e pagamentos, de todas as lojas. */
function RecentHistory({ multiStore }: { multiStore: boolean }) {
  const history = useMyTransactions();
  const items = history.data ?? [];

  return (
    <section className="animate-fade-up [animation-delay:140ms]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold tracking-tight">Histórico de compras</h2>
        {!multiStore && items[0] && items.length > RECENT && (
          <Link
            to={`/conta/lojas/${encodeURIComponent(items[0].storeId)}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
          >
            Ver tudo <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {history.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : history.isError ? (
        <ErrorState message={history.error.message} onRetry={() => history.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<ReceiptText className="size-7" />} title="Nenhuma compra ainda">
          Quando o lojista anotar uma compra fiada, ela aparece aqui com o que você levou, o valor, o dia e o horário.
        </EmptyState>
      ) : (
        <>
          <TransactionList transactions={items.slice(0, RECENT)} showStore={multiStore} />
          {multiStore && items.length > RECENT && (
            <p className="mt-3 text-center text-sm text-stone-500">Toque numa loja acima para ver o histórico completo.</p>
          )}
        </>
      )}
    </section>
  );
}

function LinkForm({ onLinked }: { onLinked?: () => void }) {
  const toast = useToast();
  const link = useLinkInvite();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = linkInviteSchema.safeParse({ code });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Código inválido.');
    setError(null);
    link.mutate(parsed.data, {
      onSuccess: () => {
        toast.success('Conta vinculada!');
        setCode('');
        onLinked?.();
      },
      onError: (err) => setError(err.message),
    });
  }

  const raw = normalizeInviteCode(code).slice(0, INVITE_LENGTH);

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Código de convite" error={error}>
        {(p) => (
          <TextInput
            {...p}
            value={raw.length > 3 ? formatInviteCode(raw.padEnd(INVITE_LENGTH, ' ')).trimEnd() : raw}
            onChange={(e) => setCode(e.target.value)}
            placeholder="K7M-Q2P"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            spellCheck={false}
            className="text-center font-mono text-2xl font-bold tracking-[0.3em] uppercase"
          />
        )}
      </Field>
      <Button type="submit" className="w-full" loading={link.isPending} disabled={raw.length < INVITE_LENGTH}>
        Vincular conta
      </Button>
    </form>
  );
}
