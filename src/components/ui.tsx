import { AlertTriangle, Inbox, Loader2, RotateCw } from 'lucide-react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* ---------- Botão ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      'bg-brand-700 text-white shadow-sm shadow-brand-900/20 hover:bg-brand-800 active:bg-brand-900',
    secondary: 'border border-stone-300/80 bg-white text-ink shadow-sm hover:border-stone-400 hover:bg-stone-50',
    ghost: 'text-stone-600 hover:bg-stone-900/5 hover:text-ink',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
    accent: 'bg-accent-400 text-brand-950 shadow-sm hover:bg-accent-300',
  }[variant];
  const sizes = {
    sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
    md: 'h-11 px-4 text-[15px] rounded-xl gap-2',
    lg: 'h-13 px-6 text-base rounded-2xl gap-2.5',
  }[size];

  return (
    <button
      className={cx(
        'inline-flex select-none items-center justify-center font-semibold transition duration-150',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60',
        variants,
        sizes,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('rounded-2xl border border-stone-200/70 bg-white shadow-card', className)}
      {...props}
    />
  );
}

/* ---------- Badge ---------- */

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'brand' | 'accent' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700 ring-stone-200',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
    accent: 'bg-accent-100 text-accent-600 ring-accent-300/60',
    danger: 'bg-red-50 text-red-700 ring-red-200',
  }[tone];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        tones,
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Avatar ---------- */

export function Avatar({ src, name, size = 44 }: { src?: string | null; name?: string | null; size?: number }) {
  const initials =
    (name ?? '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-bold text-brand-800 ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
      {src && (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
    </span>
  );
}

/* ---------- Estados: carregando, vazio, erro ---------- */

export function Spinner({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cx('flex flex-col items-center justify-center gap-3 py-16 text-stone-500', className)}>
      <span className="relative flex size-10">
        <span className="absolute inset-0 rounded-full border-[3px] border-brand-100" />
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-brand-600" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper">
      <Spinner label="Abrindo o caderno…" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-stone-200/70', className)} aria-hidden />;
}

export function ErrorState({
  title = 'Algo deu errado',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50/70 px-6 py-8 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-red-100 text-red-600">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <p className="mt-4 font-bold text-red-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-red-800/80">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry} icon={<RotateCw className="size-4" />}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-stone-300/80 bg-white/50 px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        {icon ?? <Inbox className="size-7" aria-hidden />}
      </span>
      <p className="mt-4 font-bold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-stone-500">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
