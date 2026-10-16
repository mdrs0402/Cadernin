import { updateStoreSchema } from '@cadernin/shared';
import { Store } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useUpdateStore } from '../../api/store';
import { Field, TextInput } from '../../components/forms';
import { useToast } from '../../components/Toast';
import { Button, Card } from '../../components/ui';
import { useMeContext } from '../../routes/guards';

export function StoreSettingsPage() {
  const me = useMeContext();
  const toast = useToast();
  const update = useUpdateStore();
  const [name, setName] = useState(me.store?.name ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setName(me.store?.name ?? ''), [me.store?.name]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = updateStoreSchema.safeParse({ name });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Nome inválido.');
    setError(null);
    update.mutate(parsed.data, {
      onSuccess: () => toast.success('Nome da loja atualizado.'),
      onError: (err) => setError(err.message),
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-extrabold tracking-tight">Sua loja</h1>
        <p className="mt-1 text-stone-500">Informações que seus clientes veem.</p>
      </div>

      <Card className="animate-fade-up p-6 [animation-delay:60ms] sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <Store className="size-6" aria-hidden />
          </span>
          <div>
            <p className="font-bold">{me.store?.name}</p>
            <p className="text-sm text-stone-500">Dono(a): {me.name ?? me.email}</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field label="Nome da loja" error={error}>
            {(p) => <TextInput {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={update.isPending} disabled={name.trim() === me.store?.name}>
              Salvar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
