import { cx } from './ui';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cx('size-9', className)} aria-hidden>
      <rect x="8" y="4" width="48" height="56" rx="12" fill="currentColor" />
      <rect x="8" y="4" width="11" height="56" rx="5.5" fill="black" fillOpacity="0.22" />
      <path d="M27 22h19M27 32h19M27 42h11" stroke="#fbf7ee" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="13.5" cy="16" r="2.2" fill="#f5b83d" />
      <circle cx="13.5" cy="32" r="2.2" fill="#f5b83d" />
      <circle cx="13.5" cy="48" r="2.2" fill="#f5b83d" />
    </svg>
  );
}

export function Logo({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={tone === 'dark' ? 'text-brand-700' : 'text-accent-400'} />
      <span
        className={cx(
          'text-[22px] font-extrabold tracking-tight',
          tone === 'dark' ? 'text-brand-900' : 'text-white',
        )}
      >
        Cadernin
      </span>
    </span>
  );
}
