import { ArrowLeftRight, ChevronDown, LogOut, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { Logo } from './Logo';
import { Avatar, cx } from './ui';

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

export function AppShell({
  children,
  nav,
  context,
}: {
  children: ReactNode;
  nav?: NavItem[];
  /** Texto pequeno ao lado do logo (ex.: nome da loja). */
  context?: string;
}) {
  return (
    <div className={cx('min-h-dvh bg-dotted', nav && 'pb-24 sm:pb-0')}>
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" aria-label="Cadernin, início" className="shrink-0">
              <Logo />
            </Link>
            {context && (
              <span className="hidden min-w-0 truncate rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 ring-1 ring-brand-200 sm:block">
                {context}
              </span>
            )}
          </div>

          {nav && (
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Principal">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition',
                      isActive ? 'bg-brand-700 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-900/5 hover:text-ink',
                    )
                  }
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">{children}</main>

      {nav && (
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
        >
          <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition',
                    isActive ? 'text-brand-700' : 'text-stone-400',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cx(
                        'grid h-8 w-14 place-items-center rounded-full transition',
                        isActive && 'bg-brand-100',
                      )}
                    >
                      <item.icon className="size-5" aria-hidden />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export function UserMenu() {
  const { user, switchAccount, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  async function handleSwitch() {
    setSwitching(true);
    setSwitchError(null);
    try {
      await switchAccount();
      setOpen(false);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-blocked') {
        setSwitchError('O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.');
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setSwitchError('Não foi possível trocar de conta. Tente de novo.');
      }
    } finally {
      setSwitching(false);
    }
  }
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (!user) return null;
  const firstName = user.displayName?.split(' ')[0] ?? 'Conta';

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 transition hover:bg-stone-900/5"
      >
        <Avatar src={user.photoURL} name={user.displayName} size={34} />
        <span className="hidden text-sm font-semibold md:block">{firstName}</span>
        <ChevronDown className={cx('size-4 text-stone-500 transition', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 origin-top-right animate-fade-up overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lift [animation-duration:150ms]"
        >
          <div className="flex items-center gap-3 border-b border-stone-100 p-4">
            <Avatar src={user.photoURL} name={user.displayName} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.displayName ?? 'Sem nome'}</p>
              <p className="truncate text-xs text-stone-500">{user.email}</p>
            </div>
          </div>
          <button
            role="menuitem"
            onClick={handleSwitch}
            disabled={switching}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
          >
            <ArrowLeftRight className="size-4" aria-hidden />
            {switching ? 'Abrindo o Google…' : 'Trocar de conta'}
          </button>
          {switchError && (
            <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {switchError}
            </p>
          )}
          <button
            role="menuitem"
            onClick={signOut}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="size-4" aria-hidden />
            Sair da conta
          </button>
        </div>
      )}
    </div>
  );
}
