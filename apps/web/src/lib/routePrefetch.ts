/**
 * Préchargement des chunks de route au survol/focus d'un lien de navigation :
 * le code de la page est téléchargé AVANT le clic, rendant la navigation quasi
 * instantanée (plus d'écran de chargement à chaque changement de page).
 *
 * Les `import()` ci-dessous ciblent exactement les mêmes modules que le routeur
 * (router.tsx) : Vite les dédoublonne en un seul chunk partagé. Précharger ici
 * réchauffe donc le cache que `lazy()` lira ensuite instantanément.
 */
const loaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../pages/DashboardPage'),
  '/optique/produits': () => import('../pages/optique/ProductsPage'),
  '/optique/stock': () => import('../pages/optique/StockPage'),
  '/optique/clients': () => import('../pages/optique/ClientsPage'),
  '/optique/caisse': () => import('../pages/optique/PosPage'),
  '/optique/ventes': () => import('../pages/optique/SalesPage'),
  '/optique/devis': () => import('../pages/optique/SalesPage'),
  '/optique/commandes-verres': () => import('../pages/optique/LensOrdersPage'),
  '/optique/reparations': () => import('../pages/optique/RepairsPage'),
  '/parametres/roles': () => import('../pages/settings/RolesPage'),
  '/parametres/utilisateurs': () => import('../pages/settings/UsersPage'),
  '/parametres/magasins': () => import('../pages/settings/BranchesPage'),
  '/parametres/paiements': () => import('../pages/settings/PaymentsPage'),
  '/parametres/journal': () => import('../pages/settings/AuditPage'),
  '/parametres/abonnement': () => import('../pages/settings/SubscriptionPage'),
  '/parametres/profil': () => import('../pages/settings/ProfilePage'),
  '/aide': () => import('../pages/SupportPage'),
  '/plateforme': () => import('../pages/platform/PlatformPage'),
  '/clinique/patients': () => import('../pages/clinic/PatientsPage'),
  '/clinique/consultations': () => import('../pages/clinic/ConsultationsPage'),
  '/clinique/rendez-vous': () => import('../pages/clinic/AppointmentsPage'),
  '/clinique/chirurgies': () => import('../pages/clinic/SurgeriesPage'),
  '/gestion/personnel': () => import('../pages/management/EmployeesPage'),
  '/gestion/finance': () => import('../pages/management/FinancePage'),
  '/gestion/fournisseurs': () => import('../pages/management/SuppliersPage'),
  '/gestion/assurances': () => import('../pages/management/InsurancePage'),
};

const prefetched = new Set<string>();

/** Précharge le chunk d'une route (idempotent, silencieux en cas d'échec). */
export function prefetchRoute(path: string): void {
  if (prefetched.has(path)) return;
  const load = loaders[path];
  if (!load) return;
  prefetched.add(path);
  load().catch(() => prefetched.delete(path));
}
