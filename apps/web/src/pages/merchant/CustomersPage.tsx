import { formatCents, formatPhone, normalizePhone, type Customer } from '@cadernin/shared';
import { ChevronRight, Link2, Plus, Search, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCustomers } from '../../api/store';
import { CreditBar } from '../../components/credit';
import { TextInput } from '../../components/forms';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { CustomerFormModal } from './CustomerFormModal';

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function CustomersPage() {
  const customers = useCustomers();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const list = customers.data ?? [];
    const q = normalize(query.trim());
    if (!q) return list;
    const digits = normalizePhone(query);
    return list.filter((c) => normalize(c.name).includes(q) || (digits.length >= 3 && c.phone.includes(digits)));
  }, [customers.data, query]);

  return (
    <div className="space-y-6">
      <div className="flex animate-fade-up flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Clientes</h1>
          <p className="mt-1 text-stone-500">
            {customers.data ? `${customers.data.length} no seu caderno` : 'Quem compra fiado na sua loja'}
          </p>
        </div>
        <Button onClick={() => setCreating(true)} icon={<Plus className="size-5" />} className="max-sm:hidden">
          Novo cliente
        </Button>
      </div>

      {customers.isPending && <ListSkeleton />}
      {customers.isError && <ErrorState message={customers.error.message} onRetry={() => customers.refetch()} />}

      {customers.data && customers.data.length === 0 && (
        <EmptyState
          icon={<Users className="size-7" />}
          title="Seu caderno ainda está em branco"
          action={
            <Button onClick={() => setCreating(true)} icon={<UserPlus className="size-5" />}>
              Adicionar primeiro cliente
            </Button>
          }
        >
          Cadastre quem compra fiado, defina um limite e acompanhe tudo por aqui.
        </EmptyState>
      )}

      {customers.data && customers.data.length > 0 && (
        <>
          <div className="relative animate-fade-up [animation-delay:60ms]">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-stone-400" aria-hidden />
            <TextInput
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              aria-label="Buscar cliente"
              className="pl-12"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={<Search className="size-7" />} title="Ninguém encontrado">
              Nenhum cliente com “{query}”.
            </EmptyState>
          ) : (
            <Card className="animate-fade-up divide-y divide-stone-100 overflow-hidden [animation-delay:120ms]">
              {filtered.map((c) => (
                <CustomerRow key={c.id} customer={c} />
              ))}
            </Card>
          )}
        </>
      )}

      {/* Botão flutuante no celular */}
      <button
        onClick={() => setCreating(true)}
        aria-label="Novo cliente"
        className="fixed right-4 bottom-24 z-20 grid size-14 place-items-center rounded-2xl bg-brand-700 text-white shadow-lift transition active:scale-95 sm:hidden"
      >
        <Plus className="size-6" />
      </button>

      <CustomerFormModal open={creating} onClose={() => setCreating(false)} onSaved={(c) => navigate(`/loja/clientes/${c.id}`)} />
    </div>
  );
}

function CustomerRow({ customer: c }: { customer: Customer }) {
  return (
    <Link
      to={`/loja/clientes/${c.id}`}
      className="flex items-center gap-4 px-4 py-4 transition hover:bg-brand-50/50 sm:px-5"
    >
      <Avatar name={c.name} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-bold">{c.name}</p>
          {c.userUid ? (
            <Badge tone="brand" className="max-sm:hidden">
              <Link2 className="size-3" aria-hidden /> Vinculado
            </Badge>
          ) : (
            <Badge tone="neutral" className="max-sm:hidden">
              Convite pendente
            </Badge>
          )}
        </div>
        <p className="text-sm text-stone-500 tabular-nums">{formatPhone(c.phone)}</p>
        <CreditBar creditLimit={c.creditLimit} balanceDue={c.balanceDue} className="mt-2 max-w-56" />
      </div>
      <div className="text-right">
        <p className={`font-extrabold tabular-nums ${c.balanceDue > 0 ? 'text-red-600' : 'text-ink'}`}>
          {formatCents(c.balanceDue)}
        </p>
        <p className="text-xs text-stone-400 tabular-nums">de {formatCents(c.creditLimit)}</p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-stone-300" aria-hidden />
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando clientes">
      <Skeleton className="h-12 rounded-xl" />
      <Card className="divide-y divide-stone-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-5">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </Card>
    </div>
  );
}
