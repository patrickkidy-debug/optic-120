import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, Wallet, Share2, LogOut, Sparkles } from 'lucide-react';
import { usePartnerAuthStore } from '../store/auth';
import { logoutPartner } from '../lib/partnerApi';

const NAV = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/prospects', label: 'Prospects', icon: Users },
  { to: '/clients', label: 'Clients', icon: Building2 },
  { to: '/commissions', label: 'Commissions', icon: Wallet },
  { to: '/partager', label: 'Partager', icon: Share2 },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary shadow-glow">
        <Sparkles className="h-5 w-5 text-white" />
      </span>
      <div>
        <p className="font-display text-base font-bold text-content">OculoPartners</p>
        <p className="text-xs text-content-faint">Espace partenaire</p>
      </div>
    </div>
  );
}

async function handleLogout(clear: () => void) {
  try {
    await logoutPartner();
  } finally {
    clear();
  }
}

/**
 * Coquille de l'app : barre latérale fixe sur desktop (lg+), en-tête + navigation
 * basse sur mobile — priorité au pouce, comme demandé pour le programme
 * partenaire (« en moins de 10 secondes »).
 */
export function Layout() {
  const partner = usePartnerAuthStore((s) => s.partner);
  const clear = usePartnerAuthStore((s) => s.clear);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Barre latérale (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[260px] flex-col border-r bg-bg-subtle py-6 lg:flex">
        <div className="px-5">
          <Brand />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `side-nav-link ${isActive ? 'side-nav-link-active' : ''}`}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t px-3 pt-3">
          {partner && (
            <p className="truncate px-4 pb-2 text-xs text-content-faint">{partner.firstName} {partner.lastName}</p>
          )}
          <button onClick={() => handleLogout(clear)} className="side-nav-link w-full text-danger hover:bg-danger/10">
            <LogOut className="h-[18px] w-[18px]" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-[260px]">
        {/* En-tête (mobile uniquement) */}
        <header className="flex items-center justify-between border-b bg-surface px-4 py-3 lg:hidden">
          <Brand />
          <button onClick={() => handleLogout(clear)} className="btn-ghost h-9 w-9 rounded-lg p-0" aria-label="Déconnexion">
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="pb-20 lg:pb-8">
          <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Navigation basse (mobile uniquement) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
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
