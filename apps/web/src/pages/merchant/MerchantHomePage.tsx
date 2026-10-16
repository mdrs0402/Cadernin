import { creditUsagePercent, formatCents, type DayTotals, type DueItem, type MerchantDashboard } from '@cadernin/shared';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  CalendarCheck2,
  Gauge,
  HandCoins,
  NotebookPen,
  ShoppingBasket,
  UserPlus,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useCustomers, useDashboard } from '../../api/store';
import { CreditBar } from '../../components/credit';
import { TransactionList } from '../../components/TransactionList';
import { Avatar, Button, Card, cx, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { relativeDue, weekdayOf } from '../../lib/dates';
import { useMeContext } from '../../routes/guards';
import { CustomerFormModal } from './CustomerFormModal';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

const customerLink = (id: string) => `/loja/clientes/${encodeURIComponent(id)}`;

export function MerchantHomePage() {
  const me = useMeContext();
  const dash = useDashboard();
  const customers = useCustomers();
  const [creating, setCreating] = useState(false);
  const d = dash.data;

  return (
    <div className="space-y-8">
      {/* ---------- Topo ---------- */}
      <section className="relative isolate animate-fade-up overflow-hidden rounded-[28px] bg-brand-900 px-6 py-8 text-white shadow-lift sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute -top-24 -right-16 size-80 rounded-full bg-brand-500/40 blur-3xl" />
          <div className="absolute inset-0 bg-ruled opacity-30" />
        </div>
        <p className="font-hand text-2xl text-accent-300">{greeting()},</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{me.name?.split(' ')[0] ?? 'lojista'}!</h1>
        <p className="mt-2 text-brand-100/80">
          Caderno de fiado · <strong className="font-semibold text-white">{me.store?.name}</strong>
        </p>

        <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-brand-200/80 uppercase">Total a receber</p>
            {dash.isPending ? (
              <Skeleton className="mt-2 h-11 w-48 bg-white/15" />
            ) : (
              <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
                {formatCents(d?.totals.receivableCents ?? 0)}
              </p>
            )}
          </div>
          {d && d.overdueCents > 0 && (
            <a
              href="#vencimentos"
              className="inline-flex items-center gap-2 rounded-full bg-red-500/90 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
            >
              <AlertTriangle className="size-4" aria-hidden />
              {formatCents(d.overdueCents)} vencido
            </a>
          )}
        </div>
      </section>

      {dash.isError && <ErrorState message={dash.error.message} onRetry={() => dash.refetch()} />}
      {dash.isPending && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      )}

      {d && d.totals.customers === 0 && (
        <EmptyState
          icon={<UserPlus className="size-7" />}
          title="Comece cadastrando seus clientes"
          action={
            <Button onClick={() => setCreating(true)} icon={<UserPlus className="size-5" />}>
              Adicionar cliente
            </Button>
          }
        >
          Defina um limite de crédito para cada um e o Cadernin cuida das contas.
        </EmptyState>
      )}

      {d && d.totals.customers > 0 && (
        <>
          {/* ---------- Números do mês ---------- */}
          <div className="grid animate-fade-up grid-cols-2 gap-3 [animation-delay:60ms] lg:grid-cols-4">
            <StatCard
              icon={<ShoppingBasket className="size-5" />}
              tone="accent"
              label="Vendido fiado no mês"
              value={formatCents(d.month.soldCents)}
              hint={`${d.month.purchases} ${d.month.purchases === 1 ? 'compra' : 'compras'}`}
            />
            <StatCard
              icon={<HandCoins className="size-5" />}
              label="Recebido no mês"
              value={formatCents(d.month.receivedCents)}
              hint={`${d.month.payments} ${d.month.payments === 1 ? 'pagamento' : 'pagamentos'}`}
            />
            <StatCard
              icon={<Users className="size-5" />}
              label="Clientes devendo"
              value={`${d.totals.debtors} de ${d.totals.customers}`}
            />
            <StatCard
              icon={<Gauge className="size-5" />}
              label="Limite em uso"
              value={`${creditUsagePercent(d.totals.creditGrantedCents, d.totals.receivableCents)}%`}
              hint={`de ${formatCents(d.totals.creditGrantedCents)}`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <DueSection dashboard={d} />
            <WeekChart days={d.last7Days} today={d.today} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <section className="animate-fade-up [animation-delay:160ms]">
              <h2 className="mb-3 text-lg font-extrabold tracking-tight">Últimos lançamentos</h2>
              {d.recent.length === 0 ? (
                <EmptyState icon={<NotebookPen className="size-7" />} title="Nenhum lançamento ainda">
                  Abra um cliente e anote a primeira compra fiada.
                </EmptyState>
              ) : (
                <TransactionList transactions={d.recent} />
              )}
            </section>

            <div className="space-y-6">
              {d.nearLimit.length > 0 && (
                <section className="animate-fade-up [animation-delay:200ms]">
                  <h2 className="mb-3 text-lg font-extrabold tracking-tight">Perto do limite</h2>
                  <Card className="divide-y divide-stone-100">
                    {d.nearLimit.map((c) => (
                      <Link key={c.customerId} to={customerLink(c.customerId)} className="block px-5 py-4 hover:bg-brand-50/50">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate font-bold">{c.name}</p>
                          <p className="shrink-0 text-sm font-bold text-red-600 tabular-nums">
                            {creditUsagePercent(c.creditLimit, c.balanceDue)}%
                          </p>
                        </div>
                        <CreditBar creditLimit={c.creditLimit} balanceDue={c.balanceDue} className="mt-2" />
                        <p className="mt-1.5 text-xs text-stone-500 tabular-nums">
                          {formatCents(c.balanceDue)} de {formatCents(c.creditLimit)}
                        </p>
                      </Link>
                    ))}
                  </Card>
                </section>
              )}

              <TopDebtors customers={customers.data} />
            </div>
          </div>
        </>
      )}

      <CustomerFormModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'brand',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'brand' | 'accent';
}) {
  return (
    <Card className="p-4 sm:p-5">
      <span
        className={cx(
          'grid size-9 place-items-center rounded-xl',
          tone === 'accent' ? 'bg-accent-100 text-accent-600' : 'bg-brand-50 text-brand-700',
        )}
      >
        {icon}
      </span>
      <p className="mt-3 text-xs font-semibold tracking-wide text-stone-400 uppercase">{label}</p>
      <p className="mt-0.5 truncate text-xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-stone-500">{hint}</p>}
    </Card>
  );
}

