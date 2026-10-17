import { availableCredit, creditUsagePercent, formatCents } from '@cadernin/shared';
import { cx } from './ui';

export function CreditBar({ creditLimit, balanceDue, className }: { creditLimit: number; balanceDue: number; className?: string }) {
  const pct = creditUsagePercent(creditLimit, balanceDue);
  const tone = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-accent-400' : 'bg-brand-500';
  return (
    <div
      role="meter"
      aria-label="Uso do limite"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cx('h-2 overflow-hidden rounded-full bg-stone-200/80', className)}
    >
      <div className={cx('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${Math.max(pct, balanceDue > 0 ? 3 : 0)}%` }} />
    </div>
  );
}

/** Bloco "Deve / Disponível / Limite" usado nas telas de lojista e cliente. */
export function CreditSummary({ creditLimit, balanceDue }: { creditLimit: number; balanceDue: number }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Deve" value={formatCents(balanceDue)} strong={balanceDue > 0} />
        <Stat label="Disponível" value={formatCents(availableCredit(creditLimit, balanceDue))} />
        <Stat label="Limite" value={formatCents(creditLimit)} />
      </div>
      <CreditBar creditLimit={creditLimit} balanceDue={balanceDue} className="mt-4" />
      <p className="mt-2 text-xs text-stone-500">{creditUsagePercent(creditLimit, balanceDue)}% do limite em uso</p>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">{label}</p>
      <p className={cx('mt-0.5 truncate font-extrabold tabular-nums', strong ? 'text-lg text-red-600' : 'text-lg text-ink')}>
        {value}
      </p>
    </div>
  );
}
