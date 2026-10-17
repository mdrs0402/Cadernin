import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';

/** Bottom sheet no celular, janela centralizada no desktop. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // guarda o onClose mais recente sem refazer o efeito (senão o foco pula a cada re-render do pai)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    // foca o primeiro campo (ou o painel)
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('input, textarea, select');
      (first ?? panelRef.current)?.focus();
    }, 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-[fade-in_150ms_ease-out] bg-brand-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="relative max-h-[92dvh] w-full animate-[sheet-up_220ms_cubic-bezier(0.2,0.8,0.2,1)] overflow-y-auto rounded-t-[28px] bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lift focus:outline-none sm:max-w-lg sm:animate-fade-up sm:rounded-[28px] sm:p-8"
      >
        <span className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-stone-200 sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="text-xl font-extrabold tracking-tight">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="-mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>
        {children && <div className="mt-6">{children}</div>}
        {footer && <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  tone = 'danger',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
