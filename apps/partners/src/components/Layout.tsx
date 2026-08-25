import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, Wallet, Share2, LogOut } from 'lucide-react';
import { usePartnerAuthStore } from '../store/auth';
import { logoutPartner } from '../lib/partnerApi';

const NAV = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/prospects', label: 'Prospects', icon: Users },
  { to: '/clients', label: 'Clients', icon: Building2 },
  { to: '/commissions', label: 'Commissions', icon: Wallet },
  { to: '/partager', label: 'Partager', icon: Share2 },
];

/**
 * Coquille mobile-first : navigation basse (pouce), toujours visible, cinq
 * actions clés accessibles en un tap — priorité du programme partenaire
 * (voir doc OculoPartners : « en moins de 10 secondes »).
 */
export function Layout() {
  const partner = usePartnerAuthStore((s) => s.partner);
  const clear = usePartnerAuthStore((s) => s.clear);

  async function handleLogout() {
    try {
      await logoutPartner();
    } finally {
      clear();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b bg-surface px-4 py-3">
        <div>
          <p className="font-display text-sm font-bold text-content">OculoPartners</p>
          {partner && <p className="text-xs text-content-faint">{partner.firstName} {partner.lastName}</p>}
        </div>
        <button onClick={handleLogout} className="btn-ghost h-8 w-8 rounded-lg p-0" aria-label="Déconnexion">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-surface pb-[env(safe-area-inset-bottom)]">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `bottom-nav-link ${isActive ? 'bottom-nav-link-active' : ''}`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
