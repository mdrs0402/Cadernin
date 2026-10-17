import { BellRing, ShieldCheck, Store, UserRound, WalletCards } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { GoogleButton } from '../components/GoogleButton';
import { Logo } from '../components/Logo';
import { NotebookPreview } from '../components/NotebookPreview';
import { FullPageSpinner } from '../components/ui';

export function LoginPage() {
  const { user, initializing, signInWithGoogle } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (initializing) return <FullPageSpinner />;
  if (user) return <Navigate to="/" replace />;

  async function handleLogin() {
    setPending(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-blocked') {
        setError('O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo.');
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError('Não foi possível entrar com o Google. Verifique sua conexão e tente de novo.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ---------- Lado da marca ---------- */}
      <section className="relative isolate overflow-hidden bg-brand-900 px-6 pt-10 pb-24 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <Decor />

        <Logo tone="light" />

        <div className="mt-10 max-w-xl lg:mt-0">
          <h1 className="text-[32px] leading-[1.1] font-extrabold tracking-tight text-balance sm:text-5xl">
            Caderninho do fiado,{' '}
            <span className="relative whitespace-nowrap text-accent-400">
              agora digitalmente!
              <svg viewBox="0 0 220 12" preserveAspectRatio="none" className="absolute -bottom-3 left-0 h-3 w-full" aria-hidden>
                <path d="M2 9C60 3 150 2 218 7" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </span>
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-brand-100/85">
            Compras e pagamentos anotados com transparência, limite de crédito para cada cliente e lembretes antes do
            vencimento.
          </p>

          <ul className="mt-8 hidden gap-4 sm:grid sm:grid-cols-3 lg:max-w-xl">
            <Feature icon={<WalletCards className="size-5" />} title="Limite por cliente" />
            <Feature icon={<ShieldCheck className="size-5" />} title="Nada se apaga" />
            <Feature icon={<BellRing className="size-5" />} title="Lembrete de cobrança" />
          </ul>
        </div>

        <NotebookPreview className="mx-auto mt-14 hidden w-full max-w-md animate-float lg:block" />
      </section>

      {/* ---------- Lado do login ---------- */}
      <main className="relative -mt-14 flex justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:bg-dotted lg:px-10">
        <div className="w-full max-w-md animate-fade-up rounded-[28px] bg-white p-7 shadow-lift sm:p-9 lg:shadow-card">
          <p className="font-hand text-2xl text-brand-600">Bem-vindo!</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Entre para abrir seu caderno</h2>
          <p className="mt-2 text-[15px] text-stone-500">Use sua conta Google. É rápido e você não precisa criar senha.</p>

          <div className="mt-8">
            <GoogleButton loading={pending} onClick={handleLogin} />
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="my-8 flex items-center gap-3 text-xs font-semibold tracking-wider text-stone-400 uppercase">
            <span className="h-px flex-1 bg-stone-200" />
            Para quem é
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Audience
              icon={<Store className="size-5" />}
              title="Lojista"
              text="Controle limites, quem deve e o caixa."
            />
            <Audience
              icon={<UserRound className="size-5" />}
              title="Cliente"
              text="Veja o que deve e quanto ainda pode comprar."
            />
          </div>
          <p className="mt-6 text-center text-xs text-stone-400">Você escolhe seu perfil logo depois de entrar.</p>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/10 backdrop-blur">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-400 text-brand-950">{icon}</span>
      <span className="text-sm leading-tight font-semibold">{title}</span>
    </li>
  );
}

function Audience({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-paper/60 p-4">
      <span className="grid size-9 place-items-center rounded-xl bg-brand-100 text-brand-700">{icon}</span>
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-stone-500">{text}</p>
    </div>
  );
}

function Decor() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      <div className="absolute -top-32 -right-24 size-[28rem] rounded-full bg-brand-600/40 blur-3xl" />
      <div className="absolute -bottom-40 -left-20 size-[26rem] rounded-full bg-brand-950/60 blur-3xl" />
      <div className="absolute inset-0 bg-ruled opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
    </div>
  );
}
