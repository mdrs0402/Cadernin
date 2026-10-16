import { BellRing, House, Settings2, Users } from 'lucide-react';
import { Outlet } from 'react-router';
import { AppShell, type NavItem } from '../../components/AppShell';
import { useMeContext } from '../../routes/guards';

const NAV: NavItem[] = [
  { to: '/loja', label: 'Início', icon: House, end: true },
  { to: '/loja/clientes', label: 'Clientes', icon: Users },
  { to: '/loja/lembretes', label: 'Lembretes', icon: BellRing },
  { to: '/loja/ajustes', label: 'Loja', icon: Settings2 },
];

export function MerchantLayout() {
  const me = useMeContext();
  return (
    <AppShell nav={NAV} context={me.store?.name}>
      <Outlet context={me} />
    </AppShell>
  );
}
