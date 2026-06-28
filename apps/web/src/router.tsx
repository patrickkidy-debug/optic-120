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
import { ClientsPage } from './pages/optique/ClientsPage';
import { PosPage } from './pages/optique/PosPage';
import { SalesPage } from './pages/optique/SalesPage';
import { RolesPage } from './pages/settings/RolesPage';
import { UsersPage } from './pages/settings/UsersPage';
import { BranchesPage } from './pages/settings/BranchesPage';
import { PaymentsPage } from './pages/settings/PaymentsPage';
import { AuditPage } from './pages/settings/AuditPage';
import { ProfilePage } from './pages/settings/ProfilePage';
import { NotFound } from './pages/NotFound';
import { PatientsPage } from './pages/clinic/PatientsPage';
import { ConsultationsPage } from './pages/clinic/ConsultationsPage';
import { AppointmentsPage } from './pages/clinic/AppointmentsPage';
import { SurgeriesPage } from './pages/clinic/SurgeriesPage';
import { EmployeesPage } from './pages/management/EmployeesPage';
import { FinancePage } from './pages/management/FinancePage';
import { SuppliersPage } from './pages/management/SuppliersPage';
import { InsurancePage } from './pages/management/InsurancePage';

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
          { path: '/optique/clients', element: perm('optique.customers.view', <ClientsPage />) },
          { path: '/optique/caisse', element: perm('optique.sales.create', <PosPage />) },
          { path: '/optique/ventes', element: perm('optique.sales.view', <SalesPage kind="SALE" />) },
          { path: '/optique/devis', element: perm('optique.quotes.view', <SalesPage kind="QUOTE" />) },
          { path: '/parametres/roles', element: perm('rbac.roles.view', <RolesPage />) },
          { path: '/parametres/utilisateurs', element: perm('rbac.users.view', <UsersPage />) },
          { path: '/parametres/magasins', element: perm('settings.branches.view', <BranchesPage />) },
          { path: '/parametres/paiements', element: perm('settings.payments.view', <PaymentsPage />) },
          { path: '/parametres/journal', element: perm('audit.logs.view', <AuditPage />) },
          { path: '/parametres/profil', element: <ProfilePage /> },

          { path: '/clinique/patients', element: perm('clinic.patients.view', <PatientsPage />) },
          { path: '/clinique/consultations', element: perm('clinic.consultations.view', <ConsultationsPage />) },
          { path: '/clinique/rendez-vous', element: perm('clinic.appointments.view', <AppointmentsPage />) },
          { path: '/clinique/chirurgies', element: perm('clinic.surgeries.view', <SurgeriesPage />) },

          { path: '/gestion/personnel', element: perm('hr.employees.view', <EmployeesPage />) },
          { path: '/gestion/finance', element: perm('finance.expenses.view', <FinancePage />) },
          { path: '/gestion/fournisseurs', element: perm('suppliers.view', <SuppliersPage />) },
          { path: '/gestion/assurances', element: perm('insurance.view', <InsurancePage />) },

          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);
