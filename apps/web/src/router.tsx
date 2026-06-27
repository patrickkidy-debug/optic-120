import { type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth, RequirePermission } from './components/RouteGuards';
import { AppShell } from './components/layout/AppShell';
import { useAuthStore } from './store/auth';

import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/optique/ProductsPage';
import { StockPage } from './pages/optique/StockPage';
import { PosPage } from './pages/optique/PosPage';
import { SalesPage } from './pages/optique/SalesPage';
import { RolesPage } from './pages/settings/RolesPage';
import { UsersPage } from './pages/settings/UsersPage';
import { BranchesPage } from './pages/settings/BranchesPage';
import { PaymentsPage } from './pages/settings/PaymentsPage';
import { AuditPage } from './pages/settings/AuditPage';
import { ProfilePage } from './pages/settings/ProfilePage';
import { ComingSoon } from './pages/ComingSoon';
import { NotFound } from './pages/NotFound';

function PublicOnly({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function perm(permission: string, el: ReactNode) {
  return <RequirePermission permission={permission}>{el}</RequirePermission>;
}

export const router = createBrowserRouter([
  { path: '/login', element: <PublicOnly><LoginPage /></PublicOnly> },
  { path: '/signup', element: <PublicOnly><SignupPage /></PublicOnly> },
  { path: '/forgot-password', element: <PublicOnly><ForgotPasswordPage /></PublicOnly> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: perm('dashboard.view', <DashboardPage />) },
          { path: '/optique/produits', element: perm('optique.products.view', <ProductsPage />) },
          { path: '/optique/stock', element: perm('optique.stock.view', <StockPage />) },
          { path: '/optique/caisse', element: perm('optique.sales.create', <PosPage />) },
          { path: '/optique/ventes', element: perm('optique.sales.view', <SalesPage kind="SALE" />) },
          { path: '/optique/devis', element: perm('optique.quotes.view', <SalesPage kind="QUOTE" />) },
          { path: '/parametres/roles', element: perm('rbac.roles.view', <RolesPage />) },
          { path: '/parametres/utilisateurs', element: perm('rbac.users.view', <UsersPage />) },
          { path: '/parametres/magasins', element: perm('settings.branches.view', <BranchesPage />) },
          { path: '/parametres/paiements', element: perm('settings.payments.view', <PaymentsPage />) },
          { path: '/parametres/journal', element: perm('audit.logs.view', <AuditPage />) },
          { path: '/parametres/profil', element: <ProfilePage /> },
          { path: '/clinique/*', element: <ComingSoon /> },
          { path: '/gestion/*', element: <ComingSoon /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);
