import { formatCents, type Transaction } from '@cadernin/shared';
import { CalendarClock, HandCoins, ShoppingBasket, Store, Undo2, UserRound } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { dayLabel, formatDateOnly, formatTime, isPastDateOnly, localDayKey } from '../lib/dates';
import { Badge, Button, cx } from './ui';

type Tx = Transaction & { storeName?: string; customerName?: string };
type Filter = 'all' | 'purchase' | 'payment';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'purchase', label: 'Compras' },
  { id: 'payment', label: 'Pagamentos' },
];

/** Quanto o lançamento muda a dívida: + aumenta, − diminui. */
function debtDelta(t: Tx) {
  if (t.type === 'purchase') return t.amountCents;
  if (t.type === 'payment') return -t.amountCents;
  return t.reversesType === 'payment' ? t.amountCents : -t.amountCents;
}

const TYPE_UI: Record<Transaction['type'], { label: string; icon: ReactNode; iconClass: string }> = {
  purchase: { label: 'Compra', icon: <ShoppingBasket className="size-5" />, iconClass: 'bg-accent-100 text-accent-600' },
  payment: { label: 'Pagamento', icon: <HandCoins className="size-5" />, iconClass: 'bg-brand-50 text-brand-700' },
  reversal: { label: 'Estorno', icon: <Undo2 className="size-5" />, iconClass: 'bg-stone-100 text-stone-500' },
};

/**
 * Histórico do caderno, agrupado por dia: o que foi comprado, valor, dia e horário.
 * `onReverse` só é passado na visão do lojista.
 */
export function TransactionList({
  transactions,
  showStore = false,
  filterable = false,
  onReverse,
  empty,
}: {
  transactions: Tx[];
  showStore?: boolean;
  filterable?: boolean;
  onReverse?: (t: Tx) => void;
  empty?: ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>('all');

  const groups = useMemo(() => {
    const visible = transactions.filter((t) =>
      filter === 'all' ? true : filter === 'purchase' ? t.type === 'purchase' : t.type === 'payment',
    );
    const map = new Map<string, { date: Date; items: Tx[] }>();
    for (const t of visible) {
      const d = new Date(t.createdAt);
      const key = localDayKey(d);
      const g = map.get(key) ?? { date: d, items: [] };
      g.items.push(t);
      map.set(key, g);
    }
    return [...map.values()];
  }, [transactions, filter]);

  return (
    <div>
      {filterable && transactions.length > 0 && (
        <div role="tablist" aria-label="Filtrar lançamentos" className="mb-4 inline-flex rounded-xl bg-stone-200/60 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cx(
                'rounded-lg px-3.5 py-1.5 text-sm font-semibold transition',
                filter === f.id ? 'bg-white text-ink shadow-sm' : 'text-stone-500 hover:text-ink',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        (empty ?? <p className="py-6 text-center text-sm text-stone-500">Nada por aqui com esse filtro.</p>)
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const bought = g.items
              .filter((t) => t.type === 'purchase' && !t.reversedById)
              .reduce((s, t) => s + t.amountCents, 0);
            return (
              <section key={localDayKey(g.date)} aria-label={dayLabel(g.date)}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
                  <h3 className="font-hand text-2xl leading-none text-brand-700">{dayLabel(g.date)}</h3>
                  {bought > 0 && (
                    <p className="text-xs text-stone-500">
                      Comprou <strong className="text-ink tabular-nums">{formatCents(bought)}</strong>
                    </p>
                  )}
                </div>
                <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-card">
                  {g.items.map((t) => (
                    <TransactionRow key={t.id} t={t} showStore={showStore} onReverse={onReverse} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TransactionRow({ t, showStore, onReverse }: { t: Tx; showStore: boolean; onReverse?: (t: Tx) => void }) {
  const ui = TYPE_UI[t.type];
  const delta = debtDelta(t);
  const reversed = Boolean(t.reversedById);
  const pastDue = Boolean(t.dueDate && isPastDateOnly(t.dueDate));
  const time = formatTime(new Date(t.createdAt));

  return (
    <li className="flex gap-3 px-3.5 py-3.5 sm:gap-4 sm:px-5">
      <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', ui.iconClass, reversed && 'opacity-50')} aria-hidden>
        {ui.icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className={cx('font-semibold break-words text-ink', reversed && 'text-stone-400 line-through')}>{t.description}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
          <time dateTime={t.createdAt} className="tabular-nums">
            {time}
          </time>
          <span aria-hidden>·</span>
          <span>{ui.label}</span>
          {showStore && t.storeName && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Store className="size-3" aria-hidden /> {t.storeName}
              </span>
            </>
          )}
          {t.customerName && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 font-semibold text-stone-600">
                <UserRound className="size-3" aria-hidden /> {t.customerName}
              </span>
            </>
          )}
          {t.type === 'purchase' && t.dueDate && !reversed && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3" aria-hidden />
              {/* só a data: se ainda está em aberto quem diz é o painel (pagamentos quitam as compras mais antigas) */}
              {pastDue ? 'Venc.' : 'Vence'} {formatDateOnly(t.dueDate)}
            </span>
          )}
          {reversed && <Badge className="py-0 text-[11px]">Estornado</Badge>}
        </p>
        {onReverse && t.type !== 'reversal' && !reversed && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 -ml-2 h-7 px-2 text-xs text-stone-500"
            icon={<Undo2 className="size-3.5" />}
            onClick={() => onReverse(t)}
          >
            Estornar
          </Button>
        )}
      </div>

      <p
        className={cx(
          'shrink-0 text-right font-extrabold whitespace-nowrap tabular-nums',
          reversed ? 'text-stone-400 line-through' : delta > 0 ? 'text-ink' : 'text-brand-700',
        )}
        aria-label={`${delta > 0 ? 'Aumentou a dívida em' : 'Diminuiu a dívida em'} ${formatCents(t.amountCents)}`}
      >
        {delta > 0 ? '+' : '−'} {formatCents(t.amountCents)}
      </p>
    </li>
  );
}
