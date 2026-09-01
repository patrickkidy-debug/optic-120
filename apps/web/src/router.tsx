import { LOCALES } from './lib/locale-resolve';
import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth, RequirePermission } from './components/RouteGuards';
import { PageLoader } from './components/ui';
import { useAuthStore } from './store/auth';
import { named } from './lib/lazyChunk';

/**
 * Pages chargées à la demande (code-splitting) : seul le code de la page
 * visitée est téléchargé, ce qui allège fortement le bundle initial (les
 * dépendances lourdes comme chart.js ne se chargent que sur le dashboard).
 * `named` protège contre les chunks obsolètes après déploiement — voir lib/lazyChunk.ts.
 */

// La coquille applicative (barre latérale, top-bar, bannières, chat support +
// leurs icônes) n'est chargée que pour les routes protégées : les pages
// publiques (accueil, connexion) restent ainsi plus légères.
const AppShell = lazy(() => named(import('./components/layout/AppShell'), 'AppShell'));
const LandingPage = lazy(() => named(import('./pages/LandingPage'), 'LandingPage'));
const LoginPage = lazy(() => named(import('./pages/auth/LoginPage'), 'LoginPage'));
const SignupPage = lazy(() => named(import('./pages/auth/SignupPage'), 'SignupPage'));
const ForgotPasswordPage = lazy(() => named(import('./pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => named(import('./pages/auth/ResetPasswordPage'), 'ResetPasswordPage'));
const VerifyEmailPage = lazy(() => named(import('./pages/auth/VerifyEmailPage'), 'VerifyEmailPage'));
const DashboardPage = lazy(() => named(import('./pages/DashboardPage'), 'DashboardPage'));
const DemoCompletePage = lazy(() => named(import('./pages/demo/DemoCompletePage'), 'DemoCompletePage'));
const DemoVideosPage = lazy(() => named(import('./pages/demo/DemoVideosPage'), 'DemoVideosPage'));
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
const CashRegisterPage = lazy(() => named(import('./pages/optique/CashRegisterPage'), 'CashRegisterPage'));
const RolesPage = lazy(() => named(import('./pages/settings/RolesPage'), 'RolesPage'));
const UsersPage = lazy(() => named(import('./pages/settings/UsersPage'), 'UsersPage'));
const BranchesPage = lazy(() => named(import('./pages/settings/BranchesPage'), 'BranchesPage'));
const PaymentsPage = lazy(() => named(import('./pages/settings/PaymentsPage'), 'PaymentsPage'));
const AuditPage = lazy(() => named(import('./pages/settings/AuditPage'), 'AuditPage'));
const ProfilePage = lazy(() => named(import('./pages/settings/ProfilePage'), 'ProfilePage'));
const SubscriptionPage = lazy(() => named(import('./pages/settings/SubscriptionPage'), 'SubscriptionPage'));
const StoreSetupPage = lazy(() => named(import('./pages/settings/StoreSetupPage'), 'StoreSetupPage'));
const PlatformPage = lazy(() => named(import('./pages/platform/PlatformPage'), 'PlatformPage'));
const CrmPage = lazy(() => named(import('./pages/platform/CrmPage'), 'CrmPage'));
const NotFound = lazy(() => named(import('./pages/NotFound'), 'NotFound'));
const SupportPage = lazy(() => named(import('./pages/SupportPage'), 'SupportPage'));
const ClinicDashboardPage = lazy(() => named(import('./pages/clinic/ClinicDashboardPage'), 'ClinicDashboardPage'));
const PatientsPage = lazy(() => named(import('./pages/clinic/PatientsPage'), 'PatientsPage'));
const ConsultationsPage = lazy(() => named(import('./pages/clinic/ConsultationsPage'), 'ConsultationsPage'));
const AppointmentsPage = lazy(() => named(import('./pages/clinic/AppointmentsPage'), 'AppointmentsPage'));
const SurgeriesPage = lazy(() => named(import('./pages/clinic/SurgeriesPage'), 'SurgeriesPage'));
const EmployeesPage = lazy(() => named(import('./pages/management/EmployeesPage'), 'EmployeesPage'));
const FinancePage = lazy(() => named(import('./pages/management/FinancePage'), 'FinancePage'));
const SuppliersPage = lazy(() => named(import('./pages/management/SuppliersPage'), 'SuppliersPage'));
const ReceivablesPage = lazy(() => named(import('./pages/management/ReceivablesPage'), 'ReceivablesPage'));
const ReportsPage = lazy(() => named(import('./pages/management/ReportsPage'), 'ReportsPage'));
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

/**
 * Vrai dans l'application mobile empaquetée (Capacitor). La vitrine
 * marketing n'y a pas sa place : celui qui a installé l'app veut se connecter.
 */
function isNativeApp(): boolean {
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() ?? false;
}

/** Accueil : vitrine sur le web, écran de connexion dans l'app mobile. */
function Home() {
  if (isNativeApp()) return <Navigate to="/login" replace />;
  return <PublicOnly>{pub(<LandingPage />)}</PublicOnly>;
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
  { path: '/', element: <Home /> },
  // URLs localisees : cibles canoniques du hreflang. Un lien /pt partage sur
  // WhatsApp doit ouvrir la vitrine en portugais, quel que soit le visiteur.
  ...LOCALES.map((l) => ({
    path: `/${l.code}`,
    element: <PublicOnly>{pub(<LandingPage />)}</PublicOnly>,
  })),
  { path: '/login', element: <PublicOnly>{pub(<LoginPage />)}</PublicOnly> },
  { path: '/signup', element: <PublicOnly>{pub(<SignupPage />)}</PublicOnly> },
  { path: '/forgot-password', element: <PublicOnly>{pub(<ForgotPasswordPage />)}</PublicOnly> },
  { path: '/reset-password', element: pub(<ResetPasswordPage />) },
  { path: '/verifier-email', element: pub(<VerifyEmailPage />) },
  {
    element: <RequireAuth />,
    children: [
      {
        element: pub(<AppShell />),
        children: [
          { path: '/dashboard', element: perm('dashboard.view', <DashboardPage />) },
          { path: '/configuration-boutique', element: perm('dashboard.view', <StoreSetupPage />) },
          { path: '/onboarding/complete', element: perm('dashboard.view', <DemoCompletePage />) },
          { path: '/demo/videos', element: perm('dashboard.view', <DemoVideosPage />) },
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
          { path: '/optique/caisse-session', element: perm('optique.cashregister.view', <CashRegisterPage />) },
          { path: '/parametres/roles', element: perm('rbac.roles.view', <RolesPage />) },
          { path: '/parametres/utilisateurs', element: perm('rbac.users.view', <UsersPage />) },
          { path: '/parametres/magasins', element: perm('settings.branches.view', <BranchesPage />) },
          { path: '/parametres/paiements', element: perm('settings.payments.view', <PaymentsPage />) },
          { path: '/parametres/journal', element: perm('audit.logs.view', <AuditPage />) },
          { path: '/parametres/abonnement', element: perm('billing.view', <SubscriptionPage />) },
          { path: '/parametres/profil', element: <ProfilePage /> },
          { path: '/aide', element: <SupportPage /> },
          { path: '/plateforme', element: <OperatorOnly><PlatformPage /></OperatorOnly> },
          { path: '/plateforme/crm', element: <OperatorOnly><CrmPage /></OperatorOnly> },

          { path: '/clinique/dashboard', element: perm('clinic.patients.view', <ClinicDashboardPage />) },
          { path: '/clinique/patients', element: perm('clinic.patients.view', <PatientsPage />) },
          { path: '/clinique/consultations', element: perm('clinic.consultations.view', <ConsultationsPage />) },
          { path: '/clinique/rendez-vous', element: perm('clinic.appointments.view', <AppointmentsPage />) },
          { path: '/clinique/chirurgies', element: perm('clinic.surgeries.view', <SurgeriesPage />) },

          { path: '/gestion/personnel', element: perm('hr.employees.view', <EmployeesPage />) },
          { path: '/gestion/creances', element: perm('optique.sales.view', <ReceivablesPage />) },
          { path: '/gestion/rapports', element: perm('optique.sales.view', <ReportsPage />) },
          { path: '/gestion/finance', element: perm('finance.expenses.view', <FinancePage />) },
          { path: '/gestion/fournisseurs', element: perm('suppliers.view', <SuppliersPage />) },
          { path: '/gestion/assurances', element: perm('insurance.view', <InsurancePage />) },

          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);
