import { CheckCircle2, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './ui';

type Toast = { id: number; tone: 'success' | 'error'; message: string };
type ToastApi = { success: (msg: string) => void; error: (msg: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: Toast['tone'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 sm:top-auto sm:bottom-6"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={cx(
                'pointer-events-auto flex w-full max-w-sm animate-fade-up items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lift',
                t.tone === 'success' ? 'bg-brand-900 text-white' : 'bg-red-600 text-white',
              )}
            >
              {t.tone === 'success' ? (
                <CheckCircle2 className="size-5 shrink-0 text-accent-400" aria-hidden />
              ) : (
                <XCircle className="size-5 shrink-0" aria-hidden />
              )}
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}
