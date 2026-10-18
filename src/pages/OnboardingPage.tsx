import { ROLES, type Role } from '@cadernin/shared';
import { ArrowRight, Check, Store, UserRound } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useCreateProfile, useMe } from '../api/me';
import { useAuth } from '../auth/AuthProvider';
import { UserMenu } from '../components/AppShell';
import { Field, TextInput } from '../components/forms';
import { Logo } from '../components/Logo';
import { Button, cx, FullPageSpinner } from '../components/ui';
import { homeFor } from '../routes/guards';

const OPTIONS: Record<Role, { icon: ReactNode; title: string; text: string; bullets: string[] }> = {
  merchant: {
    icon: <Store className="size-6" />,
    title: 'Sou lojista',
    text: 'Tenho um comércio e quero controlar o fiado dos meus clientes.',
    bullets: ['Limite de crédito por cliente', 'Quem deve quanto', 'Lembretes de cobrança'],
  },
  customer: {
    icon: <UserRound className="size-6" />,
    title: 'Sou cliente',
    text: 'Compro fiado e quero acompanhar o que devo.',
    bullets: ['Saldo devedor sempre à mão', 'Limite disponível', 'Histórico de compras'],
  },
};

export function OnboardingPage() {
  const me = useMe();
  const { user } = useAuth();
  const navigate = useNavigate();
  const createProfile = useCreateProfile();
  const [role, setRole] = useState<Role | null>(null);
  const [storeName, setStoreName] = useState('');

  if (me.isPending) return <FullPageSpinner />;
  if (me.data?.profile) return <Navigate to={homeFor(me.data.profile.role)} replace />;

  const firstName = user?.displayName?.split(' ')[0];

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    createProfile.mutate(role === 'merchant' ? { role, storeName } : { role }, {
      onSuccess: () => navigate(homeFor(role), { replace: true }),
    });
  }

  return (
    <div className="min-h-dvh bg-dotted">
      <header className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <UserMenu />
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4 pb-16 sm:px-6 sm:pt-10">
        <div className="animate-fade-up">
          <p className="font-hand text-2xl text-brand-600">Que bom te ver{firstName ? `, ${firstName}` : ''}!</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            Como você vai usar o Cadernin?
          </h1>
          <p className="mt-2 text-stone-500">Escolha uma vez. Isso define o que você vê no aplicativo.</p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <div role="radiogroup" aria-label="Perfil" className="grid animate-fade-up gap-4 [animation-delay:80ms] sm:grid-cols-2">
            {ROLES.map((r) => {
              const o = OPTIONS[r];
              const selected = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={o.title}
                  onClick={() => setRole(r)}
                  className={cx(
                    'relative flex flex-col rounded-[24px] border-2 bg-white p-6 text-left shadow-card transition',
                    selected
                      ? 'border-brand-500 ring-4 ring-brand-100'
                      : 'border-transparent hover:-translate-y-0.5 hover:shadow-lift',
                  )}
                >
                  <span
                    className={cx(
                      'absolute top-5 right-5 grid size-6 place-items-center rounded-full border-2 transition',
                      selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300',
                    )}
                    aria-hidden
                  >
                    {selected && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span
                    className={cx(
                      'grid size-12 place-items-center rounded-2xl transition',
                      selected ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-700',
                    )}
                  >
                    {o.icon}
                  </span>
                  <span className="mt-4 text-lg font-extrabold">{o.title}</span>
                  <span className="mt-1 text-sm text-stone-500">{o.text}</span>
                  <ul className="mt-4 space-y-1.5">
                    {o.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-sm text-stone-600">
                        <Check className="size-4 text-brand-500" aria-hidden /> {b}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {role === 'merchant' && (
            <div className="animate-fade-up rounded-[24px] border border-stone-200/70 bg-white p-6 shadow-card">
              <Field label="Nome da sua loja" hint="Aparece para seus clientes. Dá para mudar depois.">
                {(p) => (
                  <TextInput
                    {...p}
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ex.: Mercadinho da Maria"
                    maxLength={80}
                    autoFocus
                    required
                    minLength={2}
                  />
                )}
              </Field>
            </div>
          )}

          {createProfile.isError && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {createProfile.error.message}
            </p>
          )}

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-stone-400">O perfil não pode ser trocado depois nesta versão.</p>
            <Button
              type="submit"
              size="lg"
              disabled={!role || (role === 'merchant' && storeName.trim().length < 2)}
              loading={createProfile.isPending}
            >
              {role === 'merchant' ? 'Criar minha loja' : role === 'customer' ? 'Continuar' : 'Escolha um perfil'}
              {!createProfile.isPending && <ArrowRight className="size-5" aria-hidden />}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
