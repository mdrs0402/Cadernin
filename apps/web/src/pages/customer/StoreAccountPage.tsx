import { formatCents } from '@cadernin/shared';
import { ArrowLeft, ReceiptText, Store } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useMyAccounts } from '../../api/customer';
import { useMyTransactions } from '../../api/transactions';
import { AppShell } from '../../components/AppShell';
import { CreditSummary } from '../../components/credit';
import { TransactionList } from '../../components/TransactionList';
import { Card, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { AccountFacts } from './CustomerHomePage';
import { ReceivedReminders } from './ReceivedReminders';

/** Conta do cliente em uma loja: saldo, limite e histórico completo de compras e pagamentos. */
export function StoreAccountPage() {
  const { storeId = '' } = useParams();
  const accounts = useMyAccounts();
  const history = useMyTransactions(storeId);
  const account = accounts.data?.find((a) => a.storeId === storeId);

  const now = new Date();
  const thisMonth = (history.data ?? []).filter((t) => {
    const d = new Date(t.createdAt);
    return t.type === 'purchase' && !t.reversedById && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const boughtThisMonth = thisMonth.reduce((s, t) => s + t.amountCents, 0);

  const back = (
    <Link to="/conta" className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Minhas contas
    </Link>
  );

  if (accounts.isPending)
    return (
      <AppShell>
        <div className="space-y-6">
          {back}
          <Skeleton className="h-48 rounded-[28px]" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </AppShell>
    );

  if (accounts.isError || !account)
    return (
      <AppShell>
        <div className="space-y-6">
          {back}
          <ErrorState
            title={accounts.isError ? undefined : 'Conta não encontrada'}
            message={accounts.isError ? accounts.error.message : 'Você não tem conta vinculada nesta loja.'}
            onRetry={accounts.isError ? () => accounts.refetch() : undefined}
          />
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="space-y-6">
        {back}

        <Card className="animate-fade-up overflow-hidden">
          <div className="flex items-center gap-4 p-6 sm:p-8">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Store className="size-7" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-hand text-xl leading-none text-brand-600">Sua conta em</p>
              <h1 className="truncate text-2xl font-extrabold tracking-tight">{account.storeName}</h1>
            </div>
          </div>
          <div className="border-t border-stone-100 bg-paper/60 px-6 py-5 sm:px-8">
            <CreditSummary creditLimit={account.creditLimit} balanceDue={account.balanceDue} />
          </div>
          <AccountFacts account={account} />
        </Card>

        <ReceivedReminders storeId={storeId} />

        <section className="animate-fade-up [animation-delay:80ms]">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-extrabold tracking-tight">Histórico de compras</h2>
            {history.data && history.data.length > 0 && (
              <p className="text-sm text-stone-500">
                Neste mês: <strong className="text-ink tabular-nums">{formatCents(boughtThisMonth)}</strong> em{' '}
                {thisMonth.length} {thisMonth.length === 1 ? 'compra' : 'compras'}
              </p>
            )}
          </div>

          {history.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          ) : history.isError ? (
            <ErrorState message={history.error.message} onRetry={() => history.refetch()} />
          ) : history.data.length === 0 ? (
            <EmptyState icon={<ReceiptText className="size-7" />} title="Nenhuma compra ainda">
              Quando {account.storeName} anotar uma compra fiada, ela aparece aqui com o que você levou, o valor, o dia e o
              horário.
            </EmptyState>
          ) : (
            <TransactionList transactions={history.data} filterable />
          )}
        </section>
      </div>
    </AppShell>
  );
}
