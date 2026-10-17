import { cx } from './ui';

type Entry = { who: string; what: string; value: string; kind: 'compra' | 'pago' };

const ENTRIES: Entry[] = [
  { who: 'Seu João', what: 'pão e leite', value: 'R$ 12,50', kind: 'compra' },
  { who: 'Dona Cida', what: 'acertou a conta', value: 'R$ 80,00', kind: 'pago' },
  { who: 'Léo da oficina', what: 'café + bolo', value: 'R$ 9,90', kind: 'compra' },
  { who: 'Tia Rosa', what: 'arroz 5kg', value: 'R$ 27,40', kind: 'compra' },
];

/** Ilustração de uma página de caderninho de fiado, usada na tela de entrada. */
export function NotebookPreview({ className }: { className?: string }) {
  return (
    <div className={cx('relative', className)} aria-hidden>
      {/* folha de trás */}
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-3 rounded-[28px] bg-paper-dark/90 shadow-lift" />

      <div className="relative -rotate-2 overflow-hidden rounded-[28px] bg-paper shadow-lift">
        {/* espiral */}
        <div className="absolute inset-y-0 left-0 flex w-10 flex-col justify-evenly bg-paper-dark/70 py-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="mx-auto size-3 rounded-full bg-brand-950/15 shadow-inner" />
          ))}
        </div>
        {/* margem vermelha */}
        <div className="absolute inset-y-0 left-[68px] w-px bg-margin/60" />

        <div className="bg-ruled pt-6 pr-6 pb-8 pl-20">
          <p className="font-hand text-[30px] leading-8 text-brand-800">Fiado · Outubro</p>
          <ul className="mt-2">
            {ENTRIES.map((e) => (
              <li key={e.who} className="flex items-baseline justify-between gap-4 font-hand text-[22px] leading-8">
                <span className="truncate text-ink/85">
                  {e.who} <span className="text-stone-500">· {e.what}</span>
                </span>
                <span
                  className={cx(
                    'shrink-0 font-bold',
                    e.kind === 'pago' ? 'text-brand-600' : 'text-ink',
                  )}
                >
                  {e.kind === 'pago' ? `✓ ${e.value}` : e.value}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t-2 border-dashed border-brand-900/20 pt-1 font-hand text-[24px] leading-8">
            <span className="text-brand-800">A receber</span>
            <span className="relative font-bold text-ink">
              <span className="absolute -inset-x-1.5 inset-y-1 -z-0 -rotate-1 rounded bg-accent-300/70" />
              <span className="relative">R$ 49,80</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
