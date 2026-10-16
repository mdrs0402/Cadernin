import { formatCents, formatInviteCode, formatPhone, type Transaction } from '@cadernin/shared';
import { ArrowLeft, BellRing, Copy, HandCoins, Link2, NotebookPen, Pencil, Phone, RefreshCw, Share2, ShoppingBasket, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useCustomer, useDeleteCustomer, useRegenerateInvite } from '../../api/store';
import { useCustomerTransactions, useReverseTransaction } from '../../api/transactions';
import { CreditSummary } from '../../components/credit';
import { ConfirmDialog } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { TransactionList } from '../../components/TransactionList';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { useMeContext } from '../../routes/guards';
import { CustomerFormModal } from './CustomerFormModal';
import { CustomerReminderModal } from './CustomerReminderModal';
import { TransactionFormModal, type TxKind } from './TransactionFormModal';

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const me = useMeContext();
  const navigate = useNavigate();
  const toast = useToast();
  const customer = useCustomer(id);
  const del = useDeleteCustomer(id);
  const regen = useRegenerateInvite(id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const transactions = useCustomerTransactions(id);
  const reverse = useReverseTransaction(id);
  const [txKind, setTxKind] = useState<TxKind | null>(null);
  const [reversing, setReversing] = useState<Transaction | null>(null);
  const [reminding, setReminding] = useState(false);

  const back = (
    <Link to="/loja/clientes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Clientes
    </Link>
  );

  if (customer.isPending)
    return (
      <div className="space-y-6">
        {back}
        <Skeleton className="h-40 rounded-[28px]" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );

  if (customer.isError)
    return (
      <div className="space-y-6">
        {back}
        <ErrorState
          title={customer.error instanceof ApiError && customer.error.status === 404 ? 'Cliente não encontrado' : undefined}
          message={customer.error.message}
          onRetry={() => customer.refetch()}
        />
      </div>
    );

  const c = customer.data;
  const code = c.inviteCode ? formatInviteCode(c.inviteCode) : null;
  const inviteMessage = code
    ? `Oi, ${c.name}! Agora você pode acompanhar pelo Cadernin sua conta do fiado (${me.store?.name ?? 'loja'}). ` +
      `Entre em ${window.location.origin}, escolha "Sou cliente" e use o código ${code}.`
    : '';

  async function shareInvite() {
    try {
      if (navigator.share) {
        await navigator.share({ text: inviteMessage });
      } else {
        await navigator.clipboard.writeText(inviteMessage);
        toast.success('Mensagem de convite copiada.');
      }
    } catch {
      /* compartilhamento cancelado */
    }
  }

  return (
    <div className="space-y-6">
      {back}

      {/* ---------- Cabeçalho ---------- */}
      <Card className="animate-fade-up overflow-hidden">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-center gap-4">
            <Avatar name={c.name} size={64} />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight">{c.name}</h1>
              <a
                href={`tel:${c.phone}`}
                className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-stone-500 tabular-nums hover:text-brand-700"
              >
                <Phone className="size-3.5" aria-hidden /> {formatPhone(c.phone)}
              </a>
              <div className="mt-2">
                {c.userUid ? (
                  <Badge tone="brand">
                    <Link2 className="size-3" aria-hidden /> Conta vinculada
                  </Badge>
                ) : (
                  <Badge tone="accent">Convite pendente</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="size-4" />}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setConfirmDelete(true)}
            >
              Excluir
            </Button>
          </div>
        </div>
        <div className="border-t border-stone-100 bg-paper/60 px-6 py-5 sm:px-8">
          <CreditSummary creditLimit={c.creditLimit} balanceDue={c.balanceDue} />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:flex">
            <Button icon={<ShoppingBasket className="size-5" />} onClick={() => setTxKind('purchase')}>
              Nova compra
            </Button>
            <Button
              variant="secondary"
              icon={<HandCoins className="size-5" />}
              onClick={() => setTxKind('payment')}
              disabled={c.balanceDue <= 0}
            >
              Pagamento
            </Button>
            {c.balanceDue > 0 && (
              <Button
                variant="ghost"
                icon={<BellRing className="size-5" />}
                onClick={() => setReminding(true)}
                className="col-span-2 border border-dashed border-stone-300"
              >
                Lembrar
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        {/* ---------- Convite ---------- */}
        {code ? (
          <section className="animate-fade-up [animation-delay:80ms]">
            <h2 className="mb-3 text-lg font-extrabold tracking-tight">Convite para o cliente</h2>
            <div className="relative overflow-hidden rounded-2xl bg-brand-900 p-6 text-white shadow-lift">
              <div className="pointer-events-none absolute inset-0 bg-ruled opacity-30" aria-hidden />
              <p className="relative text-sm text-brand-100/80">
                Com este código, {c.name} vê o saldo e o limite pelo próprio celular.
              </p>
              <p className="relative mt-4 font-mono text-4xl font-bold tracking-[0.2em] text-accent-400" aria-label={`Código ${code}`}>
                {code}
              </p>
              <div className="relative mt-5 flex flex-wrap gap-2">
                <Button variant="accent" size="sm" icon={<Share2 className="size-4" />} onClick={shareInvite}>
                  Enviar convite
                </Button>
                <Button
                  size="sm"
                  className="bg-white/10 text-white shadow-none hover:bg-white/20"
                  icon={<Copy className="size-4" />}
                  onClick={async () => {
                    await navigator.clipboard.writeText(c.inviteCode!);
                    toast.success('Código copiado.');
                  }}
                >
                  Copiar código
                </Button>
                <Button
                  size="sm"
                  className="bg-transparent text-brand-100 shadow-none hover:bg-white/10"
                  icon={<RefreshCw className="size-4" />}
                  onClick={() => setConfirmRegen(true)}
                >
                  Gerar outro
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section className="animate-fade-up [animation-delay:80ms]">
            <h2 className="mb-3 text-lg font-extrabold tracking-tight">Acesso do cliente</h2>
            <Card className="p-6">
              <p className="flex items-center gap-2 font-bold text-brand-700">
                <Link2 className="size-5" aria-hidden /> Conta vinculada
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {c.name} já acompanha as compras e o saldo pelo Cadernin.
              </p>
            </Card>
          </section>
        )}

        {/* ---------- Lançamentos ---------- */}
        <section className="animate-fade-up [animation-delay:140ms] lg:order-first">
          <h2 className="mb-3 text-lg font-extrabold tracking-tight">Caderno de lançamentos</h2>
          {transactions.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          ) : transactions.isError ? (
            <ErrorState message={transactions.error.message} onRetry={() => transactions.refetch()} />
          ) : transactions.data.length === 0 ? (
            <EmptyState
              icon={<NotebookPen className="size-7" />}
              title="Nenhum lançamento ainda"
              action={
                <Button icon={<ShoppingBasket className="size-5" />} onClick={() => setTxKind('purchase')}>
                  Anotar primeira compra
                </Button>
              }
            >
              Cada compra fiada, pagamento e estorno fica registrado aqui, com dia e horário.
            </EmptyState>
          ) : (
            <TransactionList transactions={transactions.data} filterable onReverse={setReversing} />
          )}
        </section>
      </div>

      <CustomerFormModal open={editing} onClose={() => setEditing(false)} customer={c} />
      <TransactionFormModal
        open={txKind !== null}
        onClose={() => setTxKind(null)}
        customer={c}
        initialKind={txKind ?? 'purchase'}
      />

      <CustomerReminderModal customer={c} open={reminding} onClose={() => setReminding(false)} />

      <ConfirmDialog
        open={reversing !== null}
        onClose={() => setReversing(null)}
        title="Estornar este lançamento?"
        description={
          reversing
            ? `"${reversing.description}" — ${formatCents(reversing.amountCents)}. Nada é apagado: o caderno ganha um lançamento de estorno ` +
              (reversing.type === 'purchase' ? 'e o valor sai da dívida.' : 'e o valor volta para a dívida.')
            : ''
        }
        confirmLabel="Estornar"
        loading={reverse.isPending}
        onConfirm={() =>
          reversing &&
          reverse.mutate(
            { txId: reversing.id },
            {
              onSuccess: () => {
                setReversing(null);
                toast.success('Lançamento estornado.');
              },
              onError: (err) => {
                setReversing(null);
                toast.error(err.message);
              },
            },
          )
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Excluir ${c.name}?`}
        description="Só é possível excluir clientes sem nenhum lançamento no caderno. Essa ação não pode ser desfeita."
        confirmLabel="Excluir cliente"
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(undefined, {
            onSuccess: () => {
              toast.success('Cliente excluído.');
              navigate('/loja/clientes', { replace: true });
            },
            onError: (err) => {
              setConfirmDelete(false);
              toast.error(err.message);
            },
          })
        }
      />

      <ConfirmDialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="Gerar um novo código?"
        description="O código atual deixa de funcionar. Use isso se o código foi enviado para a pessoa errada."
        confirmLabel="Gerar novo código"
        tone="primary"
        loading={regen.isPending}
        onConfirm={() =>
          regen.mutate(undefined, {
            onSuccess: () => {
              setConfirmRegen(false);
              toast.success('Novo código gerado.');
            },
            onError: (err) => toast.error(err.message),
          })
        }
      />
    </div>
  );
}
