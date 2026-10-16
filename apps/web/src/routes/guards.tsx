import type { MeResponse, Role } from '@cadernin/shared';
import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router';
import { useMe } from '../api/me';
import { useAuth } from '../auth/AuthProvider';
import { ErrorState, FullPageSpinner } from '../components/ui';

export const homeFor = (role: Role) => (role === 'merchant' ? '/loja' : '/conta');

/** Só deixa passar usuário logado; senão manda para /entrar. */
export function RequireAuth() {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <FullPageSpinner />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function MeGate({ children }: { children: (me: MeResponse) => React.ReactNode }) {
  const me = useMe();
  if (me.isPending) return <FullPageSpinner />;
  if (me.isError)
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <ErrorState title="Não conseguimos abrir seu caderno" message={me.error.message} onRetry={() => me.refetch()} />
      </div>
    );
  return <>{children(me.data)}</>;
}

/** "/" manda cada um para sua área (ou para a escolha de perfil). */
export function RoleRedirect() {
  return <MeGate>{(me) => <Navigate to={me.profile ? homeFor(me.profile.role) : '/bem-vindo'} replace />}</MeGate>;
}

/** Área restrita a um papel. A checagem de verdade é no backend; aqui é só navegação. */
export function RequireRole({ role }: { role: Role }) {
  return (
    <MeGate>
      {(me) => {
        if (!me.profile) return <Navigate to="/bem-vindo" replace />;
        if (me.profile.role !== role) return <Navigate to={homeFor(me.profile.role)} replace />;
        return <Outlet context={me} />;
      }}
    </MeGate>
  );
}

/** Dados de /me já carregados pelo RequireRole. */
export const useMeContext = () => useOutletContext<MeResponse>();
