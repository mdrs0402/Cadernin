import { MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useMyReminders } from '../../api/reminders';
import { MessageBubble } from '../../components/reminders';
import { ErrorState } from '../../components/ui';
import { dayLabel } from '../../lib/dates';

const PREVIEW = 2;

/**
 * Lembretes que as lojas mandaram (simulação do WhatsApp). Some quando não há nenhum:
 * é um recado, não uma parte obrigatória da conta.
 */
export function ReceivedReminders({ storeId, showStore }: { storeId?: string; showStore?: boolean }) {
  const q = useMyReminders(storeId);
  const [all, setAll] = useState(false);
  if (q.isPending || (q.data && q.data.length === 0)) return null;

  return (
    <section className="animate-fade-up [animation-delay:110ms]">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold tracking-tight">
        <MessageCircle className="size-5 text-brand-600" aria-hidden /> Recados da loja
      </h2>
      {q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : (
        <div className="space-y-3">
          {(all ? q.data : q.data.slice(0, PREVIEW)).map((r) => (
            <div key={r.id}>
              <p className="mb-1.5 text-xs font-semibold text-stone-500">
                {showStore && <span className="text-ink">{r.storeName} · </span>}
                {dayLabel(new Date(r.createdAt))}
              </p>
              <MessageBubble text={r.message} at={r.createdAt} />
            </div>
          ))}
          {q.data.length > PREVIEW && (
            <button onClick={() => setAll((v) => !v)} className="text-sm font-semibold text-brand-700 hover:underline">
              {all ? 'Mostrar menos' : `Ver todos (${q.data.length})`}
            </button>
          )}
          <p className="text-xs text-stone-400">Simulação: numa versão futura, estes recados chegam pelo WhatsApp.</p>
        </div>
      )}
    </section>
  );
}
