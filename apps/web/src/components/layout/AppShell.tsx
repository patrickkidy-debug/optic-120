import { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { EmailVerifyBanner } from '../EmailVerifyBanner';
import { TrialBanner } from '../TrialBanner';
import { PageLoader } from '../ui';
import { useUIStore } from '../../store/ui';
import { useAuthStore } from '../../store/auth';
import { prefetchRoute } from '../../lib/routePrefetch';

const IDLE_MS = 10 * 60 * 1000; // verrouillage après 10 min d'inactivité

export function AppShell() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebar = useUIStore((s) => s.setSidebar);

  // Préchargement en tâche de fond (quand le navigateur est libre) des pages les
  // plus consultées → premières navigations instantanées, sans gêner le rendu.
  useEffect(() => {
    const ric =
      window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const id = ric(() => {
      ['/dashboard', '/optique/caisse', '/optique/ventes', '/optique/clients'].forEach(
        prefetchRoute,
      );
    });
    return () => window.cancelIdleCallback?.(id as number);
  }, []);

  useEffect(() => {
    let timer: number;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => useAuthStore.getState().setLocked(true), IDLE_MS);
    };
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-bg-subtle lg:block">
        <Sidebar />
      </aside>

      <div className={clsx('fixed inset-0 z-40 lg:hidden', !sidebarOpen && 'pointer-events-none')}>
        <div
          className={clsx(
            'absolute inset-0 bg-black/50 transition-opacity',
            sidebarOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setSidebar(false)}
        />
        <aside
          className={clsx(
            'absolute inset-y-0 left-0 w-64 border-r bg-bg-subtle shadow-card-lg transition-transform',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar />
        </aside>
      </div>

      <div className="lg:pl-64">
        <Topbar />
        <TrialBanner />
        <EmailVerifyBanner />
        <main className="mx-auto max-w-7xl animate-fade-in px-4 py-6 sm:px-6">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
