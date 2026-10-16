import { customerInputSchema, type Customer } from '@cadernin/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { useCreateCustomer, useUpdateCustomer } from '../../api/store';
import { Field, MoneyInput, PhoneInput, TextInput } from '../../components/forms';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui';

type Errors = Partial<Record<'name' | 'phone' | 'creditLimit', string>>;

const LIMIT_PRESETS = [5000, 10000, 20000, 50000];

export function CustomerFormModal({
  open,
  onClose,
  customer,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Se vier, edita; senão cria. */
  customer?: Customer;
  onSaved?: (c: Customer) => void;
}) {
  const toast = useToast();
  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?.id ?? '');
  const mutation = customer ? update : create;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimit, setCreditLimit] = useState(0);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? '');
    setPhone(customer?.phone ?? '');
    setCreditLimit(customer?.creditLimit ?? 10000);
    setErrors({});
    mutation.reset();
  }, [open, customer]); // eslint-disable-line react-hooks/exhaustive-deps -- reset só ao abrir

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = customerInputSchema.safeParse({ name, phone, creditLimit });
    if (!parsed.success) {
      const errs: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        errs[key] ??= issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data, {
      onSuccess: (saved) => {
        toast.success(customer ? 'Cliente atualizado.' : `${parsed.data.name} entrou no caderno!`);
        if (saved) onSaved?.(saved);
        onClose();
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === 'conflict') setErrors({ phone: err.message });
      },
    });
  }

  const apiError = mutation.error instanceof ApiError && mutation.error.code !== 'conflict' ? mutation.error.message : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Editar cliente' : 'Novo cliente'}
      description={customer ? undefined : 'Depois você envia o código de convite para ele acompanhar a conta.'}
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Nome" error={errors.name}>
          {(p) => (
            <TextInput {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Seu João" maxLength={80} autoComplete="off" />
          )}
        </Field>
        <Field label="Telefone (WhatsApp)" error={errors.phone}>
          {(p) => <PhoneInput {...p} value={phone} onValueChange={setPhone} />}
        </Field>
        <Field label="Limite de crédito" error={errors.creditLimit} hint="Até quanto ele pode dever no fiado.">
          {(p) => <MoneyInput {...p} value={creditLimit} onValueChange={setCreditLimit} />}
        </Field>
        <div className="-mt-2 flex flex-wrap gap-2">
          {LIMIT_PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCreditLimit(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
                creditLimit === v ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-stone-600 ring-stone-300 hover:ring-brand-400'
              }`}
            >
              R$ {v / 100}
            </button>
          ))}
        </div>

        {apiError && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {apiError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {customer ? 'Salvar alterações' : 'Adicionar cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
