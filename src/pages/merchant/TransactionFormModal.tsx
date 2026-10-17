import { availableCredit, formatCents, newTransactionSchema, type Customer } from '@cadernin/shared';
import { HandCoins, ShoppingBasket } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useCreateTransaction } from '../../api/transactions';
import { Field, MoneyInput, TextInput } from '../../components/forms';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Button, cx } from '../../components/ui';
import { localDayKey } from '../../lib/dates';

export type TxKind = 'purchase' | 'payment';

export function TransactionFormModal({
  open,
  onClose,
  customer,
  initialKind = 'purchase',
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer;
  initialKind?: TxKind;
}) {
  const toast = useToast();
  const create = useCreateTransaction(customer.id);
  const [kind, setKind] = useState<TxKind>(initialKind);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    setAmount(0);
    setDescription('');
    setDueDate('');
    setErrors({});
    create.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKind]);

  const available = availableCredit(customer.creditLimit, customer.balanceDue);
  const overLimit = kind === 'purchase' && amount > available;
  const overBalance = kind === 'payment' && amount > customer.balanceDue;

  function submit(e: FormEvent) {
    e.preventDefault();
    const raw =
      kind === 'purchase'
        ? { type: kind, amountCents: amount, description, dueDate: dueDate || null }
        : { type: kind, amountCents: amount, description };
    const parsed = newTransactionSchema.safeParse(raw);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      return setErrors(next);
    }
    if (overLimit) return setErrors({ amountCents: `Passa do limite. Disponível: ${formatCents(available)}.` });
    if (overBalance) return setErrors({ amountCents: `Maior que o saldo devedor (${formatCents(customer.balanceDue)}).` });
    setErrors({});

    create.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(kind === 'purchase' ? 'Compra anotada no caderno.' : 'Pagamento registrado.');
        onClose();
      },
      onError: (err) => setErrors({ amountCents: err.message }),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === 'purchase' ? 'Anotar compra fiada' : 'Registrar pagamento'}
      description={customer.name}
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div role="radiogroup" aria-label="Tipo de lançamento" className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1.5">
          {(
            [
              { id: 'purchase', label: 'Compra', icon: <ShoppingBasket className="size-4" /> },
              { id: 'payment', label: 'Pagamento', icon: <HandCoins className="size-4" /> },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={kind === o.id}
              onClick={() => {
                setKind(o.id);
                setErrors({});
              }}
              className={cx(
                'flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition',
                kind === o.id ? 'bg-white text-ink shadow-sm' : 'text-stone-500 hover:text-ink',
              )}
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>

        <Field
          label="Valor"
          error={errors.amountCents}
          hint={
            kind === 'purchase'
              ? `Disponível no limite: ${formatCents(available)}`
              : `Saldo devedor: ${formatCents(customer.balanceDue)}`
          }
        >
          {(p) => (
            <MoneyInput
              {...p}
              value={amount}
              onValueChange={setAmount}
              className="h-14 text-2xl"
              aria-invalid={p['aria-invalid'] || overLimit || overBalance || undefined}
            />
          )}
        </Field>

        {kind === 'payment' && customer.balanceDue > 0 && (
          <button
            type="button"
            onClick={() => setAmount(customer.balanceDue)}
            className="-mt-2 text-sm font-semibold text-brand-700 hover:underline"
          >
            Quitar tudo ({formatCents(customer.balanceDue)})
          </button>
        )}

        <Field
          label={kind === 'purchase' ? 'O que foi comprado' : 'Observação (opcional)'}
          error={errors.description}
        >
          {(p) => (
            <TextInput
              {...p}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={kind === 'purchase' ? 'Ex.: Arroz 5kg, feijão e café' : 'Ex.: Pix, dinheiro…'}
              maxLength={200}
            />
          )}
        </Field>

        {kind === 'purchase' && (
          <Field label="Vencimento (opcional)" error={errors.dueDate} hint="Quando o cliente combinou de pagar.">
            {(p) => (
              <TextInput {...p} type="date" min={localDayKey(new Date())} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            )}
          </Field>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending} disabled={amount <= 0}>
            {kind === 'purchase' ? 'Anotar compra' : 'Registrar pagamento'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