/* ---------- Vencimentos ---------- */

function DueSection({ dashboard: d }: { dashboard: MerchantDashboard }) {
  const nothing = d.overdue.length === 0 && d.dueSoon.length === 0;
  return (
    <section id="vencimentos" className="animate-fade-up scroll-mt-24 [animation-delay:100ms]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">Vencimentos</h2>
        {!nothing && (
          <Link
            to="/loja/lembretes"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-300/80 bg-white px-3 text-sm font-semibold shadow-sm hover:border-stone-400 hover:bg-stone-50"
          >
            <BellRing className="size-4 text-brand-700" aria-hidden /> Lembrar clientes
          </Link>
        )}
      </div>
      {nothing ? (
        <EmptyState icon={<CalendarCheck2 className="size-7" />} title="Nada vencendo">
          Compras com data de vencimento aparecem aqui quando estiverem perto de vencer ou vencidas.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          {d.overdue.length > 0 && (
            <DueGroup
              title="Vencidos"
              total={d.overdueCents}
              items={d.overdue}
              today={d.today}
              tone="danger"
            />
          )}
          {d.dueSoon.length > 0 && (
            <DueGroup title="Vencem em breve" total={d.dueSoonCents} items={d.dueSoon} today={d.today} tone="accent" />
          )}
        </Card>
      )}
    </section>
  );
}

const DUE_PREVIEW = 5;

