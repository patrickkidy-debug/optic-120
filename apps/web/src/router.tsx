import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth, RequirePermission } from './components/RouteGuards';
import { AppShell } from './components/layout/AppShell';
import { PageLoader } from './components/ui';
import { useAuthStore } from './store/auth';

/**
 * Pages chargées à la demande (code-splitting) : seul le code de la page
 * visitée est téléchargé, ce qui allège fortement le bundle initial (les
 * dépendances lourdes comme chart.js ne se chargent que sur le dashboard).
 */
/**
 * Après un nouveau déploiement, l'ancien index.html chargé en mémoire référence
 * d'anciens chunks (hash) qui n'existent plus → « Failed to fetch dynamically
 * imported module ». On recharge alors la page UNE fois pour récupérer le
 * nouvel index et les nouveaux chunks (garde anti-boucle de 10 s).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onChunkError(err: unknown): Promise<any> {
  const k = 'oculo-chunk-reload';
  const last = Number(sessionStorage.getItem(k) || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(k, String(Date.now()));
    window.location.reload();
    // Promesse jamais résolue : suspend le rendu le temps du rechargement.
    return new Promise(() => {});
  }
  throw err;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const named = (p: Promise<any>, key: string) =>
  p.then((m) => ({ default: m[key] })).catch(onChunkError);

const LandingPage = lazy(() => named(import('./pages/LandingPage'), 'LandingPage'));
const LoginPage = lazy(() => named(import('./pages/auth/LoginPage'), 'LoginPage'));
const SignupPage = lazy(() => named(import('./pages/auth/SignupPage'), 'SignupPage'));
const ForgotPasswordPage = lazy(() => named(import('./pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => named(import('./pages/auth/ResetPasswordPage'), 'ResetPasswordPage'));
const VerifyEmailPage = lazy(() => named(import('./pages/auth/VerifyEmailPage'), 'VerifyEmailPage'));
const DashboardPage = lazy(() => named(import('./pages/DashboardPage'), 'DashboardPage'));
const ProductsPage = lazy(() => named(import('./pages/optique/ProductsPage'), 'ProductsPage'));
const StockPage = lazy(() => named(import('./pages/optique/StockPage'), 'StockPage'));
const ClientsPage = lazy(() => named(import('./pages/optique/ClientsPage'), 'ClientsPage'));
const PosPage = lazy(() => named(import('./pages/optique/PosPage'), 'PosPage'));
const SalesPage = lazy(() => named(import('./pages/optique/SalesPage'), 'SalesPage')) as LazyExoticComponent<
  ComponentType<{ kind: 'SALE' | 'QUOTE' }>
>;
const LensOrdersPage = lazy(() => named(import('./pages/optique/LensOrdersPage'), 'LensOrdersPage'));
const RepairsPage = lazy(() => named(import('./pages/optique/RepairsPage'), 'RepairsPage'));
const RenewalsPage = lazy(() => named(import('./pages/optique/RenewalsPage'), 'RenewalsPage'));
const LabelsPage = lazy(() => named(import('./pages/optique/LabelsPage'), 'LabelsPage'));
const RolesPage = lazy(() => named(import('./pages/settings/RolesPage'), 'RolesPage'));
const UsersPage = lazy(() => named(import('./pages/settings/UsersPage'), 'UsersPage'));
const BranchesPage = lazy(() => named(import('./pages/settings/BranchesPage'), 'BranchesPage'));
const PaymentsPage = lazy(() => named(import('./pages/settings/PaymentsPage'), 'PaymentsPage'));
const AuditPage = lazy(() => named(import('./pages/settings/AuditPage'), 'AuditPage'));
const ProfilePage = lazy(() => named(import('./pages/settings/ProfilePage'), 'ProfilePage'));
const SubscriptionPage = lazy(() => named(import('./pages/settings/SubscriptionPage'), 'SubscriptionPage'));
const PlatformPage = lazy(() => named(import('./pages/platform/PlatformPage'), 'PlatformPage'));
const NotFound = lazy(() => named(import('./pages/NotFound'), 'NotFound'));
const SupportPage = lazy(() => named(import('./pages/SupportPage'), 'SupportPage'));
const PatientsPage = lazy(() => named(import('./pages/clinic/PatientsPage'), 'PatientsPage'));
const ConsultationsPage = lazy(() => named(import('./pages/clinic/ConsultationsPage'), 'ConsultationsPage'));
const AppointmentsPage = lazy(() => named(import('./pages/clinic/AppointmentsPage'), 'AppointmentsPage'));
const SurgeriesPage = lazy(() => named(import('./pages/clinic/SurgeriesPage'), 'SurgeriesPage'));
const EmployeesPage = lazy(() => named(import('./pages/management/EmployeesPage'), 'EmployeesPage'));
const FinancePage = lazy(() => named(import('./pages/management/FinancePage'), 'FinancePage'));
const SuppliersPage = lazy(() => named(import('./pages/management/SuppliersPage'), 'SuppliersPage'));
const InsurancePage = lazy(() => named(import('./pages/management/InsurancePage'), 'InsurancePage'));

/** Enveloppe les pages publiques (hors AppShell) dans un Suspense. */
function pub(el: ReactNode) {
  return <Suspense fallback={<PageLoader />}>{el}</Suspense>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function perm(permission: string, el: ReactNode) {
  return <RequirePermission permission={permission}>{el}</RequirePermission>;
}

/** Réservé à l'éditeur du SaaS (console plateforme). */
function OperatorOnly({ children }: { children: ReactNode }) {
  const isOperator = useAuthStore((s) => s.user?.isPlatformOperator ?? false);
  if (!isOperator) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/', element: <PublicOnly>{pub(<LandingPage />)}</PublicOnly> },
  { path: '/login', element: <PublicOnly>{pub(<LoginPage />)}</PublicOnly> },
  { path: '/signup', element: <PublicOnly>{pub(<SignupPage />)}</PublicOnly> },
  { path: '/forgot-password', element: <PublicOnly>{pub(<ForgotPasswordPage />)}</PublicOnly> },
  { path: '/reset-password', element: pub(<ResetPasswordPage />) },
  { path: '/verifier-email', element: pub(<VerifyEmailPage />) },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: perm('dashboard.view', <DashboardPage />) },
          { path: '/optique/produits', element: perm('optique.products.view', <ProductsPage />) },
          { path: '/optique/stock', element: perm('optique.stock.view', <StockPage />) },
          { path: '/optique/clients', element: perm('optique.customers.view', <ClientsPage />) },
          { path: '/optique/caisse', element: perm('optique.sales.create', <PosPage />) },
          { path: '/optique/ventes', element: perm('optique.sales.view', <SalesPage kind="SALE" />) },
          { path: '/optique/devis', element: perm('optique.quotes.view', <SalesPage kind="QUOTE" />) },
          { path: '/optique/commandes-verres', element: perm('optique.sales.view', <LensOrdersPage />) },
          { path: '/optique/reparations', element: perm('optique.sales.view', <RepairsPage />) },
          { path: '/optique/renouvellements', element: perm('optique.customers.view', <RenewalsPage />) },
          { path: '/optique/etiquettes', element: perm('optique.products.view', <LabelsPage />) },
          { path: '/parametres/roles', element: perm('rbac.roles.view', <RolesPage />) },
          { path: '/parametres/utilisateurs', element: perm('rbac.users.view', <UsersPage />) },
          { path: '/parametres/magasins', element: perm('settings.branches.view', <BranchesPage />) },
          { path: '/parametres/paiements', element: perm('settings.payments.view', <PaymentsPage />) },
          { path: '/parametres/journal', element: perm('audit.logs.view', <AuditPage />) },
          { path: '/parametres/abonnement', element: perm('billing.view', <SubscriptionPage />) },
          { path: '/parametres/profil', element: <ProfilePage /> },
          { path: '/aide', element: <SupportPage /> },
          { path: '/plateforme', element: <OperatorOnly><PlatformPage /></OperatorOnly> },

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
