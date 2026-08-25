import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { usePartnerAuthStore } from './store/auth';
import { PageLoader } from './components/ui';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { CustomersPage } from './pages/CustomersPage';
import { CommissionsPage } from './pages/CommissionsPage';
import { SharePage } from './pages/SharePage';

function RequirePartnerAuth() {
  const status = usePartnerAuthStore((s) => s.status);
  const { pathname } = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (status === 'unauthenticated') {
    return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  }
  return <Outlet />;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const status = usePartnerAuthStore((s) => s.status);
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/login', element: <RedirectIfAuthed><LoginPage /></RedirectIfAuthed> },
  { path: '/inscription', element: <RedirectIfAuthed><SignupPage /></RedirectIfAuthed> },
  {
    element: <RequirePartnerAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/prospects', element: <LeadsPage /> },
          { path: '/clients', element: <CustomersPage /> },
          { path: '/commissions', element: <CommissionsPage /> },
          { path: '/partager', element: <SharePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