function DueGroup({
  title,
  total,
  items,
  today,
  tone,
}: {
  title: string;
  total: number;
  items: DueItem[];
  today: string;
  tone: 'danger' | 'accent';
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, DUE_PREVIEW);
  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <div
        className={cx(
          'flex items-center justify-between px-5 py-3 text-sm font-bold',
          tone === 'danger' ? 'bg-red-50 text-red-800' : 'bg-accent-100/60 text-accent-600',
        )}
      >
        <span className="inline-flex items-center gap-2">
          {tone === 'danger' ? <AlertTriangle className="size-4" aria-hidden /> : <CalendarClock className="size-4" aria-hidden />}
          {title} · {items.length}
        </span>
        <span className="tabular-nums">{formatCents(total)}</span>
      </div>
      <ul className="divide-y divide-stone-100">
        {shown.map((it) => (
          <li key={it.purchaseId}>
            <Link to={customerLink(it.customerId)} className="flex items-center gap-3 px-5 py-3.5 hover:bg-brand-50/50">
              <Avatar name={it.customerName} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{it.customerName}</p>
                <p className="truncate text-xs text-stone-500">
                  <span className={cx('font-semibold', tone === 'danger' ? 'text-red-600' : 'text-accent-600')}>
                    {relativeDue(it.dueDate, today)}
                  </span>{' '}
                  · {it.description}
                </p>
              </div>
              <p className="shrink-0 font-extrabold whitespace-nowrap tabular-nums">{formatCents(it.openCents)}</p>
            </Link>
          </li>
        ))}
      </ul>
      {items.length > DUE_PREVIEW && (
        <button onClick={() => setAll((v) => !v)} className="w-full px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50/50">
          {all ? 'Mostrar menos' : `Ver todos (${items.length})`}
        </button>
      )}
    </div>
  );
}

/* ---------- Gráfico da semana ---------- */

function WeekChart({ days, today }: { days: DayTotals[]; today: string }) {
  const max = Math.max(1, ...days.flatMap((d) => [d.soldCents, d.receivedCents]));
  const sold = days.reduce((s, d) => s + d.soldCents, 0);
  const received = days.reduce((s, d) => s + d.receivedCents, 0);

  return (
    <section className="animate-fade-up [animation-delay:130ms]">
      <h2 className="mb-3 text-lg font-extrabold tracking-tight">Últimos 7 dias</h2>
      <Card className="p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Legend className="bg-accent-400" label="Vendido fiado" value={formatCents(sold)} />
          <Legend className="bg-brand-600" label="Recebido" value={formatCents(received)} />
        </div>
        <div
          className="mt-5 grid h-44 grid-cols-7 items-end gap-2 border-b border-stone-200 sm:gap-3"
          role="img"
          aria-label={`Últimos 7 dias: vendido fiado ${formatCents(sold)}, recebido ${formatCents(received)}`}
        >
          {days.map((d) => (
            <div key={d.day} className="group relative flex h-full items-end justify-center gap-1">
              <Bar value={d.soldCents} max={max} className="bg-accent-400" />
              <Bar value={d.receivedCents} max={max} className="bg-brand-600" />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] whitespace-nowrap text-white shadow-lift group-hover:block">
                <p>Vendido {formatCents(d.soldCents)}</p>
                <p>Recebido {formatCents(d.receivedCents)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2 text-center text-xs sm:gap-3">
          {days.map((d) => (
            <span key={d.day} className={cx('capitalize', d.day === today ? 'font-bold text-ink' : 'text-stone-400')}>
              {d.day === today ? 'hoje' : weekdayOf(d.day)}
            </span>
          ))}
        </div>
      </Card>
    </section>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = value > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex h-full w-full max-w-4 items-end">
      <div className={cx('w-full rounded-t-md transition-all duration-500', className)} style={{ height: `${pct}%` }} />
    </div>
  );
}

function Legend({ className, label, value }: { className: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-stone-500">
      <span className={cx('size-2.5 rounded-full', className)} aria-hidden />
      {label} <strong className="text-ink tabular-nums">{value}</strong>
    </span>
  );
}

/* ---------- Quem mais deve ---------- */

function TopDebtors({ customers }: { customers?: { id: string; name: string; creditLimit: number; balanceDue: number }[] }) {
  if (!customers) return null;
  const debtors = customers.filter((c) => c.balanceDue > 0).sort((a, b) => b.balanceDue - a.balanceDue);
  return (
    <section className="animate-fade-up [animation-delay:240ms]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold tracking-tight">Quem mais deve</h2>
        <Link to="/loja/clientes" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          Ver todos <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      {debtors.length === 0 ? (
        <EmptyState icon={<HandCoins className="size-7" />} title="Ninguém devendo">
          Todas as contas estão em dia.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-stone-100">
          {debtors.slice(0, 5).map((c) => (
            <Link key={c.id} to={customerLink(c.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-brand-50/50">
              <Avatar name={c.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{c.name}</p>
                <CreditBar creditLimit={c.creditLimit} balanceDue={c.balanceDue} className="mt-2 max-w-48" />
              </div>
              <p className="font-extrabold whitespace-nowrap text-red-600 tabular-nums">{formatCents(c.balanceDue)}</p>
            </Link>
          ))}
        </Card>
      )}
    </section>
  );
}
